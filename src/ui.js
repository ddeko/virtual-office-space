// DOM side: HUD, character creator, portfolio dialog, chat, build panel.
import { LOOK, LOOK_LABELS, randomLook } from "./character.js";
import { CONTACT, EXPERIENCE, PROFILE, PROJECTS } from "./data.js";
import { CATALOG } from "./furniture.js";

export const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const PALETTE = ["#fdf6ec", "#f4f1ea", "#ffd6a5", "#ffd166", "#ffadad", "#ff9ecf", "#ff8a7a", "#caffbf", "#7fd18b", "#6ec6b8", "#9fd8ff", "#b8c1ff", "#7b8cff", "#b38cff", "#c98b5e", "#8a8f9e", "#3a3350"];

export function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2800);
}

let lastPrompt;
export function setPrompt(text) {
  if (text === lastPrompt) return;
  lastPrompt = text;
  const p = $("#prompt");
  p.hidden = !text;
  if (text) p.innerHTML = `<kbd>E</kbd> ${esc(text)}`;
}

export const setOnline = (n) => ($("#online").textContent = n ? `${n} online` : "reconnecting…");
export const setSession = (s) => ($("#session").textContent = `🚪 ${s}`);
export const setView = (v) => ($("#btn-view .lbl").textContent = v === "iso" ? " Iso" : " 3rd person");
const touch = matchMedia("(pointer: coarse)").matches;
if (touch) $("#chat input").placeholder = "Tap to chat…";
export const busy = () =>
  document.activeElement?.matches("input, textarea, select") || !!document.querySelector("dialog[open]") || !$("#creator").hidden;

// ---------- character creator ----------
export function openCreator({ name, look, onChange, onName, onDone, onSkip }) {
  const panel = $("#creator");
  const rows = $("#creator-rows");
  panel.hidden = false;
  rows.innerHTML = "";
  $("#name").value = name;
  $("#name").oninput = () => onName($("#name").value.trim().slice(0, 20) || "guest");
  $("#skip").onclick = () => {
    panel.hidden = true;
    onSkip();
  };
  for (const [key, opts] of Object.entries(LOOK)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label>${LOOK_LABELS[key]}</label><div class="opts"></div>`;
    for (const v of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.k = key;
      b.dataset.v = v;
      b.setAttribute("aria-label", `${LOOK_LABELS[key]} ${v}`);
      if (v.startsWith("#")) {
        b.className = "swatch";
        b.style.background = v;
      } else {
        b.className = "chip";
        b.textContent = v;
      }
      b.onclick = () => {
        look[key] = v;
        sync();
        onChange(look);
      };
      row.lastChild.append(b);
    }
    rows.append(row);
  }
  const sync = () => rows.querySelectorAll("button").forEach((b) => b.classList.toggle("on", look[b.dataset.k] === b.dataset.v));
  sync();
  $("#random").onclick = () => {
    Object.assign(look, randomLook());
    sync();
    onChange(look);
  };
  $("#creator form").onsubmit = (e) => {
    e.preventDefault();
    panel.hidden = true;
    onDone($("#name").value.trim().slice(0, 20) || "guest", look);
  };
}

// ---------- portfolio ----------
const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${text}</a>` : "");
const TABS = {
  about: () => `
    <div class="about">
      <div class="avatar">${esc(PROFILE.avatar)}</div>
      <div><h2>Hi, I'm ${esc(PROFILE.name)}!</h2><p class="role">${esc(PROFILE.role)}</p>
      <p class="tagline">${esc(PROFILE.tagline)}</p></div>
    </div>
    <p>${esc(PROFILE.bio)}</p>
    <div class="tags">${PROFILE.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>`,
  projects: () =>
    `<div class="cards">${PROJECTS.map(
      (p, i) => `
      <article class="card" style="--c:${esc(p.color)};--tilt:${(i % 2 ? 1 : -1) * 0.8}deg">
        <div class="thumb">${esc(p.emoji)}</div>
        <h3>${esc(p.title)} <small>${esc(p.year)}</small></h3>
        <p>${esc(p.desc)}</p>
        <div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        ${link(p.link, "Visit ↗")}
      </article>`,
    ).join("")}</div>`,
  experience: () =>
    `<ol class="timeline">${EXPERIENCE.map(
      (x) => `
      <li><div class="dot">${esc(x.emoji)}</div><div>
        <h3>${esc(x.role)} <small>@ ${esc(x.company)}</small></h3><p class="role">${esc(x.period)}</p>
        <ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div></li>`,
    ).join("")}</ol>`,
  contact: () =>
    `<p>Say hi! I promise to reply faster than the office cat.</p>
     <div class="contacts">${CONTACT.map((c) => link(c.url, `${esc(c.emoji)} ${esc(c.label)}`)).join("")}</div>`,
};

export function openPortfolio(tab = "about") {
  const dlg = $("#portfolio");
  const show = (t) => {
    dlg.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
    $("#portfolio-body").innerHTML = TABS[t]();
  };
  dlg.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  show(tab);
  if (!dlg.open) dlg.showModal();
}

// ---------- chat ----------
export function initChat(onSend) {
  const form = $("#chat"), input = $("#chat input");
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 200);
    input.value = "";
    input.blur();
    if (text) onSend(text);
  };
  input.onkeydown = (e) => {
    if (e.key === "Escape") input.blur();
    if (e.key === "Enter") e.preventDefault(), e.stopPropagation(), form.requestSubmit();
  };
}
export const focusChat = () => $("#chat input").focus();
export function chatLine(name, text) {
  const li = document.createElement("li");
  li.innerHTML = `<b></b> <span></span>`;
  li.firstChild.textContent = name;
  li.lastChild.textContent = text;
  const log = $("#chatlog");
  log.append(li);
  while (log.children.length > 6) log.firstChild.remove();
}

