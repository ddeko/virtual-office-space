// Tiny toon/doodle toolkit shared by characters and furniture.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const INK = "#2b2340";
const NO_OUTLINE = { outlineParameters: { visible: false } };

// 3-step ramp = the flat "doodle" shading
const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const cache = new Map();
const cached = (key, make) => cache.get(key) ?? cache.set(key, make()).get(key);

export const toon = (color, side = THREE.FrontSide) =>
  cached(`t${color}${side}`, () => new THREE.MeshToonMaterial({ color, gradientMap: ramp, side }));
// flat, unlit, no outline: eyes, screens, blush, glow
export const flat = (color, opacity = 1) =>
  cached(`f${color}${opacity}`, () => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    m.userData = NO_OUTLINE;
    return m;
  });

export function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === "string" ? toon(mat) : mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
export const box = (w, h, d, c, r = 0.035) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), c);
export const cyl = (rt, rb, h, c, seg = 18) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c);
export const ball = (r, c, seg = 20) => mesh(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)), c);
export const cone = (r, h, c, seg = 16) => mesh(new THREE.ConeGeometry(r, h, seg), c);
export const plane = (w, h, mat) => mesh(new THREE.PlaneGeometry(w, h), mat, false);

export function put(parent, obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  parent.add(obj);
  return obj;
}

export const shade = (c, amt) => {
  const col = new THREE.Color(c);
  return "#" + (amt > 0 ? col.lerp(new THREE.Color("#fff"), amt) : col.multiplyScalar(1 + amt)).getHexString();
};

// Canvas → flat material. draw(ctx, w, h) paints it.
export function canvasMat(w, h, draw, key) {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    m.userData = { ...NO_OUTLINE, own: !key }; // uncached = owned by its mesh, disposed with it
    return m;
  };
  return key ? cached("c" + key, make) : make();
}

// Free GPU memory for a removed object. Geometries are never shared; cached materials are
// (so only materials flagged `own` are disposed). Also drops CSS2D label elements.
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const m = o.material;
    if (m?.userData?.own) m.map?.dispose(), m.dispose();
    o.element?.remove();
  });
}

export const FONT = "Fredoka, 'Patrick Hand', system-ui, sans-serif";
// cache=false for user-typed text, so every keystroke doesn't leak a texture
export function signMat(text, bg = "#fff7e6", fg = INK, w = 512, h = 128, cache = true) {
  return canvasMat(w, h, (g) => {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 28);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = fg;
    g.font = `700 ${Math.round(h * 0.46)}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4, w - 40);
  }, cache && `sign${text}${bg}${fg}${w}${h}`);
}

// cheap deterministic "random" for doodle variety (books, polaroids…)
export const rnd = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
