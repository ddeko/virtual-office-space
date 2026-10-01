// Grid A* for click-to-walk. Obstacles are inflated by the player radius, then the
// path is string-pulled so the character walks straight lines between corners.
// ponytail: grid is rebuilt on every layout change (~25k cells, a few ms); fine for one office.
export const CELL = 0.25;

export function makeGrid(solids, minX, minZ, maxX, maxZ, r) {
  const w = Math.ceil((maxX - minX) / CELL), h = Math.ceil((maxZ - minZ) / CELL);
  const block = new Uint8Array(w * h);
  for (const b of solids) {
    const x0 = Math.max(0, Math.floor((b.minX - r - minX) / CELL)), x1 = Math.min(w - 1, Math.floor((b.maxX + r - minX) / CELL));
    const z0 = Math.max(0, Math.floor((b.minZ - r - minZ) / CELL)), z1 = Math.min(h - 1, Math.floor((b.maxZ + r - minZ) / CELL));
    for (let z = z0; z <= z1; z++) block.fill(1, z * w + x0, z * w + x1 + 1);
  }
  return { w, h, minX, minZ, block };
}

const cellOf = (g, x, z) => [
  Math.min(g.w - 1, Math.max(0, Math.floor((x - g.minX) / CELL))),
  Math.min(g.h - 1, Math.max(0, Math.floor((z - g.minZ) / CELL))),
];
const free = (g, cx, cz) => cx >= 0 && cz >= 0 && cx < g.w && cz < g.h && !g.block[cz * g.w + cx];
const center = (g, i) => ({ x: g.minX + ((i % g.w) + 0.5) * CELL, z: g.minZ + (Math.floor(i / g.w) + 0.5) * CELL });

function nearestFree(g, cx, cz, maxR = 12) {
  if (free(g, cx, cz)) return cz * g.w + cx;
  for (let r = 1; r <= maxR; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++)
        if ((Math.abs(dx) === r || Math.abs(dz) === r) && free(g, cx + dx, cz + dz)) return (cz + dz) * g.w + cx + dx;
  return -1;
}

// nearest walkable spot to (x,z), e.g. to un-stick a spawn point that furniture now covers
export function freeSpot(g, x, z) {
  const i = nearestFree(g, ...cellOf(g, x, z), 40);
  return i < 0 ? { x, z } : center(g, i);
}

export function lineOfSight(g, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const [cx, cz] = cellOf(g, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (!free(g, cx, cz)) return false;
  }
  return true;
}

// Returns waypoints [{x,z}, …] ending at (or next to) `to`, or null if unreachable.
export function findPath(g, from, to) {
  const s = nearestFree(g, ...cellOf(g, from.x, from.z)), e = nearestFree(g, ...cellOf(g, to.x, to.z));
  if (s < 0 || e < 0) return null;
  const n = g.w * g.h, cost = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const ex = e % g.w, ez = (e / g.w) | 0;
  const hr = (i) => {
    const dx = Math.abs((i % g.w) - ex), dz = Math.abs(((i / g.w) | 0) - ez);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  };
  // binary heap of [f, index]
  const heap = [];
  const push = (f, i) => {
    heap.push([f, i]);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };

  cost[s] = 0;
  push(hr(s), s);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === e) break;
    const cx = i % g.w, cz = (i / g.w) | 0;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!free(g, nx, nz)) continue;
        if (dx && dz && (!free(g, cx + dx, cz) || !free(g, cx, cz + dz))) continue; // no corner cutting
        const j = nz * g.w + nx, c = cost[i] + (dx && dz ? 1.4142 : 1);
        if (c < cost[j]) {
          cost[j] = c;
          came[j] = i;
          push(c + hr(j), j);
        }
      }
  }
  if (e !== s && came[e] < 0) return null;

  const cells = [];
  for (let i = e; i !== -1; i = came[i]) cells.push(center(g, i));
  cells.reverse();
  const goalFree = e === nearestFree(g, ...cellOf(g, to.x, to.z)) && free(g, ...cellOf(g, to.x, to.z));
  if (goalFree) cells[cells.length - 1] = { x: to.x, z: to.z };

  // string-pull: keep only the corners we can't see past
  const out = [];
  let cur = { x: from.x, z: from.z }, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--)
      if (lineOfSight(g, cur, cells[j])) {
        far = j;
        break;
      }
    out.push(cells[far]);
    cur = cells[far];
    k = far + 1;
  }
  return out;
}
