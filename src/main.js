import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { buildCharacter, randomLook } from "./character.js";
import { ACTION_LABEL, CATALOG, D, W, buildItem, defaultLayout, floorColor, geom } from "./furniture.js";
import { INK, disposeTree, toon } from "./kit.js";
import { connect } from "./net.js";
import { findPath, freeSpot, makeGrid } from "./path.js";
import * as ui from "./ui.js";

await Promise.all([document.fonts.load("700 40px Fredoka"), document.fonts.load("40px 'Patrick Hand'")]).catch(() => {});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, k) => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * k;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem("porto." + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("porto." + k, JSON.stringify(v)); } catch {} },
};

// ---------- renderer / scene ----------
const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.append(renderer.domElement);
const canvas = renderer.domElement;
const effect = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: new THREE.Color(INK).toArray() });
const labels = new CSS2DRenderer();
labels.domElement.className = "labels";
app.append(labels.domElement);

const SKY = "#e9e4ff";
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 40, 90);
scene.add(new THREE.HemisphereLight("#ffffff", "#c7b8ef", 1.6));
const sun = new THREE.DirectionalLight("#fff4e0", 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const quiet = (m) => ((m.userData = { outlineParameters: { visible: false } }), m);
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), quiet(toon("#cdeccf").clone()));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- floor: paintable tiles over grout, sized by the layout's lot ----------
let LW = W, LD = D, tiles, grout;
const tileGeo = new THREE.BoxGeometry(0.96, 0.1, 0.96), groutGeo = new THREE.BoxGeometry(1, 0.1, 1);
const tileMat = quiet(toon("#ffffff").clone()), groutMat = quiet(toon("#d8cdee").clone());
const m4 = new THREE.Matrix4(), tmpC = new THREE.Color(), HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function buildFloor(w, d) {
  for (const m of [tiles, grout]) if (m) scene.remove(m), m.dispose();
  [LW, LD] = [w, d];
  tiles = new THREE.InstancedMesh(tileGeo, tileMat, w * d);
  grout = new THREE.InstancedMesh(groutGeo, groutMat, w * d);
  for (const m of [tiles, grout]) (m.receiveShadow = true), (m.frustumCulled = false), scene.add(m);
  ground.position.set(w / 2, -0.12, d / 2);
  sun.position.set(w / 2 + 10, 24, d / 2 + 14);
  sun.target.position.set(w / 2, 0, d / 2);
  const s = Math.max(w, d) / 2 + 10;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
}
function paintTile(x, z, c) {
  const i = z * LW + x;
  if (c === "none") return tiles.setMatrixAt(i, HIDDEN), grout.setMatrixAt(i, HIDDEN);
  tiles.setMatrixAt(i, m4.makeTranslation(x + 0.5, -0.05, z + 0.5));
  grout.setMatrixAt(i, m4.makeTranslation(x + 0.5, -0.1, z + 0.5));
  tiles.setColorAt(i, tmpC.set(c || floorColor(x, z)));
}
function floorUpdated() {
  tiles.instanceMatrix.needsUpdate = grout.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
}

// ---------- layout ----------
const itemsRoot = new THREE.Group();
scene.add(itemsRoot);
const groups = new Map();
let layout, savedLayout = null, solids = [], actables = [], actableGroups = [], fadeables = [], tickers = [], grid;

function addItem(it) {
  if (!CATALOG[it.type]) return;
  const g = buildItem(it);
  itemsRoot.add(g);
  groups.set(it.id, g);
}
function removeItem(id) {
  const g = groups.get(id);
  if (!g) return;
  itemsRoot.remove(g);
  disposeTree(g);
  groups.delete(id);
}
function reindex() {
  solids = [];
  actables = [];
  for (const it of layout.items) {
    const def = CATALOG[it.type];
    if (!def) continue;
    const r = geom(it);
    if (def.solid !== false) solids.push(r);
    if (def.action) actables.push({ it, def, r });
  }
  fadeables = [...groups.values()].filter((g) => CATALOG[g.userData.item.type].fade);
  for (const g of fadeables) {
    const r = (g.userData.rect = geom(g.userData.item));
    g.userData.mid = { cx: (r.minX + r.maxX) / 2, cz: (r.minZ + r.maxZ) / 2 };
  }
  tickers = [...groups.values()].filter((g) => g.userData.tick);
  actableGroups = actables.map((a) => groups.get(a.it.id)).filter(Boolean);
  grid = makeGrid(solids, -8, -8, LW + 8, LD + 9, 0.3);
}
function applyLayout(l) {
  layout = structuredClone(l);
  layout.floor ||= {};
  layout.size ||= [W, D];
  if (!tiles || layout.size[0] !== LW || layout.size[1] !== LD) buildFloor(...layout.size);
  for (const id of [...groups.keys()]) removeItem(id);
  layout.items.forEach(addItem);
  for (let z = 0; z < LD; z++) for (let x = 0; x < LW; x++) paintTile(x, z, layout.floor[`${x},${z}`]);
  floorUpdated();
  reindex();
}
applyLayout(defaultLayout());

