// VELVET VAULT — thief.js
// Wren, the thief: movement, tools and loot. Tools cost charges; loot takes a
// short channel to lift (longer for the locked Aurum Star). Everything here
// is Wren's own state — the world (guards, cameras, alarm) lives elsewhere.
import { clamp, dist, moveCircle, pointInRect } from './util.js';

export const THIEF_RADIUS = 12;
export const WALK_SPEED = 175;
export const SNEAK_SPEED = 95;
export const PICKUP_RANGE = 34;
export const PICKUP_TIME = 0.6;  // seconds to lift ordinary loot
export const STAR_TIME = 3.0;    // seconds to pick the Aurum Star's lock
export const STAR_TIME_LOCKPICKED = 1.2;
export const EMP_RADIUS = 300;
export const SMOKE_RADIUS = 95;
export const SMOKE_TIME = 6;

export function makeThief(start) {
  return {
    x: start.x, y: start.y,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    hidden: false,       // inside smoke: unseen, but also slower to spot from
    moveTarget: null,    // {x, y} set by mouse click
    tools: { emp: 2, smoke: 2, lockpick: 3 },
    lockpickArmed: false, // next locked channel runs fast
    pickup: null,        // loot currently being channelled, or null
    pickupProgress: 0,
    lootValue: 0,
    lootCount: 0,
    steps: 0,            // distance walked, drives footstep sounds
  };
}

// Move Wren by keyboard vector (dx,dy in -1..1) or toward a mouse target.
// Returns distance moved this step (for footstep sounds).
export function moveThief(t, dt, kx, ky, solids) {
  let dx = 0, dy = 0;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky) || 1;
    dx = (kx / len); dy = (ky / len);
    t.moveTarget = null; // keyboard overrides a mouse target
  } else if (t.moveTarget) {
    const d = dist(t.x, t.y, t.moveTarget.x, t.moveTarget.y);
    if (d < 6) {
      t.moveTarget = null;
    } else {
      dx = (t.moveTarget.x - t.x) / d;
      dy = (t.moveTarget.y - t.y) / d;
    }
  }
  const speed = t.sneaking ? SNEAK_SPEED : WALK_SPEED;
  const step = speed * dt;
  const before = { x: t.x, y: t.y };
  const moved = moveCircle(t.x, t.y, THIEF_RADIUS, dx * step, dy * step, solids);
  t.x = moved.x; t.y = moved.y;
  t.moving = (dx !== 0 || dy !== 0) && (t.x !== before.x || t.y !== before.y);
  if (t.moving) {
    t.facing = Math.atan2(dy, dx);
    t.steps += dist(before.x, before.y, t.x, t.y);
  }
  return dist(before.x, before.y, t.x, t.y);
}

// Nearest loot within pickup range, if any.
export function nearestLoot(t, lootList) {
  let best = null, bestD = PICKUP_RANGE;
  for (const l of lootList) {
    if (l.taken) continue;
    const d = dist(t.x, t.y, l.x, l.y);
    if (d < bestD) { best = l; bestD = d; }
  }
  return best;
}

// Channel a loot pickup. Call every frame while the player holds E (or while
// standing on it with auto-channel on). Returns 'taken' when it completes,
// 'channeling' while in progress, null when nothing is in range.
export function channelPickup(t, dt, lootList) {
  const l = nearestLoot(t, lootList);
  if (!l) { t.pickup = null; t.pickupProgress = 0; return null; }
  const need = l.locked
    ? (t.lockpickArmed ? STAR_TIME_LOCKPICKED : STAR_TIME)
    : PICKUP_TIME;
  if (t.pickup !== l) { t.pickup = l; t.pickupProgress = 0; }
  t.pickupProgress += dt;
  if (t.pickupProgress >= need) {
    l.taken = true;
    if (l.locked) t.lockpickArmed = false;
    t.lootValue += l.value;
    t.lootCount += 1;
    t.pickup = null; t.pickupProgress = 0;
    return 'taken';
  }
  return 'channeling';
}

// Use a tool. Returns an event string for main.js ('emp' | 'smoke' | 'lockpick'
// | 'empty'), or null when the key did nothing.
export function useTool(t, key, now) {
  if (key === '1') {
    if (t.tools.emp <= 0) return 'empty';
    t.tools.emp -= 1;
    return 'emp';
  }
  if (key === '2') {
    if (t.tools.smoke <= 0) return 'empty';
    t.tools.smoke -= 1;
    return 'smoke';
  }
  if (key === '3') {
    if (t.tools.lockpick <= 0) return 'empty';
    if (t.lockpickArmed) return null;
    t.tools.lockpick -= 1;
    t.lockpickArmed = true;
    return 'lockpick';
  }
  return null;
}

// True when Wren stands inside the exit doorway.
export function atExit(t, exit) {
  return pointInRect(t.x, t.y, exit);
}

// True when Wren crosses a laser line (and it is not EMP-disabled).
export function crossedLaser(t, prev, laser, now) {
  if (laser.disabledUntil && now < laser.disabledUntil) return false;
  return segmentsCross(prev.x, prev.y, t.x, t.y, laser.x1, laser.y1, laser.x2, laser.y2);
}

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
