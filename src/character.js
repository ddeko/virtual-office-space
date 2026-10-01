// Chibi doodle characters built from primitives.
import * as THREE from "three";
import { INK, ball, box, cone, cyl, flat, mesh, put, toon } from "./kit.js";

export const LOOK = {
  skin: ["#ffe3cc", "#f6c9a0", "#dca574", "#a8703f", "#6e4527"],
  hair: ["short", "spiky", "long", "bun", "hijab", "cat", "bald"],
  hairColor: ["#2b2340", "#6e4527", "#e8a33d", "#ff8fb1", "#7b8cff", "#6ec6b8", "#f4f1ea"],
  shirt: ["#6ec6b8", "#ff8a7a", "#ffd166", "#7b8cff", "#b38cff", "#ff9ecf", "#7fd18b", "#f4f1ea"],
  pants: ["#2b2340", "#4a5a8a", "#6e4527", "#8a8f9e"],
  extra: ["none", "glasses", "headphones", "partyhat", "sprout", "crown"],
};
export const LOOK_LABELS = {
  skin: "Skin", hair: "Hair", hairColor: "Hair / hijab color", shirt: "Shirt", pants: "Pants", extra: "Extra",
};
export const randomLook = () =>
  Object.fromEntries(Object.entries(LOOK).map(([k, v]) => [k, v[(Math.random() * v.length) | 0]]));
// remote looks come off the wire: only accept known styles, or plain hex for colors (NPCs use any color)
const HEX = /^#[0-9a-f]{6}$/i;
const safe = (look = {}) =>
  Object.fromEntries(
    Object.entries(LOOK).map(([k, v]) => [k, v.includes(look[k]) || (v[0].startsWith("#") && HEX.test(look[k])) ? look[k] : v[0]]),
  );

function hair(head, style, c) {
  const soft = toon(c, THREE.DoubleSide);
  const cap = () => {
    const m = mesh(new THREE.SphereGeometry(0.365, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.44), soft);
    m.scale.set(1.05, 0.98, 1.02);
    return put(head, m, 0, 0.02, -0.01, -0.32);
  };
  switch (style) {
    case "short": {
      cap();
      const ahoge = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI * 1.3), c);
      put(head, ahoge, 0.02, 0.4, 0.02, 0, Math.PI / 2, 0.4);
      break;
    }
    case "spiky":
      cap();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        put(head, cone(0.08, 0.2, c, 6), Math.sin(a) * 0.2, 0.3, Math.cos(a) * 0.2 - 0.05, Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
      }
      break;
    case "long":
      cap();
      put(head, box(0.66, 0.62, 0.22, c, 0.1), 0, -0.12, -0.2);
      for (const s of [-1, 1]) put(head, box(0.12, 0.42, 0.14, c, 0.05), s * 0.31, -0.12, 0.08);
      break;
    case "bun":
      cap();
      put(head, ball(0.14, c), 0, 0.37, -0.12);
      break;
    case "hijab":
      put(head, ball(0.375, c, 28), 0, 0.02, -0.05);
      put(head, cyl(0.23, 0.34, 0.3, c), 0, -0.34, -0.02);
      break;
    case "cat":
      cap();
      for (const s of [-1, 1]) {
        put(head, cone(0.1, 0.2, c, 4), s * 0.2, 0.39, 0, 0, Math.PI / 4, -s * 0.35);
        put(head, cone(0.05, 0.1, flat("#ff9ecf"), 4), s * 0.2, 0.37, 0.045, 0, Math.PI / 4, -s * 0.35);
      }
      break;
    case "bald":
      put(head, ball(0.05, flat("#ffffff", 0.7), 8), 0.1, 0.27, 0.15).scale.set(1.4, 0.6, 0.6);
      break;
  }
}

function extra(head, kind) {
  switch (kind) {
    case "glasses":
      for (const s of [-1, 1]) put(head, mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 20), flat(INK)), s * 0.12, 0.02, 0.33);
      put(head, box(0.08, 0.018, 0.018, flat(INK)), 0, 0.03, 0.34);
      break;
    case "headphones":
      put(head, mesh(new THREE.TorusGeometry(0.38, 0.03, 8, 28, Math.PI), "#ff8fb1"), 0, 0.02, 0);
      for (const s of [-1, 1]) put(head, cyl(0.09, 0.09, 0.08, "#ff8fb1"), s * 0.36, 0.0, 0, 0, 0, Math.PI / 2);
      break;
    case "partyhat":
      put(head, cone(0.13, 0.34, "#ff8fb1"), 0.08, 0.46, -0.02, 0, 0, -0.25);
      put(head, ball(0.05, "#ffd166"), 0.125, 0.63, -0.02);
      break;
    case "sprout":
      put(head, cyl(0.012, 0.012, 0.16, "#5aa66a"), 0, 0.42, 0);
      for (const s of [-1, 1]) put(head, ball(0.06, "#7fd18b"), s * 0.06, 0.5, 0, 0, 0, s * 0.6).scale.set(1.4, 0.5, 0.8);
      break;
    case "crown":
      put(head, cyl(0.16, 0.15, 0.08, "#ffd166", 10), 0, 0.37, -0.02);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        put(head, cone(0.035, 0.09, "#ffd166", 4), Math.sin(a) * 0.14, 0.45, Math.cos(a) * 0.14 - 0.02);
      }
      break;
  }
}