// ---------- characters ----------
function makeTag(name, y = 1.62) {
  const el = document.createElement("div");
  el.className = "tag";
  el.innerHTML = `<div class="bubble" hidden></div><span class="name"></span>`;
  el.lastChild.textContent = name;
  el.lastChild.hidden = !name;
  const o = new CSS2DObject(el);
  o.position.y = y;
  return o;
}
function say(tag, text) {
  const b = tag.element.firstChild;
  b.textContent = text;
  b.hidden = false;
  clearTimeout(b._h);
  b._h = setTimeout(() => (b.hidden = true), 5000);
}
function dress(ent, look, name) {
  if (ent.char) ent.holder.remove(ent.char.root), disposeTree(ent.char.root);
  ent.char = buildCharacter(look);
  ent.holder.add(ent.char.root);
  if (!ent.tag) ent.holder.add((ent.tag = makeTag(name)));
  ent.tag.element.lastChild.textContent = name;
}

let myName = store.get("name") || "guest";
let myLook = store.get("look") || randomLook();
const me = { holder: new THREE.Group(), pos: new THREE.Vector3(), vy: 0, face: Math.PI, sitting: false, emote: null, anim: "idle" };
function spawn() {
  const p = freeSpot(grid, LW / 2 + (Math.random() - 0.5) * 1.6, Math.min(LD - 3, 15) + (Math.random() - 0.5) * 1.2);
  me.pos.set(p.x, 0, p.z);
  me.face = Math.PI;
}
spawn();
scene.add(me.holder);
dress(me, myLook, myName);
me.tag.element.classList.add("me");

const others = new Map();
function addOther(p) {
  removeOther(p.id);
  const o = { holder: new THREE.Group(), target: new THREE.Vector3().fromArray(p.p), r: p.r, a: p.a, name: p.name };
  o.holder.position.copy(o.target);
  scene.add(o.holder);
  dress(o, p.look, p.name);
  others.set(p.id, o);
  ui.setOnline(others.size + 1);
}
function removeOther(id) {
  const o = others.get(id);
  if (!o) return;
  scene.remove(o.holder);
  disposeTree(o.holder);
  others.delete(id);
  ui.setOnline(others.size + 1);
}