// ---------- build panel ----------
const CATS = { build: "🧱 Build", office: "🖥️ Office", lounge: "🛋️ Lounge", decor: "🪴 Decor", portfolio: "📁 Portfolio" };

export function initBuild(act) {
  const panel = $("#build");
  panel.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => act(b.dataset.a)));
  const tabs = $("#cat-tabs"), grid = $("#catalog");
  const showCat = (cat) => {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.cat === cat));
    grid.innerHTML = "";
    for (const [type, def] of Object.entries(CATALOG)) {
      if (def.cat !== cat) continue;
      const b = document.createElement("button");
      b.innerHTML = `<span>${def.icon}</span>${esc(def.name)}`;
      b.onclick = () => act("place", type);
      grid.append(b);
    }
  };
  for (const [cat, label] of Object.entries(CATS)) {
    const b = document.createElement("button");
    b.dataset.cat = cat;
    b.textContent = label;
    b.onclick = () => showCat(cat);
    tabs.append(b);
  }
  showCat("office");
  panel.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => act("tool", b.dataset.tool)));
  swatches($("#paint-colors"), (c) => act("paint", c), true, "#ffd6a5");
  swatches($("#sel-colors"), (c) => act("color", c));
  $("#sel-text").onfocus = () => act("textstart");
  $("#sel-text").onblur = () => act("textend");
  $("#build-collapse").onclick = () => {
    autoFolded = false;
    fold(!panel.classList.contains("collapsed"));
  };
  if (touch) $("#build-note").textContent = "Tap to place, drag to pan, pinch to zoom. Only the owner can save. Visitors, go wild, it's just for you 🙃";
  $("#sel-text").oninput = (e) => act("text", e.target.value.slice(0, 120));
  for (const id of ["#lot-w", "#lot-d"]) $(id).onchange = () => act("lot", [+$("#lot-w").value, +$("#lot-d").value]);
}

function swatches(el, pick, eraser, initial) {
  const add = (b, value) => {
    b.onclick = () => {
      el.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("on", s === b));
      pick(value);
    };
    el.append(b);
  };
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = c;
    b.setAttribute("aria-label", c);
    b.classList.toggle("on", c === initial);
    add(b, c);
  }
  if (!eraser) return;
  for (const [text, value, title] of [["↺", null, "Back to default color"], ["🌱", "none", "Remove tile (grass)"]]) {
    const b = document.createElement("button");
    b.className = "swatch eraser";
    b.textContent = text;
    b.title = title;
    b.setAttribute("aria-label", title);
    add(b, value);
  }
}

export function showBuild(on) {
  $("#build").hidden = !on;
  document.body.classList.toggle("building", on);
  $("#btn-build").setAttribute("aria-pressed", on);
  $("#btn-view").disabled = on; // build mode is always iso
}
// on phones, picking an item folds the sheet away so you can see where to tap; it unfolds when you're done
let autoFolded = false;
function fold(collapsed) {
  $("#build").classList.toggle("collapsed", collapsed);
  $("#build-collapse").textContent = collapsed ? "▴" : "▾";
  $("#build-collapse").setAttribute("aria-expanded", !collapsed);
}
export function showPlacing(on) {
  $("#placing-bar").hidden = !on;
  const narrow = matchMedia("(max-width: 640px)").matches;
  if (on && narrow && !$("#build").classList.contains("collapsed")) fold((autoFolded = true));
  if (!on && autoFolded) fold((autoFolded = false));
}
const TOOL_HINT = {
  select: "Click an item to pick it. R rotates, Del deletes.",
  paint: "Drag over the floor to paint. 🌱 removes tiles so you can shape the floor.",
  wall: "Drag along the grid lines to draw a wall.",
  room: "Drag a rectangle to build a room (walls + floor in the picked color).",
  erase: "Drag along a wall to knock it down (great for doorways).",
};
export function setTool(tool) {
  $("#build").querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === tool));
  $("#paint-colors").hidden = tool !== "paint" && tool !== "room";
  $("#cat-tabs").hidden = $("#catalog").hidden = tool !== "select"; // furniture only makes sense with Select
  $("#tool-hint").textContent = TOOL_HINT[tool];
}
export function setLot([w, d]) {
  $("#lot-w").value = w;
  $("#lot-d").value = d;
}
export function setHistory(canUndo, canRedo) {
  $("[data-a=undo]").disabled = !canUndo;
  $("[data-a=redo]").disabled = !canRedo;
}
export function showSelection(it) {
  const box = $("#selection");
  box.hidden = !it;
  if (!it) return;
  const def = CATALOG[it.type];
  $("#sel-name").textContent = `${def.icon} ${def.name}`;
  $("#sel-text").hidden = !def.text;
  $("#sel-text").value = it.text || "";
  $("[data-a=swap]").hidden = it.type !== "wall" && it.type !== "window";
}

$("#office-name").textContent = PROFILE.officeName;
document.title = `${PROFILE.officeName} · Portfolio`;
