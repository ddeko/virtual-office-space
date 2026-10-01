import { afterAll, beforeAll, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Boots the real server on a spare port and pokes it like a hostile client would.
const PORT = 4000 + Math.floor(Math.random() * 20000); // random so parallel runs don't collide
let proc: ReturnType<typeof Bun.spawn>;

beforeAll(async () => {
  proc = Bun.spawn(["bun", "server.ts"], {
    cwd: import.meta.dir,
    env: { ...process.env, PORT: String(PORT), OWNER_KEY: "test-key", LAYOUT_FILE: join(tmpdir(), `porto-test-${Date.now()}.json`) },
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return;
    } catch {
      await Bun.sleep(100);
    }
  }
  throw new Error("server did not start");
});
afterAll(() => proc.kill());

function client(session: string) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?s=${session}`);
  const got: any[] = [];
  ws.onmessage = (e) => got.push(JSON.parse(String(e.data)));
  const ready = new Promise((r) => (ws.onopen = r));
  return { ws, got, ready, send: (m: unknown) => ws.send(typeof m === "string" ? m : JSON.stringify(m)) };
}

test("garbage messages don't crash the server", async () => {
  const c = client("lobby");
  await c.ready;
  for (const junk of ["null", "42", '"x"', "[]", "{", '{"t":"move"}', '{"t":"layout","layout":null}']) c.send(junk);
  await Bun.sleep(200);
  const res = await fetch(`http://localhost:${PORT}/`);
  expect(res.ok).toBe(true);
  c.ws.close();
});

test('a session named "all" (or "layout") cannot reach other sessions', async () => {
  const victim = client("lobby");
  const attacker = client("all");
  const attacker2 = client("layout");
  await Promise.all([victim.ready, attacker.ready, attacker2.ready]);
  victim.send({ t: "hello", name: "victim", look: {}, p: [0, 0, 0] });
  await Bun.sleep(100);
  for (const a of [attacker, attacker2]) {
    a.send({ t: "hello", name: "attacker", look: {}, p: [0, 0, 0] });
    a.send({ t: "chat", text: "spam" });
  }
  await Bun.sleep(200);
  expect(victim.got.filter((m) => m.t === "join" || m.t === "chat")).toEqual([]);
  for (const c of [victim, attacker, attacker2]) c.ws.close();
});

test("layout saves need the owner key", async () => {
  const c = client("lobby");
  await c.ready;
  c.send({ t: "hello", name: "x", look: {}, p: [0, 0, 0] });
  c.send({ t: "layout", key: "nope", layout: { items: [] } });
  await Bun.sleep(200);
  expect(c.got.some((m) => m.t === "error" && m.code === "key")).toBe(true);
  expect(c.got.some((m) => m.t === "saved")).toBe(false);
  c.ws.close();
});

test("concurrent owner saves all succeed and reach other clients", async () => {
  const watcher = client("elsewhere");
  const owners = Array.from({ length: 8 }, () => client("lobby"));
  await Promise.all([watcher.ready, ...owners.map((o) => o.ready)]);
  for (const o of owners) o.send({ t: "hello", name: "owner", look: {}, p: [0, 0, 0] });
  await Bun.sleep(100);
  for (const [i, o] of owners.entries())
    o.send({ t: "layout", key: "test-key", layout: { items: [{ id: "a", type: "desk", x: i, z: 0, rot: 0 }], size: [24, 18] } });
  await Bun.sleep(500);
  for (const o of owners) expect(o.got.some((m) => m.t === "saved")).toBe(true);
  expect(watcher.got.filter((m) => m.t === "layout").length).toBe(owners.length);
  for (const c of [watcher, ...owners]) c.ws.close();
});