// ---------- multiplayer ----------
const session = (new URLSearchParams(location.search).get("s") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "lobby";
ui.setSession(session);
const build = {
  on: false, tool: "select", placing: null, ghost: null, sel: null, helper: null, paint: "#ffd6a5",
  focus: new THREE.Vector3(), saving: false, lastPaint: null, prevView: "third", drag: null, preview: null,
};

const net = connect(session, {
  open: () => {
    lastSent = "";
    net.send({ t: "hello", name: myName, look: myLook, p: me.pos.toArray(), r: me.face });
  },
  close: () => {
    build.saving = false;
    ui.setOnline(0);
  },
  welcome: (m) => {
    build.saving = false;
    for (const id of [...others.keys()]) removeOther(id);
    m.players.forEach(addOther);
    ui.setOnline(others.size + 1);
    const first = !savedLayout;
    savedLayout = m.layout;
    if (m.layout && !build.on) {
      if (me.sitting) stand();
      applyLayout(m.layout);
      if (first) spawn(); // the saved office may differ from the default one we spawned in
    }
  },
  join: addOther,
  leave: (m) => removeOther(m.id),
  move: (m) => {
    const o = others.get(m.id);
    if (!o) return;
    o.target.fromArray(m.p);
    o.r = m.r;
    o.a = m.a;
  },
  look: (m) => {
    const o = others.get(m.id);
    if (!o) return;
    o.name = m.name;
    dress(o, m.look, m.name);
  },
  chat: (m) => {
    const o = others.get(m.id);
    if (!o) return;
    say(o.tag, m.text);
    ui.chatLine(o.name, m.text);
  },
  layout: (m) => {
    savedLayout = m.layout;
    if (build.saving) return;
    if (build.on) return ui.toast("The owner just updated the office ✨ (Discard to see it)");
    if (me.sitting) stand();
    applyLayout(m.layout);
  },
  saved: () => {
    build.saving = false;
    ui.toast("Saved! Everyone sees the new office now 🎉");
  },
  error: (m) => {
    build.saving = false;
    if (m.code === "key") store.set("key", null);
    ui.toast(m.text);
  },
});

const sayAndSend = (text) => {
  say(me.tag, text);
  ui.chatLine(myName, text);
  net.send({ t: "chat", text });
};
ui.initChat(sayAndSend);

// ---------- cameras ----------
const persp = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const cam = { yaw: 0, pitch: 0.42, dist: 6.5, iso: 9 };
let view = store.get("view") === "iso" ? "iso" : "third";
let creating = false;
const camera = () => (view === "iso" ? ortho : persp);
const focus = new THREE.Vector3().copy(me.pos);
setView(view);

function setView(v, remember = true) {
  view = v;
  if (remember) store.set("view", v);
  ui.setView(v);
  if (v === "iso") cam.yaw = Math.round((cam.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
}
function zoom(f) {
  if (view === "iso") cam.iso = clamp(cam.iso * f, 3.5, 26);
  else cam.dist = clamp(cam.dist * f, 2.5, 16);
}

const focusTarget = new THREE.Vector3();
const isoHalfHeight = () => cam.iso / Math.min(1, (innerWidth / innerHeight) * 1.4); // portrait: zoom out
function updateCamera(dt) {
  const t = build.on ? build.focus : me.holder.position;
  const narrow = innerWidth < 640; // phones: creator is a bottom sheet, so frame the doodle high up
  focus.lerp(focusTarget.set(t.x, t.y + (creating ? (narrow ? -0.39 : 0.85) : 1.1), t.z), 1 - Math.exp(-dt * 8));
  const c = camera();
  const yaw = creating ? me.face + 0.35 : cam.yaw;
  const pitch = creating ? 0.15 : view === "iso" ? 0.615 : cam.pitch;
  const dist = creating ? (narrow ? 5.2 : 3.4) : view === "iso" ? 40 : cam.dist;
  c.position.set(
    focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    focus.y + Math.sin(pitch) * dist,
    focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  c.lookAt(focus);
  if (view === "iso") {
    const a = innerWidth / innerHeight, h = creating ? 2.2 : isoHalfHeight();
    Object.assign(ortho, { left: -h * a, right: h * a, top: h, bottom: -h });
    ortho.updateProjectionMatrix();
  }
}

// walls: iso = Sims-style cutaway of near walls, 3rd person = fade whatever blocks the view
const ray = new THREE.Raycaster();
function setFade(g, on) {
  if (g.userData.faded === on) return;
  g.userData.faded = on;
  g.traverse((m) => {
    if (!m.material) return;
    m.userData.base ??= [m.material.opacity, m.material.transparent, m.material.userData.outlineParameters];
    const [opacity, transparent, outline] = m.userData.base;
    if (m.material.transparent !== (on || transparent)) m.material.needsUpdate = true; // three bakes OPAQUE into the shader
    m.material.transparent = on || transparent;
    m.material.opacity = on ? 0.15 : opacity;
    m.material.depthWrite = !on;
    m.material.userData.outlineParameters = on ? { visible: false } : outline;
  });
}
function fadeWalls() {
  const c = camera();
  const hit = new Set();
  if (view === "iso") {
    const cx = Math.sin(cam.yaw), cz = Math.cos(cam.yaw);
    const ax = focus.x + cx * 7, az = focus.z + cz * 7, dx = focus.x - ax, dz = focus.z - az, L2 = dx * dx + dz * dz;
    for (const g of fadeables) {
      const r = g.userData.item.rot, nx = [0, 1, 0, -1][r], nz = [1, 0, -1, 0][r];
      const { cx: mx, cz: mz } = g.userData.mid;
      const t = clamp(((mx - ax) * dx + (mz - az) * dz) / L2, 0, 1);
      if (nx * cx + nz * cz < -0.1 || (t < 0.97 && Math.hypot(ax + dx * t - mx, az + dz * t - mz) < 1.6)) hit.add(g);
    }
  } else {
    // fade walls near the camera→player line (a thin ray alone leaves wall slabs hugging the view)
    const ax = c.position.x, az = c.position.z, dx = focus.x - ax, dz = focus.z - az, L2 = dx * dx + dz * dz || 1;
    for (const g of fadeables) {
      const { cx, cz } = g.userData.mid;
      const t = clamp(((cx - ax) * dx + (cz - az) * dz) / L2, 0, 1);
      // the view cone is wide near the camera and narrow at the player
      if (t < 0.97 && Math.hypot(ax + dx * t - cx, az + dz * t - cz) < 0.9 + 2.2 * (1 - t)) hit.add(g);
    }
  }
  for (const g of fadeables) setFade(g, hit.has(g));
}

// ---------- player ----------
const keys = new Set();
const joy = { x: 0, y: 0, id: null };
let path = null, pendingAct = null, stuck = 0;
const R = 0.28;

function collide(p) {
  for (const b of solids) {
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * R;
      p.z = cz + (dz / d) * R;
    } else {
      const l = p.x - b.minX, r = b.maxX - p.x, f = p.z - b.minZ, k = b.maxZ - p.z, m = Math.min(l, r, f, k);
      if (m === l) p.x = b.minX - R;
      else if (m === r) p.x = b.maxX + R;
      else if (m === f) p.z = b.minZ - R;
      else p.z = b.maxZ + R;
    }
  }
  p.x = clamp(p.x, -8, LW + 8);
  p.z = clamp(p.z, -8, LD + 9);
}

const distTo = (r) => Math.hypot(Math.max(r.minX - me.pos.x, 0, me.pos.x - r.maxX), Math.max(r.minZ - me.pos.z, 0, me.pos.z - r.maxZ));
const reach = (a) => (a.def.action === "talk" ? 2 : 1.1);
// does the segment p→q cross a wall? (slab test against each wall box)
function wallBetween(p, q) {
  const dx = q.x - p.x, dz = q.z - p.z;
  for (const g of fadeables) {
    const b = g.userData.rect;
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[p.x, dx, b.minX, b.maxX], [p.z, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) t0 = 2;
        continue;
      }
      const a1 = (lo - o) / d, a2 = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a1, a2));
      t1 = Math.min(t1, Math.max(a1, a2));
    }
    if (t0 <= t1) return true;
  }
  return false;
}
function nearest() {
  let best = null, bd = Infinity;
  for (const a of actables) {
    const d = distTo(a.r);
    if (d < reach(a) && d < bd && !wallBetween(me.pos, { x: a.r.cx, z: a.r.cz })) (bd = d), (best = a);
  }
  return best;
}

// where to stand to use an item: on it (chairs, beanbags) or just in front of it
function approachPoint({ it, def, r }) {
  if (def.solid === false && def.action !== "talk") return { x: r.cx, z: r.cz };
  const bx = (r.minX + r.maxX) / 2, bz = (r.minZ + r.maxZ) / 2, pad = def.action === "talk" ? 0.4 : 0.5;
  const [x, z] = [[bx, r.maxZ + pad], [r.maxX + pad, bz], [bx, r.minZ - pad], [r.minX - pad, bz]][it.rot & 3];
  return { x, y: 0, z };
}
function goTo(p, act = null) {
  if (me.sitting) stand();
  const route = findPath(grid, me.pos, p);
  path = route;
  pendingAct = route ? act : null;
  stuck = 0;
  if (!route) ui.toast("Can't get there from here 🤔");
  return !!route;
}

