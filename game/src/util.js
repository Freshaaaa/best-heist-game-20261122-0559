// VELVET VAULT — util.js
// Small math + geometry helpers shared by every system. No game state lives here.
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

// Shortest angular difference, wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// True when point (px,py) sits inside rect {x,y,w,h}.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// Circle (cx,cy,r) vs axis-aligned rect: true when they overlap.
export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Segment (x1,y1)-(x2,y2) vs rect: true when the segment touches the rect.
// Uses the slab method so a ray that starts inside the rect also counts.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1, dy = y2 - y1;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx, t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy, t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Line of sight: true when no blocker rect sits between (x1,y1) and (x2,y2).
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  for (const b of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, b)) return false;
  }
  return true;
}

// True when point (px,py) is inside the vision cone of an observer at
// (ox,oy) facing `facing` radians, with half-angle `half` and range `range`.
export function inVisionCone(ox, oy, facing, half, range, px, py) {
  const d = dist(ox, oy, px, py);
  if (d > range) return false;
  if (d < 14) return true; // point-blank: always seen
  const a = angleTo(ox, oy, px, py);
  return Math.abs(angleDiff(facing, a)) <= half;
}

// Move a circle against a list of rects, axis by axis, so it slides along walls.
export function moveCircle(x, y, r, dx, dy, solids) {
  let nx = x + dx;
  for (const s of solids) {
    if (circleHitsRect(nx, y, r, s)) {
      nx = dx > 0 ? s.x - r - 0.01 : dx < 0 ? s.x + s.w + r + 0.01 : nx;
      if (circleHitsRect(nx, y, r, s)) nx = x; // wedged: stay put
    }
  }
  let ny = y + dy;
  for (const s of solids) {
    if (circleHitsRect(nx, ny, r, s)) {
      ny = dy > 0 ? s.y - r - 0.01 : dy < 0 ? s.y + s.h + r + 0.01 : ny;
      if (circleHitsRect(nx, ny, r, s)) ny = y;
    }
  }
  return { x: nx, y: ny };
}

// Format seconds as M:SS for the heist timer.
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// Format dollars with a thousands separator: 5400 -> $5,400.
export function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US');
}
