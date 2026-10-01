// Furniture catalog + default office layout. 1 tile = 1 world unit, tile (x,z) spans x..x+1, z..z+1.
// Each builder draws around its footprint center, floor at y=0, front facing +z.
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LOOK, buildCharacter } from "./character.js";
import { FONT, INK, ball, box, canvasMat, cone, cyl, flat, mesh, plane, put, rnd, shade, signMat } from "./kit.js";
import { PROFILE } from "./data.js";

export const W = 24, D = 18;
const METAL = "#8a7a9e";
const G = () => new THREE.Group();

const screenMat = () =>
  canvasMat(256, 160, (g, w, h) => {
    g.fillStyle = "#9fd8ff";
    g.fillRect(0, 0, w, h);
    const cols = ["#ff8fb1", "#ffd166", "#7fd18b", "#7b8cff", INK];
    for (let i = 0; i < 7; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(18 + (i % 3) * 14, 18 + i * 19, 40 + rnd(i) * 150, 9);
    }
  }, "screen");

const boardMat = () =>
  canvasMat(512, 320, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#7b8cff";
    g.lineWidth = 6;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(60, 230);
    g.bezierCurveTo(140, 120, 220, 280, 300, 150);
    g.lineTo(290, 175);
    g.moveTo(300, 150);
    g.lineTo(272, 160);
    g.stroke();
    g.fillStyle = "#ff8fb1";
    g.font = `700 54px ${FONT}`;
    g.fillText("ideas ✨", 40, 80);
    for (const [x, y, c] of [[360, 60, "#ffd166"], [420, 150, "#7fd18b"], [350, 220, "#ff9ecf"]]) {
      g.fillStyle = c;
      g.fillRect(x, y, 70, 70);
    }
  }, "whiteboard");

const arcadeMat = () =>
  canvasMat(128, 128, (g) => {
    g.fillStyle = "#1c1630";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#ffd166";
    g.font = `700 18px ${FONT}`;
    g.textAlign = "center";
    g.fillText("INSERT", 64, 44);
    g.fillText("COIN", 64, 66);
    g.fillStyle = "#ff8fb1";
    for (let i = 0; i < 5; i++) g.fillRect(18 + i * 20, 90, 12, 12);
  }, "arcade");