function sitOn({ it, def, r }) {
  const odd = it.rot & 1, n = def.w;
  let best = null;
  for (let i = 0; i < n; i++) {
    const off = i - (n - 1) / 2;
    const p = new THREE.Vector3(r.cx + (odd ? 0 : off), 0, r.cz + (odd ? off : 0));
    if (!best || p.distanceTo(me.pos) < best.distanceTo(me.pos)) best = p;
  }
  me.pos.copy(best).setY(def.seat - 0.47);
  me.face = (it.rot & 3) * (Math.PI / 2);
  me.sitting = true;
  path = null;
}
function stand() {
  me.sitting = false;
  me.pos.y = 0;
  me.pos.x += Math.sin(me.face) * 0.7;
  me.pos.z += Math.cos(me.face) * 0.7;
  collide(me.pos);
}

const bubbleOn = (g, y) => g.userData.tag || g.add((g.userData.tag = makeTag("", y))) && g.userData.tag;
function interact(a = nearest()) {
  if (me.sitting) return stand();
  if (!a) return;
  const g = groups.get(a.it.id);
  switch (a.def.action) {
    case "sit": return sitOn(a);
    case "projects": case "experience": case "about": case "contact": return ui.openPortfolio(a.def.action);
    case "coffee": return sayAndSend(pick(["☕ sluuurp!", "☕ +10 productivity", "☕ now vibrating at 4000rpm", "☕ coffee #7 today, don't tell anyone"]));
    case "arcade": return sayAndSend(pick(["🕹️ NEW HIGH SCORE: 9,999", "🕹️ game over… again", "🕹️ just one more round", "🕹️ rage quit 😤"]));
    case "meow":
      if (!g) return;
      g.userData.hop = performance.now();
      return say(bubbleOn(g, 0.8), pick(["meow~ 🐾", "mrrp?", "*purrs loudly*", "feed me 🐟", "I'm the real CEO"]));
    case "talk":
      if (!g) return;
      g.userData.waveUntil = performance.now() / 1000 + 2.5;
      for (const o of g.children) if (o.element?.classList.contains("marker")) (o.visible = false), setTimeout(() => (o.visible = true), 5000);
      return say(bubbleOn(g, 1.95), a.it.text || "Hi! 👋");
  }
}

function jump() {
  if (me.sitting || me.pos.y > 0.001 || build.on) return;
  me.vy = 5.6;
}
function emote(anim) {
  if (me.sitting) return;
  me.emote = { anim, until: performance.now() + 2600 };
}

let netT = 0, lastSent = "";
const mv = new THREE.Vector3(), before = new THREE.Vector3();
function updateMe(dt, t) {
  let ix = 0, iz = 0, analog = 1;
  if (!ui.busy()) {
    if (keys.has("w") || keys.has("arrowup")) iz -= 1;
    if (keys.has("s") || keys.has("arrowdown")) iz += 1;
    if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
    if (keys.has("d") || keys.has("arrowright")) ix += 1;
  }
  const jl = Math.hypot(joy.x, joy.y);
  if (joy.id !== null && jl > 0.15) (ix = joy.x), (iz = joy.y), (analog = Math.min(1, jl));
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  mv.set(0, 0, 0);
  if (build.on) {
    if (ix || iz) build.focus.addScaledVector(mv.set(ix * cy + iz * sy, 0, -ix * sy + iz * cy).normalize(), dt * 9);
    mv.set(0, 0, 0);
  } else if (ix || iz) {
    path = pendingAct = null;
    if (me.sitting) stand();
    mv.set(ix * cy + iz * sy, 0, -ix * sy + iz * cy).normalize();
  } else if (path) {
    const wp = path[0];
    mv.set(wp.x - me.pos.x, 0, wp.z - me.pos.z);
    const d = mv.length(), last = path.length === 1;
    if (d < (last ? 0.12 : 0.25)) {
      path.shift();
      mv.set(0, 0, 0);
      if (!path.length) {
        path = null;
        if (pendingAct) interact(pendingAct);
        pendingAct = null;
      }
    } else mv.divideScalar(d);
  }

  const run = keys.has("shift") || jl > 0.92;
  const speed = (run ? 5.4 : 3.3) * (joy.id !== null ? Math.max(analog, 0.45) : 1);
  const moving = mv.lengthSq() > 0;
  if (moving) {
    me.emote = null;
    before.copy(me.pos);
    me.pos.addScaledVector(mv, speed * dt);
    collide(me.pos);
    me.face = lerpAngle(me.face, Math.atan2(mv.x, mv.z), 1 - Math.exp(-dt * 14));
    if (path && before.distanceTo(me.pos) < speed * dt * 0.25) {
      if ((stuck += dt) > 0.4) {
        path = null;
        if (pendingAct && distTo(pendingAct.r) < reach(pendingAct) + 0.3) interact(pendingAct);
        pendingAct = null;
      }
    } else stuck = 0;
  }
  if (!me.sitting) {
    me.vy -= 16 * dt;
    me.pos.y += me.vy * dt;
    if (me.pos.y <= 0) {
      if (me.vy < -3) me.char.land();
      me.pos.y = me.vy = 0;
    }
  }

  const emoting = me.emote && performance.now() < me.emote.until;
  me.anim = me.sitting ? "sit" : emoting ? me.emote.anim : me.pos.y > 0.01 ? "idle" : moving ? (run ? "run" : "walk") : "idle";
  me.holder.position.copy(me.pos);
  me.holder.rotation.y = me.face;
  me.char.update(dt, t, me.anim);

  if ((netT += dt) > 0.1) {
    netT = 0;
    const p = me.pos.toArray().map((n) => Math.round(n * 100) / 100);
    const key = `${p}|${me.face.toFixed(2)}|${me.anim}`;
    if (key !== lastSent) {
      lastSent = key;
      net.send({ t: "move", p, r: me.face, a: me.anim });
    }
  }
}