export function buildCharacter(rawLook) {
  const L = safe(rawLook);
  const root = new THREE.Group();
  const body = put(root, new THREE.Group());

  const legs = [-1, 1].map((s) => {
    const hip = put(body, new THREE.Group(), s * 0.1, 0.3, 0);
    put(hip, cyl(0.075, 0.07, 0.24, L.pants), 0, -0.12, 0);
    put(hip, ball(0.09, "#3a3350"), 0, -0.26, 0.03).scale.set(1, 0.6, 1.35);
    return hip;
  });
  put(body, mesh(new THREE.CapsuleGeometry(0.2, 0.16, 6, 16), L.shirt), 0, 0.5, 0).scale.set(1.1, 1, 0.9);
  const arms = [-1, 1].map((s) => {
    const sh = put(body, new THREE.Group(), s * 0.25, 0.62, 0);
    put(sh, mesh(new THREE.CapsuleGeometry(0.06, 0.14, 4, 10), L.shirt), 0, -0.1, 0);
    put(sh, ball(0.065, L.skin), 0, -0.22, 0);
    return sh;
  });

  const head = put(body, new THREE.Group(), 0, 0.98, 0);
  put(head, ball(0.34, L.skin, 32), 0, 0, 0).scale.set(1.05, 0.95, 1);
  const eyes = [-1, 1].map((s) => {
    const e = put(head, ball(0.045, flat(INK), 12), s * 0.12, 0.02, 0.305);
    e.scale.set(1, 1.3, 0.6);
    put(e, ball(0.015, flat("#ffffff"), 8), 0.012, 0.018, 0.035);
    return e;
  });
  for (const s of [-1, 1]) put(head, mesh(new THREE.CircleGeometry(0.05, 16), flat("#ff8fa3", 0.6), false), s * 0.19, -0.07, 0.29, 0, s * 0.55);
  put(head, mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI), flat(INK), false), 0, -0.085, 0.322, 0, 0, Math.PI);
  hair(head, L.hair, L.hairColor);
  extra(head, L.extra);

  let phase = 0, blink = 2 + Math.random() * 3, squash = 0;
  const damp = (obj, key, target, k) => (obj[key] += (target - obj[key]) * k);

  function update(dt, t, anim) {
    const k = 1 - Math.exp(-dt * 14);
    const walking = anim === "walk" || anim === "run";
    if (walking) phase += dt * (anim === "run" ? 15 : 10);
    const sw = walking ? Math.sin(phase) : 0;
    const sit = anim === "sit", dance = anim === "dance", wave = anim === "wave";

    legs.forEach((l, i) => damp(l.rotation, "x", sit ? -1.45 : (i ? -sw : sw) * 0.75, k));
    arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      damp(a.rotation, "x", sit ? -0.5 : (i ? sw : -sw) * 0.65, k);
      let z = s * 0.15;
      if (dance) z = s * (1.4 + Math.sin(t * 9 + i * Math.PI) * 0.9);
      if (wave && i) z = 2.6 + Math.sin(t * 14) * 0.35;
      damp(a.rotation, "z", z, k);
    });
    const bob = walking ? Math.abs(Math.sin(phase)) * 0.06 : dance ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
    damp(body.position, "y", (sit ? 0.17 : 0) + bob, k * 1.5);
    damp(body.rotation, "y", dance ? Math.sin(t * 4.5) * 0.5 : 0, k);
    damp(head.rotation, "z", walking ? sw * 0.06 : dance ? Math.sin(t * 9) * 0.15 : 0, k);

    squash = Math.max(0, squash - dt * 4);
    const breathe = anim === "idle" ? Math.sin(t * 2.5) * 0.015 : 0;
    body.scale.set(1 + squash * 0.18, 1 - squash * 0.25 + breathe, 1 + squash * 0.18);

    blink -= dt;
    const closed = blink < 0;
    eyes.forEach((e) => (e.scale.y = closed ? 0.15 : 1.3));
    if (blink < -0.12) blink = 1.5 + Math.random() * 4;
  }

  return { root, update, land: () => (squash = 1), look: L };
}
