import { timingSafeEqual } from "node:crypto";
import { rename, unlink } from "node:fs/promises";
import index from "./index.html";

const PROD = process.env.NODE_ENV === "production";
// ponytail: one shared owner key guards layout saves; swap for real auth if you ever add co-owners
if (PROD && !process.env.OWNER_KEY) {
  console.error("OWNER_KEY is required in production (it protects layout saves).");
  process.exit(1);
}
const OWNER_KEY = process.env.OWNER_KEY || "dev";
if (!process.env.OWNER_KEY) console.warn('OWNER_KEY not set, using "dev" for local development.');
const LAYOUT_FILE = process.env.LAYOUT_FILE || "layout.json";

type Player = { id: string; name: string; look: Record<string, string>; p: number[]; r: number; a: string };
type Data = { id: string; s: string; me?: Player; hits: number; win: number; lastLook: number; lastSave: number };
// ponytail: sessions live in memory, one process; move to Redis pub/sub if you scale out
const sessions = new Map<string, Map<string, Player>>();
// topics: "s:<session>" for players, "layout" for everyone (session names can't contain ":")
const topic = (s: string) => "s:" + s;
const LAYOUT_TOPIC = "layout";

const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const num = (v: unknown, lim = 200) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(-lim, Math.min(lim, x)) : 0;
};
const HEX = /^#[0-9a-f]{6}$/i;
const vec = (p: any) => [num(p?.[0]), num(p?.[1]), num(p?.[2])].map((n) => Math.round(n * 100) / 100);
const lookOf = (l: any) =>
  Object.fromEntries(
    Object.entries(l && typeof l === "object" ? l : {})
      .slice(0, 12)
      .map(([k, v]) => [str(k, 12), str(v, 16)]),
  );
const keyOk = (k: unknown) => {
  const a = Buffer.from(String(k ?? "")), b = Buffer.from(OWNER_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
};

function cleanLayout(l: any) {
  if (!l || typeof l !== "object" || !Array.isArray(l.items) || l.items.length > 3000) return null;
  const items = l.items.map((it: any) => ({
    id: str(it?.id, 16),
    type: str(it?.type, 24),
    x: Math.round(num(it?.x, 100)),
    z: Math.round(num(it?.z, 100)),
    rot: Math.round(num(it?.rot, 3)) & 3,
    ...(HEX.test(it?.color) && { color: it.color }),
    ...(it?.text && { text: str(it.text, 120) }),
  }));
  const floor = Object.fromEntries(
    Object.entries(l.floor && typeof l.floor === "object" ? l.floor : {})
      .filter(([k, v]) => /^\d{1,3},\d{1,3}$/.test(k) && (v === "none" || HEX.test(String(v))))
      .slice(0, 5000),
  );
  const size = [Math.round(num(l.size?.[0], 48)) || 24, Math.round(num(l.size?.[1], 40)) || 18].map((n) => Math.max(8, n));
  return { items, floor, size };
}

let layout: unknown = null;
try {
  if (await Bun.file(LAYOUT_FILE).exists()) layout = cleanLayout(await Bun.file(LAYOUT_FILE).json());
} catch (e) {
  console.warn(`Couldn't read ${LAYOUT_FILE}, starting with the default office.`, e);
}

// ponytail: fixed-window limiter per socket; plenty for 10Hz movement + chat
function allowed(d: Data) {
  const now = Date.now();
  if (now - d.win > 1000) (d.win = now), (d.hits = 0);
  return ++d.hits <= 30;
}

const server = Bun.serve<Data, {}>({
  port: Number(process.env.PORT || 3000),
  development: !PROD,
  routes: {
    "/": index,
    "/ws": (req, server) => {
      const s = (new URL(req.url).searchParams.get("s") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "lobby";
      const data: Data = { id: crypto.randomUUID().slice(0, 8), s, hits: 0, win: 0, lastLook: 0, lastSave: 0 };
      return server.upgrade(req, { data }) ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    },
  },
  websocket: {
    maxPayloadLength: 512 * 1024,
    open(ws) {
      ws.subscribe(topic(ws.data.s));
      ws.subscribe(LAYOUT_TOPIC);
    },
    async message(ws, raw) {
      try {
        const text = String(raw);
        // only a layout save may be big; everything else is tiny
        if (text.length > 4096 && !text.startsWith('{"t":"layout"')) return;
        if (!allowed(ws.data)) return;
        const m = JSON.parse(text);
        if (!m || typeof m !== "object") return;

        const { s, id } = ws.data;
        const room = sessions.get(s) ?? sessions.set(s, new Map()).get(s)!;
        const me = ws.data.me;
        const now = Date.now();
        const send = (o: object) => ws.send(JSON.stringify(o));
        const toOthers = (o: object) => ws.publish(topic(s), JSON.stringify(o));

        if (m.t === "hello") {
          if (me) return; // one hello per connection
          const p: Player = { id, name: str(m.name, 20).trim() || "guest", look: lookOf(m.look), p: vec(m.p), r: num(m.r, 10), a: "idle" };
          ws.data.me = p;
          room.set(id, p);
          send({ t: "welcome", id, players: [...room.values()].filter((o) => o !== p), layout });
          return toOthers({ t: "join", ...p });
        }
        if (!me) return;

        switch (m.t) {
          case "move":
            me.p = vec(m.p);
            me.r = num(m.r, 10);
            me.a = str(m.a, 8);
            return toOthers({ t: "move", id, p: me.p, r: me.r, a: me.a });
          case "look":
            if (now - ws.data.lastLook < 500) return; // each look rebuilds a character on every client
            ws.data.lastLook = now;
            me.name = str(m.name, 20).trim() || "guest";
            me.look = lookOf(m.look);
            return toOthers({ t: "look", id, name: me.name, look: me.look });
          case "chat": {
            const t = str(m.text, 200).trim();
            return t && toOthers({ t: "chat", id, text: t });
          }
          case "layout": {
            if (now - ws.data.lastSave < 2000) return send({ t: "error", text: "Easy there, try again in a sec ⏳" });
            ws.data.lastSave = now;
            if (!keyOk(m.key)) return send({ t: "error", code: "key", text: "Wrong owner key 🙅" });
            const c = cleanLayout(m.layout);
            if (!c) return send({ t: "error", text: "Layout looks broken, not saved." });
            const tmp = `${LAYOUT_FILE}.${id}.tmp`; // unique per socket so concurrent saves can't collide
            try {
              await Bun.write(tmp, JSON.stringify(c));
              await rename(tmp, LAYOUT_FILE); // atomic: a crash mid-write never leaves half a file
            } catch (e) {
              console.error("layout save failed:", e);
              await unlink(tmp).catch(() => {});
              return send({ t: "error", text: "Couldn't save on the server 😿 Try again?" });
            }
            layout = c; // only after it's really on disk
            server.publish(LAYOUT_TOPIC, JSON.stringify({ t: "layout", layout }));
            return send({ t: "saved" });
          }
        }
      } catch (e) {
        console.error("ws message failed:", e);
      }
    },
    close(ws) {
      const room = sessions.get(ws.data.s);
      room?.delete(ws.data.id);
      if (room?.size === 0) sessions.delete(ws.data.s);
      if (ws.data.me) server.publish(topic(ws.data.s), JSON.stringify({ t: "leave", id: ws.data.id }));
    },
  },
});

console.log(`🏢 Porto Office running at ${server.url}`);