function updateOthers(dt, t) {
  const k = 1 - Math.exp(-dt * 10);
  for (const o of others.values()) {
    o.holder.position.lerp(o.target, k);
    o.holder.rotation.y = lerpAngle(o.holder.rotation.y, o.r, k);
    o.char.update(dt, t, o.a);
  }
}

// ---------- pointer: click/tap to walk, drag to orbit, wheel/pinch to zoom ----------
const ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function aim(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera());
  ray.far = Infinity;
}
const groundPoint = () => ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
const gridPoint = () => {
  const p = groundPoint();
  return p && { x: Math.round(p.x), z: Math.round(p.z) };
};
function pickHit(list = itemsRoot.children) {
  for (const h of ray.intersectObjects(list, true)) {
    let g = h.object;
    while (g.parent && g.parent !== itemsRoot) g = g.parent;
    if (g.userData.item && !g.userData.faded && g.visible) return { item: g.userData.item, point: h.point };
  }
  return null;
}
const pickItem = (list) => pickHit(list)?.item ?? null;

const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 24), quiet(new THREE.MeshBasicMaterial({ color: "#ff8fb1", transparent: true })));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

function click() {
  if (build.on) return buildClick();
  const hit = pickHit();
  const a = hit && actables.find((x) => x.it === hit.item);
  if (a) {
    if (distTo(a.r) < reach(a)) return interact(a);
    return goTo(approachPoint(a), a);
  }
  // clicked a plain object (desk, sign…): walk to its front, not to the floor behind it
  const def = hit && CATALOG[hit.item.type];
  const p = !hit
    ? groundPoint()
    : def.solid === false
      ? new THREE.Vector3(hit.point.x, 0, hit.point.z)
      : new THREE.Vector3().copy(approachPoint({ it: hit.item, def, r: geom(hit.item) })).setY(0);
  if (!p || !goTo(p)) return;
  marker.position.set(p.x, 0.02, p.z);
  marker.visible = true;
  marker.userData.t = performance.now();
}

let drag = null, pinch = 0;
const touches = new Map();
const pinchDist = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
const drawing = () => build.on && ["paint", "wall", "room", "erase"].includes(build.tool);

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (touches.size === 2) {
    commit();
    pinch = pinchDist();
    drag = null;
    build.drag = null;
    clearPreview();
    return;
  }
  drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  aim(e);
  if (!drawing()) return;
  if (build.tool === "paint") {
    begin();
    build.lastPaint = null;
    paintAt();
  } else {
    const g = gridPoint();
    if (g) build.drag = { a: g, b: g };
  }
});
canvas.addEventListener("pointermove", (e) => {
  aim(e);
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinch) {
    const d = pinchDist();
    zoom(pinch / d);
    pinch = d;
    return;
  }
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    if (drawing()) {
      if (build.tool === "paint") paintAt();
      else if (build.drag) {
        const g = gridPoint();
        if (g && (g.x !== build.drag.b.x || g.z !== build.drag.b.z)) (build.drag.b = g), showPreview();
      }
    } else if (drag.moved && build.on && e.pointerType !== "mouse") {
      // touch: one-finger drag pans the build camera (no WASD on phones)
      const k = (2 * isoHalfHeight()) / innerHeight, dx = (e.clientX - drag.lx) * k, dy = ((e.clientY - drag.ly) * k) / Math.sin(0.615);
      const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
      build.focus.x -= dx * cy + dy * sy;
      build.focus.z -= -dx * sy + dy * cy;
    } else if (drag.moved) {
      cam.yaw -= (e.clientX - drag.lx) * 0.006;
      cam.pitch = clamp(cam.pitch + (e.clientY - drag.ly) * 0.004, 0.05, 1.3);
    }
    drag.lx = e.clientX;
    drag.ly = e.clientY;
  }
  if (build.on) return moveGhost();
  const it = !drag && e.pointerType === "mouse" && pickItem();
  canvas.style.cursor = it && CATALOG[it.type].action ? "pointer" : "";
});
const endPointer = (e, cancelled) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = 0;
  if (build.drag) {
    if (!cancelled) commitWalls();
    build.drag = null;
    clearPreview();
  } else if (build.on && build.tool === "paint" && drag) {
    commit();
  } else if (drag && !drag.moved && !cancelled) {
    aim(e);
    click();
  }
  drag = null;
};
canvas.addEventListener("pointerup", (e) => endPointer(e, false));
canvas.addEventListener("pointercancel", (e) => endPointer(e, true));
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (build.on) cancelPlace();
});
canvas.addEventListener("wheel", (e) => zoom(1 + Math.sign(e.deltaY) * 0.1), { passive: true });

