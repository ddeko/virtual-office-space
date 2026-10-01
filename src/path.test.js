import { expect, test } from "bun:test";
import { findPath, lineOfSight, makeGrid } from "./path.js";

// a wall from x=0..8 at z=5 with a gap at x 8..10; walk from (2,2) to (2,8)
const wall = { minX: 0, maxX: 8, minZ: 4.9, maxZ: 5.1 };
const g = makeGrid([wall], 0, 0, 10, 10, 0.3);

test("walks around the wall through the gap", () => {
  const p = findPath(g, { x: 2, z: 2 }, { x: 2, z: 8 });
  expect(p).not.toBeNull();
  expect(p.at(-1)).toEqual({ x: 2, z: 8 });
  expect(p.some((w) => w.x > 8)).toBe(true); // detoured through the gap
  let prev = { x: 2, z: 2 };
  for (const w of p) {
    expect(lineOfSight(g, prev, w)).toBe(true); // every leg is walkable
    prev = w;
  }
});

test("straight line when nothing is in the way", () => {
  expect(findPath(g, { x: 2, z: 1 }, { x: 6, z: 2 })).toEqual([{ x: 6, z: 2 }]);
});

test("unreachable goal returns null", () => {
  const box = [
    { minX: 3, maxX: 7, minZ: 2.9, maxZ: 3.1 },
    { minX: 3, maxX: 7, minZ: 6.9, maxZ: 7.1 },
    { minX: 2.9, maxX: 3.1, minZ: 3, maxZ: 7 },
    { minX: 6.9, maxX: 7.1, minZ: 3, maxZ: 7 },
  ];
  expect(findPath(makeGrid(box, 0, 0, 10, 10, 0.3), { x: 1, z: 1 }, { x: 5, z: 5 })).toBeNull();
});