export const CATALOG = Object.assign(Object.create(null), {
  // ---------- structure ----------
  wall: {
    name: "Wall", icon: "🧱", w: 1, d: 1, color: "#f6f1ff", box: [1, 0.2, 0.4], fade: true, cat: "build",
    build(c) {
      const g = G();
      put(g, box(1, 2.4, 0.2, c, 0.02), 0, 1.2, 0.4);
      put(g, box(1.02, 0.12, 0.22, shade(c, -0.25), 0.02), 0, 0.06, 0.4);
      put(g, box(1.02, 0.06, 0.24, shade(c, -0.1), 0.02), 0, 2.42, 0.4);
      return g;
    },
  },
  window: {
    name: "Window", icon: "🪟", w: 1, d: 1, color: "#f6f1ff", box: [1, 0.2, 0.4], fade: true, cat: "build",
    build(c) {
      const g = G();
      put(g, box(1, 0.9, 0.2, c, 0.02), 0, 0.45, 0.4);
      put(g, box(1, 0.5, 0.2, c, 0.02), 0, 2.15, 0.4);
      put(g, plane(1, 1, flat("#bfe6ff", 0.45)), 0, 1.4, 0.4);
      for (const x of [-0.47, 0, 0.47]) put(g, box(0.06, 1, 0.22, "#ffffff", 0.01), x, 1.4, 0.4);
      put(g, box(1.02, 0.07, 0.3, "#ffffff", 0.02), 0, 0.92, 0.42);
      return g;
    },
  },
  sign: {
    name: "Sign", icon: "🪧", w: 2, d: 1, color: "#ffd166", box: [2, 0.2], text: true, cat: "decor",
    build(c, it) {
      const g = G();
      for (const x of [-0.8, 0.8]) put(g, cyl(0.04, 0.04, 1.3, METAL), x, 0.65, 0);
      put(g, box(1.9, 0.6, 0.08, c), 0, 1.5, 0);
      put(g, plane(1.8, 0.5, signMat(it.text || PROFILE.officeName, shade(c, 0.6), INK, 512, 128, false)), 0, 1.5, 0.045);
      return g;
    },
  },

  // ---------- office ----------
  desk: {
    name: "Desk", icon: "🖥️", w: 2, d: 1, color: "#f4c989", cat: "office",
    build(c) {
      const g = G();
      put(g, box(1.8, 0.08, 0.8, c), 0, 0.72, 0);
      for (const [x, z] of [[-0.82, -0.32], [0.82, -0.32], [-0.82, 0.32], [0.82, 0.32]]) put(g, cyl(0.035, 0.035, 0.7, METAL), x, 0.35, z);
      put(g, box(0.72, 0.46, 0.05, "#3a3350"), 0, 1.1, -0.2);
      put(g, plane(0.64, 0.38, screenMat()), 0, 1.1, -0.172);
      put(g, cyl(0.03, 0.03, 0.2, "#3a3350"), 0, 0.85, -0.22);
      put(g, box(0.25, 0.02, 0.15, "#3a3350"), 0, 0.77, -0.22);
      put(g, box(0.5, 0.03, 0.16, "#f4f1ea"), 0, 0.775, 0.1);
      put(g, cyl(0.05, 0.045, 0.11, "#ff8a7a"), 0.6, 0.815, 0.1);
      put(g, box(0.18, 0.02, 0.24, "#7fd18b"), -0.6, 0.77, 0.05, 0, 0.3);
      return g;
    },
  },
  chair: {
    name: "Chair", icon: "🪑", w: 1, d: 1, color: "#7b8cff", solid: false, action: "sit", seat: 0.5, cat: "office",
    build(c) {
      const g = G();
      put(g, cyl(0.22, 0.22, 0.04, METAL), 0, 0.03, 0);
      put(g, cyl(0.03, 0.03, 0.4, METAL), 0, 0.23, 0);
      put(g, box(0.5, 0.08, 0.5, c, 0.04), 0, 0.46, 0);
      put(g, box(0.5, 0.5, 0.08, c, 0.04), 0, 0.76, -0.22);
      return g;
    },
  },
  whiteboard: {
    name: "Whiteboard", icon: "📋", w: 2, d: 1, color: "#b38cff", box: [1.9, 0.3, -0.25], cat: "office",
    build(c) {
      const g = G();
      for (const x of [-0.85, 0.85]) put(g, cyl(0.04, 0.04, 1.8, c), x, 0.9, -0.25);
      put(g, box(1.8, 1.1, 0.06, "#ffffff"), 0, 1.25, -0.25);
      put(g, plane(1.7, 1.02, boardMat()), 0, 1.25, -0.215);
      put(g, box(1.2, 0.04, 0.1, c), 0, 0.68, -0.2);
      return g;
    },
  },
  bookshelf: {
    name: "Bookshelf", icon: "📚", w: 2, d: 1, color: "#c98b5e", box: [1.9, 0.5, -0.22], cat: "office",
    build(c) {
      const g = G();
      const z = -0.22;
      for (const x of [-0.92, 0.92]) put(g, box(0.06, 1.8, 0.45, c, 0.02), x, 0.9, z);
      for (const y of [0.03, 0.6, 1.2, 1.78]) put(g, box(1.9, 0.05, 0.45, c, 0.02), 0, y, z);
      put(g, box(1.84, 1.76, 0.03, shade(c, 0.35), 0.01), 0, 0.9, z - 0.2);
      const cols = ["#ff8a7a", "#ffd166", "#7b8cff", "#7fd18b", "#ff9ecf", "#6ec6b8", "#f4f1ea"];
      let i = 0;
      for (const y of [0.06, 0.63, 1.23]) {
        for (let x = -0.85; x < 0.78; i++) {
          const bw = 0.06 + rnd(i) * 0.07, bh = 0.3 + rnd(i + 99) * 0.18;
          const tilt = rnd(i + 7) > 0.85 ? 0.25 : 0;
          put(g, box(bw, bh, 0.3, cols[i % cols.length], 0.012), x + bw / 2, y + bh / 2, z, 0, 0, tilt);
          x += bw + 0.012 + tilt * 0.2;
        }
      }
      return g;
    },
  },
  lamp: {
    name: "Floor lamp", icon: "💡", w: 1, d: 1, color: "#ffd166", box: [0.4, 0.4], cat: "decor",
    build(c) {
      const g = G();
      put(g, cyl(0.16, 0.19, 0.05, METAL), 0, 0.025, 0);
      put(g, cyl(0.025, 0.025, 1.4, METAL), 0, 0.72, 0);
      put(g, cyl(0.13, 0.26, 0.3, c), 0, 1.5, 0);
      put(g, ball(0.08, flat("#fff3b0")), 0, 1.38, 0);
      return g;
    },
  },

  // ---------- lounge ----------
  sofa: {
    name: "Sofa", icon: "🛋️", w: 3, d: 1, color: "#ff9ecf", action: "sit", seat: 0.5, cat: "lounge",
    build(c) {
      const g = G();
      put(g, box(2.8, 0.3, 0.85, c, 0.08), 0, 0.25, 0);
      for (const x of [-0.9, 0, 0.9]) put(g, box(0.86, 0.14, 0.62, shade(c, 0.2), 0.06), x, 0.46, 0.08);
      put(g, box(2.8, 0.55, 0.24, c, 0.08), 0, 0.62, -0.31);
      for (const s of [-1, 1]) put(g, box(0.2, 0.45, 0.85, c, 0.08), s * 1.32, 0.4, 0);
      put(g, box(0.34, 0.3, 0.1, "#ffd166", 0.08), -0.9, 0.66, -0.12, -0.2, 0, 0.2);
      return g;
    },
  },
  beanbag: {
    name: "Beanbag", icon: "🫘", w: 1, d: 1, color: "#6ec6b8", solid: false, action: "sit", seat: 0.3, cat: "lounge",
    build(c) {
      const g = G();
      put(g, ball(0.42, c, 24), 0, 0.26, 0).scale.set(1, 0.62, 1);
      put(g, ball(0.28, c, 20), 0, 0.42, -0.2).scale.set(1.1, 0.8, 0.6);
      return g;
    },
  },
  coffee_table: {
    name: "Coffee table", icon: "🍩", w: 1, d: 1, color: "#f4c989", box: [0.9, 0.9], cat: "lounge",
    build(c) {
      const g = G();
      put(g, cyl(0.25, 0.25, 0.03, METAL), 0, 0.015, 0);
      put(g, cyl(0.05, 0.05, 0.4, METAL), 0, 0.2, 0);
      put(g, cyl(0.45, 0.45, 0.06, c, 24), 0, 0.42, 0);
      put(g, mesh(new THREE.TorusGeometry(0.08, 0.04, 10, 18), "#ff9ecf"), 0.1, 0.49, 0, -Math.PI / 2);
      put(g, cyl(0.05, 0.045, 0.11, "#f4f1ea"), -0.15, 0.5, 0.1);
      return g;
    },
  },
  rug: {
    name: "Rug", icon: "🟣", w: 3, d: 3, color: "#b8c1ff", solid: false, cat: "lounge",
    build(c) {
      const g = G();
      put(g, mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.02, 40), c, false), 0, 0.01, 0);
      put(g, mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.022, 40), shade(c, 0.35), false), 0, 0.012, 0);
      put(g, mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.024, 40), c, false), 0, 0.014, 0);
      return g;
    },
  },
  plant: {
    name: "Plant", icon: "🪴", w: 1, d: 1, color: "#e98a6b", box: [0.5, 0.5], cat: "decor",
    build(c) {
      const g = G();
      put(g, cyl(0.21, 0.15, 0.36, c), 0, 0.18, 0);
      put(g, cyl(0.19, 0.19, 0.02, "#6e4527"), 0, 0.36, 0);
      for (const [x, y, z, r] of [[0, 0.62, 0, 0.22], [0.14, 0.52, 0.08, 0.16], [-0.13, 0.54, -0.05, 0.15], [0.02, 0.82, 0.02, 0.12]])
        put(g, ball(r, "#7fd18b"), x, y, z);
      return g;
    },
  },
  tree: {
    name: "Tree", icon: "🌳", w: 1, d: 1, color: "#7fd18b", box: [0.4, 0.4], cat: "decor",
    build(c) {
      const g = G();
      put(g, cyl(0.1, 0.15, 1.1, "#a8703f"), 0, 0.55, 0);
      for (const [x, y, z, r] of [[0, 1.5, 0, 0.6], [0.35, 1.25, 0.1, 0.4], [-0.3, 1.3, -0.1, 0.42], [0.05, 1.95, 0, 0.38]])
        put(g, ball(r, c), x, y, z);
      return g;
    },
  },
  coffee: {
    name: "Coffee bar", icon: "☕", w: 1, d: 1, color: "#b38cff", action: "coffee", cat: "lounge",
    build(c) {
      const g = G();
      put(g, box(0.9, 0.9, 0.8, c), 0, 0.45, 0);
      put(g, box(0.96, 0.05, 0.86, "#f4f1ea"), 0, 0.92, 0);
      put(g, box(0.45, 0.5, 0.4, "#3a3350"), -0.1, 1.2, -0.12);
      put(g, ball(0.03, flat("#ff5a5a"), 8), -0.1, 1.35, 0.09);
      put(g, cyl(0.06, 0.05, 0.12, "#ffffff"), 0.3, 1.0, 0.2);
      return g;
    },
  },
  arcade: {
    name: "Arcade", icon: "🕹️", w: 1, d: 1, color: "#ff8a7a", action: "arcade", cat: "lounge",
    build(c) {
      const g = G();
      put(g, box(0.75, 1.6, 0.7, c), 0, 0.8, -0.05);
      put(g, plane(0.55, 0.45, arcadeMat()), 0, 1.22, 0.31, -0.15);
      put(g, box(0.75, 0.1, 0.3, shade(c, -0.2)), 0, 0.95, 0.38, 0.3);
      put(g, ball(0.05, "#ff5a5a"), -0.15, 1.05, 0.4);
      for (const x of [0.08, 0.2]) put(g, ball(0.035, x > 0.1 ? "#ffd166" : "#7b8cff"), x, 1.0, 0.44);
      put(g, plane(0.65, 0.18, signMat("PORTO!", "#ffd166", INK, 256, 72)), 0, 1.5, 0.305);
      return g;
    },
  },
  cat: {
    name: "Office cat", icon: "🐈", w: 1, d: 1, color: "#ffb366", solid: false, action: "meow", cat: "decor",
    build(c) {
      const g = G();
      const body = put(g, ball(0.22, c), 0, 0.17, 0);
      body.scale.set(1.3, 0.75, 1);
      put(g, ball(0.16, c), 0, 0.3, 0.22);
      for (const s of [-1, 1]) {
        put(g, cone(0.06, 0.1, c, 4), s * 0.08, 0.44, 0.22, 0, Math.PI / 4, -s * 0.3);
        put(g, box(0.05, 0.012, 0.01, flat(INK)), s * 0.06, 0.32, 0.37);
      }
      const tail = put(g, mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 12, Math.PI), c), 0.1, 0.12, -0.24, 0, 0, 0);
      g.userData.tick = (t) => {
        tail.rotation.y = Math.sin(t * 2) * 0.4;
        body.scale.y = 0.75 + Math.sin(t * 1.5) * 0.03;
      };
      return g;
    },
  },

  // ---------- portfolio stations ----------
  projects_board: {
    name: "Projects board", icon: "📌", w: 2, d: 1, color: "#ff9ecf", box: [1.9, 0.3, -0.3], action: "projects", cat: "portfolio",
    build(c) {
      const g = G();
      const z = -0.3;
      for (const x of [-0.85, 0.85]) put(g, cyl(0.04, 0.04, 2.1, c), x, 1.05, z);
      put(g, box(1.8, 1.2, 0.06, "#d9a066"), 0, 1.25, z);
      const cols = ["#b8c1ff", "#ffd6a5", "#caffbf", "#ffadad", "#9fd8ff", "#fdffb6"];
      cols.forEach((col, i) => {
        const x = -0.55 + (i % 3) * 0.55, y = 1.5 - Math.floor(i / 3) * 0.52, r = (rnd(i) - 0.5) * 0.3;
        const p = put(g, box(0.36, 0.42, 0.02, "#ffffff", 0.01), x, y, z + 0.05, 0, 0, r);
        put(p, plane(0.3, 0.28, flat(col)), 0, 0.04, 0.012);
        put(p, ball(0.025, flat("#ff5a5a"), 8), 0, 0.18, 0.02);
      });
      put(g, plane(1.4, 0.34, signMat("✨ PROJECTS ✨", "#ff9ecf")), 0, 2.1, z + 0.02);
      return g;
    },
  },
  trophy_shelf: {
    name: "Experience shelf", icon: "🏆", w: 3, d: 1, color: "#7b8cff", box: [2.8, 0.5, -0.2], action: "experience", cat: "portfolio",
    build(c) {
      const g = G();
      const z = -0.2;
      put(g, box(2.8, 0.9, 0.5, c), 0, 0.45, z);
      put(g, box(2.8, 1.1, 0.06, shade(c, 0.4)), 0, 1.45, z - 0.22);
      put(g, box(2.7, 0.05, 0.3, shade(c, -0.2)), 0, 1.45, z - 0.07);
      const cup = (x, y, s, col) => {
        put(g, box(0.16 * s, 0.06 * s, 0.16 * s, INK), x, y + 0.03 * s, z);
        put(g, cyl(0.03 * s, 0.03 * s, 0.1 * s, col), x, y + 0.11 * s, z);
        put(g, cyl(0.11 * s, 0.05 * s, 0.2 * s, col), x, y + 0.26 * s, z);
        for (const k of [-1, 1]) put(g, mesh(new THREE.TorusGeometry(0.05 * s, 0.015 * s, 6, 12), col), x + k * 0.11 * s, y + 0.28 * s, z);
      };
      cup(-0.9, 0.9, 1.2, "#ffd166");
      cup(0, 0.9, 1.5, "#ffd166");
      cup(0.9, 0.9, 1.1, "#d6dbe8");
      cup(-0.6, 1.475, 0.8, "#e0a070");
      cup(0.6, 1.475, 0.8, "#ffd166");
      put(g, plane(1.5, 0.32, signMat("🏆 EXPERIENCE", "#ffd166")), 0, 1.85, z - 0.18);
      return g;
    },
  },
  about_desk: {
    name: "About-me desk", icon: "👋", w: 2, d: 1, color: "#6ec6b8", action: "about", cat: "portfolio",
    build(c) {
      const g = G();
      put(g, box(1.9, 1.0, 0.7, c, 0.08), 0, 0.5, 0);
      put(g, box(2.0, 0.06, 0.8, shade(c, 0.5)), 0, 1.03, 0);
      put(g, plane(1.5, 0.38, signMat("ABOUT ME 👋", shade(c, 0.6))), 0, 0.6, 0.355);
      put(g, cyl(0.1, 0.12, 0.03, "#ffd166"), 0.6, 1.07, 0.1);
      put(g, ball(0.08, "#ffd166"), 0.6, 1.1, 0.1).scale.y = 0.8;
      put(g, box(0.5, 0.03, 0.34, "#d6dbe8"), -0.4, 1.07, 0);
      put(g, box(0.5, 0.32, 0.03, "#d6dbe8"), -0.4, 1.23, -0.17, -0.25);
      return g;
    },
  },
  mailbox: {
    name: "Contact mailbox", icon: "📮", w: 1, d: 1, color: "#7b8cff", box: [0.5, 0.5], action: "contact", cat: "portfolio",
    build(c) {
      const g = G();
      put(g, cyl(0.05, 0.05, 1, "#a8703f"), 0, 0.5, 0);
      put(g, box(0.4, 0.34, 0.55, c, 0.12), 0, 1.12, 0);
      put(g, plane(0.3, 0.1, signMat("CONTACT", "#fff7e6", INK, 256, 80)), 0, 1.12, 0.28);
      const flag = put(g, G(), 0.22, 1.1, -0.1);
      put(flag, box(0.03, 0.34, 0.03, "#ff5a5a"), 0, 0.12, 0);
      put(flag, box(0.03, 0.12, 0.16, "#ff5a5a"), 0, 0.24, 0.07);
      g.userData.tick = (t) => (flag.rotation.x = Math.sin(t * 3) * 0.15);
      return g;
    },
  },
  // ---------- people & labels ----------
  npc: {
    name: "Office buddy", icon: "🧑‍💼", w: 1, d: 1, color: "#7b8cff", solid: false, action: "talk", text: true, cat: "decor",
    build(c, it) {
      const g = G();
      const n = [...String(it.id || "x")].reduce((a, ch) => a + ch.charCodeAt(0), 0);
      const who = buildCharacter({
        skin: LOOK.skin[n % LOOK.skin.length],
        hair: ["bun", "spiky", "long", "short", "hijab", "cat"][n % 6],
        hairColor: LOOK.hairColor[(n >> 1) % LOOK.hairColor.length],
        shirt: c,
        pants: "#4a5a8a",
        extra: ["headphones", "glasses", "none", "sprout"][n % 4],
      });
      g.add(who.root);
      let last = 0;
      g.userData.tick = (t) => {
        who.update(last ? Math.min(t - last, 0.05) : 0, t, t < (g.userData.waveUntil || 0) ? "wave" : "idle");
        last = t;
      };
      return g;
    },
  },
  floor_label: {
    name: "Floor label", icon: "🏷️", w: 3, d: 1, color: "#5b4a8a", solid: false, text: true, cat: "decor",
    build(c, it) {
      const g = G();
      const mat = canvasMat(512, 128, (ctx, w, h) => {
        ctx.font = `64px 'Patrick Hand', ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 16;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#fff7e6";
        ctx.strokeText(it.text || "Room", w / 2, h / 2, w - 30);
        ctx.fillStyle = c;
        ctx.fillText(it.text || "Room", w / 2, h / 2, w - 30);
      });
      put(g, plane(2.9, 0.72, mat), 0, 0.012, 0, -Math.PI / 2);
      return g;
    },
  },
});

export const ACTION_LABEL = {
  projects: "View projects", experience: "View experience", about: "About me", contact: "Contact",
  sit: "Sit", coffee: "Grab coffee", arcade: "Play arcade", meow: "Pet the cat", talk: "Say hi",
};
const PORTFOLIO = new Set(["projects", "experience", "about", "contact"]);

// tiles covered, center, and collision box (world space) for an item
export function geom(it) {
  const def = CATALOG[it.type];
  const odd = it.rot & 1;
  const w = odd ? def.d : def.w, d = odd ? def.w : def.d;
  const cx = it.x + w / 2, cz = it.z + d / 2;
  const [bw, bd, oz = 0] = def.box || [def.w - 0.1, def.d - 0.1];
  const [ox, oz2] = [[0, oz], [oz, 0], [0, -oz], [-oz, 0]][it.rot & 3];
  const hw = (odd ? bd : bw) / 2, hd = (odd ? bw : bd) / 2;
  return { w, d, cx, cz, minX: cx + ox - hw, maxX: cx + ox + hw, minZ: cz + oz2 - hd, maxZ: cz + oz2 + hd };
}

// One mesh per material instead of dozens of tiny ones: far fewer draw calls (x2 with outlines).
function mergeStatic(g) {
  g.updateMatrixWorld(true);
  const byMat = new Map();
  g.traverse((o) => o.isMesh && (byMat.get(o.material) ?? byMat.set(o.material, []).get(o.material)).push(o));
  const out = G();
  for (const [mat, meshes] of byMat) {
    const geos = meshes.map((m) => {
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") geo.deleteAttribute(k);
      m.geometry.dispose();
      return geo;
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), mat);
    geos.forEach((x) => x.dispose());
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = true;
    out.add(merged);
  }
  return out;
}

export function buildItem(it, ghost = false) {
  const def = CATALOG[it.type];
  let g = def.build(it.color || def.color, it);
  if (!g.userData.tick) g = mergeStatic(g); // animated items keep their moving parts
  const { cx, cz } = geom(it);
  g.position.set(cx, 0, cz);
  g.rotation.y = (it.rot & 3) * (Math.PI / 2);
  g.userData.item = it;
  if (def.fade)
    g.traverse((m) => {
      if (!m.material) return;
      m.material = m.material.clone();
      m.material.userData.own = true;
    });
  const icon = !ghost && (PORTFOLIO.has(def.action) ? def.icon : def.action === "talk" ? "💬" : null);
  if (icon) {
    const el = document.createElement("div");
    el.className = "marker";
    el.innerHTML = "<span></span>"; // CSS2DRenderer owns the outer transform; the bob animates the span
    el.firstChild.textContent = icon;
    put(g, new CSS2DObject(el), 0, def.action === "talk" ? 2.0 : 2.6, 0);
  }
  return g;
}

export function floorColor(x, z) {
  const k = (x + z) % 2;
  if (z <= 7 && x <= 12) return k ? "#f9e3c0" : "#f2d6a8"; // project lab
  if (z <= 7) return k ? "#e6e1ff" : "#d9d1ff"; // hall of experience
  return k ? "#fdf6ec" : "#f3e8d8"; // lobby
}

export function defaultLayout() {
  let n = 0;
  const items = [];
  const add = (type, x, z, rot = 0, extra = {}) => items.push({ id: "d" + n++, type, x, z, rot, ...extra });

  // outer walls (each wall hugs the inward edge of its tile)
  for (let x = 1; x < W - 1; x++) add(x % 3 === 1 ? "window" : "wall", x, 0, 0);
  for (let z = 0; z < D - 1; z++) {
    add(z % 4 === 2 ? "window" : "wall", 0, z, 1);
    add(z % 4 === 2 ? "window" : "wall", W - 1, z, 3);
  }
  for (let x = 1; x < W - 1; x++) if (x !== 11 && x !== 12) add("wall", x, D - 1, 2);
  // inner walls with doorways
  for (let z = 1; z <= 7; z++) add("wall", 12, z, 1);
  for (let x = 1; x < W - 1; x++) if (![5, 6, 20, 21].includes(x)) add("wall", x, 7, 0);

  // project lab
  add("projects_board", 5, 1);
  add("whiteboard", 9, 1);
  add("plant", 1, 1);
  add("plant", 11, 1);
  for (const x of [2, 5, 9]) {
    add("desk", x, 3);
    add("chair", x, 4, 2);
  }
  add("lamp", 1, 6);
  add("beanbag", 3, 6, 2, { color: "#ffd166" });
  add("plant", 11, 6);

  // hall of experience
  add("bookshelf", 13, 1);
  add("trophy_shelf", 15, 1);
  add("bookshelf", 19, 1, 0, { color: "#8a6bd1" });
  add("plant", 22, 1);
  add("rug", 15, 3, 0, { color: "#ffd6a5" });
  add("sofa", 15, 6, 2, { color: "#7b8cff" });
  add("lamp", 22, 6);
  add("plant", 13, 6);

  // lobby
  add("sign", 11, 8, 0, { text: PROFILE.officeName });
  add("about_desk", 11, 10);
  add("mailbox", 14, 15, 2);
  add("plant", 10, 16);
  add("plant", 13, 16);
  add("coffee", 1, 9, 1);
  add("plant", 1, 8);
  add("rug", 3, 11);
  add("coffee_table", 4, 12);
  add("beanbag", 2, 12, 1);
  add("beanbag", 6, 12, 3, { color: "#ff8a7a" });
  add("sofa", 3, 14, 2);
  add("cat", 4, 10);
  add("lamp", 1, 16);
  add("arcade", 22, 9, 3);
  add("arcade", 22, 10, 3, { color: "#7b8cff" });
  for (const x of [16, 19]) {
    add("desk", x, 12);
    add("chair", x, 13, 2, { color: "#ff9ecf" });
  }
  add("plant", 22, 16);

  // room labels + office buddies
  add("floor_label", 5, 5, 0, { text: "Project Lab" });
  add("floor_label", 19, 4, 0, { text: "Experience Hall", color: "#b86e12" });
  add("floor_label", 11, 13, 0, { text: "✨ Lobby ✨", color: "#2f8a7c" });
  add("npc", 12, 9, 0, { text: `Welcome! I'm the receptionist (and part-time plant whisperer 🌱). ${PROFILE.name}'s story is on this desk 👉`, color: "#6ec6b8" });
  add("npc", 4, 2, 0, { text: "Psst… the projects board is right behind me 📌", color: "#ff8a7a" });

  // garden
  for (const [x, z] of [[6, 19], [18, 19], [2, 21], [21, 21], [9, 22], [15, 23]]) add("tree", x, z);
  return { items, floor: {}, size: [W, D] };
}