// on-screen joystick (touch screens)
const stick = ui.$("#stick"), knob = stick.querySelector(".knob");
function moveStick(e) {
  const r = stick.getBoundingClientRect(), rad = r.width / 2;
  let dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + rad);
  const l = Math.hypot(dx, dy);
  if (l > rad) (dx *= rad / l), (dy *= rad / l);
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / rad;
  joy.y = dy / rad;
}
stick.addEventListener("pointerdown", (e) => {
  joy.id = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
});
stick.addEventListener("pointermove", (e) => e.pointerId === joy.id && moveStick(e));
const endStick = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = joy.y = 0;
  knob.style.transform = "";
};
stick.addEventListener("pointerup", endStick);
stick.addEventListener("pointercancel", endStick);

// ---------- build mode ----------
const newId = () => Math.random().toString(36).slice(2, 10);
const stable = (l) =>
  JSON.stringify({ floor: {}, size: [W, D], ...l }, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );
const ghostMat = quiet(new THREE.MeshBasicMaterial({ color: "#6ec6b8", transparent: true, opacity: 0.55, depthWrite: false }));
const eraseMat = quiet(new THREE.MeshBasicMaterial({ color: "#ff5a5a", transparent: true, opacity: 0.55, depthWrite: false }));
const ghostOf = (it, mat) => {
  const g = buildItem(it, true);
  g.traverse((m) => {
    if (!m.material) return;
    if (m.material.userData.own) m.material.map?.dispose(), m.material.dispose();
    m.material = mat;
  });
  return g;
};

// undo / redo: whole-layout snapshots (layouts are small JSON)
const hist = { undo: [], redo: [] };
const syncHistory = () => ui.setHistory(hist.undo.length > 0, hist.redo.length > 0);
function pushUndo(l) {
  hist.undo.push(l);
  if (hist.undo.length > 80) hist.undo.shift();
  hist.redo.length = 0;
  syncHistory();
}
const snapshot = () => pushUndo(structuredClone(layout));
// for edits that may turn out to change nothing (paint strokes, typing, wall drags)
let pending = null;
const begin = () => (pending = structuredClone(layout));
function commit() {
  if (pending && JSON.stringify(pending) !== JSON.stringify(layout)) pushUndo(pending);
  pending = null;
}
function restore(l) {
  cancelPlace();
  const selId = build.sel?.id;
  applyLayout(l);
  select(layout.items.find((i) => i.id === selId) || null);
  ui.setLot(layout.size);
}
function travel(from, to) {
  if (!from.length) return ui.toast("Nothing to undo there 🙃");
  to.push(structuredClone(layout));
  restore(from.pop());
  syncHistory();
}
const undo = () => travel(hist.undo, hist.redo);
const redo = () => travel(hist.redo, hist.undo);

function toggleBuild() {
  build.on = !build.on;
  ui.showBuild(build.on);
  if (build.on) {
    if (me.sitting) stand(); // you might delete the chair
    build.prevView = view;
    setView("iso", false);
    build.focus.copy(me.pos);
    path = pendingAct = null;
    hist.undo.length = hist.redo.length = 0;
    syncHistory();
    ui.setLot(layout.size);
    setTool("select");
  } else {
    cancelPlace();
    select(null);
    build.drag = null;
    clearPreview();
    setView(build.prevView, false);
    canvas.style.cursor = "";
    if (stable(layout) !== stable(savedLayout || defaultLayout())) ui.toast("Unsaved changes stay on your screen only 👀");
    const p = freeSpot(grid, me.pos.x, me.pos.z); // you may have built something on top of yourself
    me.pos.set(p.x, 0, p.z);
  }
}
function setTool(tool) {
  build.tool = tool;
  ui.setTool(tool);
  if (tool !== "select") select(null);
  cancelPlace();
  canvas.style.cursor = tool === "select" ? "" : "crosshair";
}
function startPlace(p, moving = null) {
  cancelPlace();
  select(null);
  build.placing = { rot: 0, x: 0, z: 0, ...p, moving };
  if (moving) groups.get(moving.id).visible = false;
  build.ghost = ghostOf(build.placing, ghostMat);
  scene.add(build.ghost);
  ui.showPlacing(true);
  moveGhost();
}
function cancelPlace() {
  if (!build.placing) return;
  const g = build.placing.moving && groups.get(build.placing.moving.id);
  if (g) g.visible = true;
  scene.remove(build.ghost);
  disposeTree(build.ghost);
  build.ghost = build.placing = null;
  ui.showPlacing(false);
}
function moveGhost() {
  const p = build.placing;
  if (!p) return;
  const hit = groundPoint();
  if (hit) {
    const odd = p.rot & 1, def = CATALOG[p.type];
    p.x = Math.round(hit.x - (odd ? def.d : def.w) / 2);
    p.z = Math.round(hit.z - (odd ? def.w : def.d) / 2);
  }
  const { cx, cz } = geom(p);
  build.ghost.position.set(cx, 0.02, cz);
  build.ghost.rotation.y = p.rot * (Math.PI / 2);
}
function select(it) {
  build.sel = it;
  if (build.helper) scene.remove(build.helper), build.helper.geometry.dispose(), build.helper.material.dispose();
  build.helper = null;
  if (it && groups.get(it.id)) scene.add((build.helper = new THREE.BoxHelper(groups.get(it.id), "#ff5a9e")));
  ui.showSelection(it);
}
function changed(it) {
  removeItem(it.id);
  addItem(it);
  reindex();
  if (build.sel === it) select(it);
}
function buildClick() {
  const p = build.placing;
  if (p) {
    moveGhost(); // a tap has no pointermove before it: place where the tap is, not the stale ghost
    snapshot();
    if (p.moving) {
      const it = p.moving;
      Object.assign(it, { x: p.x, z: p.z, rot: p.rot });
      p.moving = null;
      changed(it);
      cancelPlace();
      return select(it);
    }
    const it = { id: newId(), type: p.type, x: p.x, z: p.z, rot: p.rot, ...(p.color && { color: p.color }), ...(p.text && { text: p.text }) };
    layout.items.push(it);
    addItem(it);
    reindex();
    return;
  }
  if (build.tool === "select") select(pickItem());
}
function removeSel(it = build.sel) {
  if (!it) return;
  snapshot();
  layout.items = layout.items.filter((x) => x !== it);
  removeItem(it.id);
  reindex();
  select(null);
}
function paintAt() {
  const p = groundPoint();
  if (!p) return;
  const from = build.lastPaint || p, n = Math.ceil(from.distanceTo(p) / 0.3);
  build.lastPaint = p;
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(from.x + (p.x - from.x) * (n ? i / n : 1)), z = Math.floor(from.z + (p.z - from.z) * (n ? i / n : 1));
    if (x < 0 || z < 0 || x >= LW || z >= LD) continue;
    if (build.paint) layout.floor[`${x},${z}`] = build.paint;
    else delete layout.floor[`${x},${z}`];
    paintTile(x, z, build.paint);
  }
  floorUpdated();
}
function rotate() {
  if (build.placing) {
    build.placing.rot = (build.placing.rot + 1) & 3;
    moveGhost();
  } else if (build.sel) {
    snapshot();
    build.sel.rot = (build.sel.rot + 1) & 3;
    changed(build.sel);
  }
}

// wall drawing: walls sit on grid lines. A wall item hugs one edge of its tile (see furniture.js),
// so "the grid line between rows z-1 and z" = a rot0 wall in row z-1 or a rot2 wall in row z.
const isWall = (it) => it.type === "wall" || it.type === "window";
const edgeKey = ({ x, z, rot }) => [`h${x},${z + 1}`, `v${x + 1},${z}`, `h${x},${z}`, `v${x},${z}`][rot & 3];
function lineWalls(a, b) {
  const out = [];
  if (Math.abs(b.x - a.x) >= Math.abs(b.z - a.z)) {
    for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x++) out.push({ x, z: a.z - 1, rot: 0 });
  } else for (let z = Math.min(a.z, b.z); z < Math.max(a.z, b.z); z++) out.push({ x: a.x - 1, z, rot: 1 });
  return out;
}
function roomWalls(a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  if (x1 - x0 < 1 || z1 - z0 < 1) return [];
  const out = [];
  for (let x = x0; x < x1; x++) out.push({ x, z: z0 - 1, rot: 0 }, { x, z: z1, rot: 2 });
  for (let z = z0; z < z1; z++) out.push({ x: x0 - 1, z, rot: 1 }, { x: x1, z, rot: 3 });
  return out;
}
const dragWalls = () => {
  const { a, b } = build.drag;
  return build.tool === "room" ? roomWalls(a, b) : lineWalls(a, b);
};
function clearPreview() {
  if (build.preview) scene.remove(build.preview), disposeTree(build.preview);
  build.preview = null;
}
function showPreview() {
  clearPreview();
  build.preview = new THREE.Group();
  const mat = build.tool === "erase" ? eraseMat : ghostMat;
  for (const w of dragWalls()) build.preview.add(ghostOf({ type: "wall", ...w }, mat)).children.at(-1).position.y += 0.03;
  scene.add(build.preview);
}
function commitWalls() {
  const walls = dragWalls();
  if (!walls.length) return;
  const edges = new Set(walls.map(edgeKey));
  begin();
  if (build.tool === "erase") {
    const gone = layout.items.filter((it) => isWall(it) && edges.has(edgeKey(it)));
    if (!gone.length) return (pending = null), ui.toast("No walls there to knock down 🔨");
    layout.items = layout.items.filter((it) => !gone.includes(it));
    gone.forEach((it) => removeItem(it.id));
  } else {
    const taken = new Set(layout.items.filter(isWall).map(edgeKey));
    for (const w of walls) {
      if (taken.has(edgeKey(w))) continue;
      const it = { id: newId(), type: "wall", ...w };
      layout.items.push(it);
      addItem(it);
    }
    if (build.tool === "room" && build.paint !== "none") {
      const { a, b } = build.drag;
      for (let x = Math.max(0, Math.min(a.x, b.x)); x < Math.min(LW, Math.max(a.x, b.x)); x++)
        for (let z = Math.max(0, Math.min(a.z, b.z)); z < Math.min(LD, Math.max(a.z, b.z)); z++) {
          if (build.paint) layout.floor[`${x},${z}`] = build.paint;
          else delete layout.floor[`${x},${z}`];
          paintTile(x, z, build.paint);
        }
      floorUpdated();
    }
  }
  reindex();
  commit();
  if (build.tool === "room") {
    const taken = new Set(layout.items.filter(isWall).map(edgeKey)); // windows aren't doors
    if (walls.every((w) => taken.has(edgeKey(w)))) ui.toast("Heads up: this room has no door yet. Use 🔨 Erase wall to make one");
  }
}

ui.initBuild((a, arg) => {
  const it = build.sel;
  switch (a) {
    case "exit": return toggleBuild();
    case "tool": return setTool(arg);
    case "paint": return (build.paint = arg);
    case "place": setTool("select"); return startPlace({ type: arg });
    case "rotate": return rotate();
    case "delete": return removeSel();
    case "move": return it && startPlace({ ...it }, it);
    case "copy": return it && startPlace({ ...it, id: undefined });
    case "swap": if (it && isWall(it)) { snapshot(); it.type = it.type === "wall" ? "window" : "wall"; changed(it); } return;
    case "color": if (it) { snapshot(); it.color = arg; changed(it); } return;
    case "textstart": return it && begin();
    case "textend": return commit();
    case "stopplace": return cancelPlace();
    case "text": if (it) { if (arg) it.text = arg; else delete it.text; changed(it); } return;
    case "undo": return undo();
    case "redo": return redo();
    case "lot": {
      const size = [clamp(Math.round(arg[0]) || W, 8, 48), clamp(Math.round(arg[1]) || D, 8, 40)];
      ui.setLot(size);
      if (size[0] === LW && size[1] === LD) return;
      snapshot();
      return restore({ ...layout, size });
    }
    case "discard":
      snapshot();
      restore(savedLayout || defaultLayout());
      return ui.toast("Back to the saved office ↩️ (Undo if you didn't mean it)");
    case "reset":
      snapshot();
      restore(defaultLayout());
      return ui.toast("Default office loaded. Save to keep it.");
    case "save": {
      const key = store.get("key") || prompt("Owner key 🔑 (only the office owner can save)");
      if (!key) return;
      store.set("key", key);
      build.saving = net.send({ t: "layout", key, layout });
      if (!build.saving) ui.toast("You're offline right now, try again in a moment 📡");
      return;
    }
  }
});

// ---------- keyboard + HUD ----------
addEventListener("keydown", (e) => {
  if (ui.busy()) return;
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey) {
    if (build.on && (k === "z" || k === "y")) {
      e.preventDefault();
      k === "y" || e.shiftKey ? redo() : undo();
    }
    return;
  }
  if (k === "enter") return e.preventDefault(), ui.focusChat();
  keys.add(k);
  if (k === " ") e.preventDefault(), jump();
  else if (k === "e" && !build.on) interact();
  else if (k === "v" && !build.on) setView(view === "iso" ? "third" : "iso");
  else if (k === "b") toggleBuild();
  else if (k === "1") emote("wave");
  else if (k === "2") emote("dance");
  else if (build.on && k === "r") rotate();
  else if (build.on && (k === "delete" || k === "backspace")) removeSel();
  else if (k === "escape") {
    if (!build.on) return me.sitting && stand();
    if (build.drag) (build.drag = null), clearPreview();
    else if (build.placing) cancelPlace();
    else if (build.sel) select(null);
    else toggleBuild();
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());

function openCreator() {
  creating = true;
  if (me.sitting) stand();
  ui.openCreator({
    name: myName === "guest" ? "" : myName,
    look: { ...myLook },
    onChange: (look) => dress(me, look, myName),
    onName: (name) => (me.tag.element.lastChild.textContent = name),
    onSkip: () => {
      creating = false;
      store.set("name", myName);
      store.set("look", myLook);
      dress(me, myLook, myName);
      ui.openPortfolio("about");
    },
    onDone: (name, look) => {
      creating = false;
      myName = name;
      myLook = look;
      store.set("name", name);
      store.set("look", look);
      dress(me, look, name);
      net.send({ t: "look", name, look });
      ui.toast("Say hi to the receptionist, or open 📁 Portfolio anytime 👋");
    },
  });
}
const on = (id, fn) => (ui.$(id).onclick = fn);
on("#btn-portfolio", () => ui.openPortfolio("about"));
on("#btn-char", openCreator);
on("#btn-view", () => !build.on && setView(view === "iso" ? "third" : "iso"));
on("#btn-build", toggleBuild);
on("#btn-wave", () => emote("wave"));
on("#btn-dance", () => emote("dance"));
on("#btn-jump", jump);
on("#prompt", () => !build.on && interact());
on("#btn-invite", async () => {
  const url = `${location.origin}/?s=${session}`;
  try {
    await navigator.clipboard.writeText(url);
    ui.toast("Invite link copied! Send it to a friend 🔗");
  } catch {
    prompt("Copy this invite link:", url);
  }
});
on("#session", () => {
  const s = prompt("Join a session by name (leave empty for a fresh private one):", "");
  if (s === null) return;
  location.search = `?s=${encodeURIComponent(s.trim() || Math.random().toString(36).slice(2, 8))}`;
});
if (!store.get("name")) openCreator();

// ---------- loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05), t = now / 1000;
  last = now;
  updateMe(dt, t);
  updateOthers(dt, t);
  updateCamera(dt);
  fadeWalls();
  for (const g of tickers) g.userData.tick(t);
  for (const g of groups.values()) {
    if (!g.userData.hop) continue;
    const h = (now - g.userData.hop) / 1000;
    g.position.y = h < 0.4 ? Math.sin((h / 0.4) * Math.PI) * 0.35 : ((g.userData.hop = 0), 0);
  }
  if (marker.visible) {
    const h = (now - marker.userData.t) / 600;
    marker.scale.setScalar(1 + h);
    marker.material.opacity = 1 - h;
    marker.visible = h < 1;
  }
  const a = !build.on && !creating && (me.sitting ? { def: { action: "stand" } } : nearest());
  ui.setPrompt(a ? (a.def.action === "stand" ? "Stand up" : ACTION_LABEL[a.def.action]) : null);
  effect.render(scene, camera());
  labels.render(scene, camera());
});

// debug handle so you (or automated QA) can inspect state from the console
window.__office = { me, layout: () => layout, others, build };
