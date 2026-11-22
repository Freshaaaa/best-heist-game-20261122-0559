// VELVET VAULT — guards.js
// Night Wardens: patrol waypoints, sweep a vision cone, and hunt Wren when
// they see her. A guard has one job here: decide what it sees and where it
// walks. Detection lives on the guard; the global alarm lives in main.js.
import { clamp, dist, angleTo, angleDiff, inVisionCone, hasLineOfSight, moveCircle } from './util.js';

export const CONE_RANGE = 230;
export const CONE_HALF = 0.62; // ~71 degrees total
export const DETECT_FILL = 45; // detection points per second, point-blank in cone
export const DETECT_DECAY = 26;
export const CHASE_SPEED = 158;
export const CATCH_DIST = 24;

// One guard's live state, built from a level definition.
export function makeGuard(def) {
  const start = def.waypoints[0];
  return {
    name: def.name,
    waypoints: def.waypoints,
    pause: def.pause,
    speed: def.speed,
    x: start[0], y: start[1],
    facing: Math.PI / 2,
    wpIndex: 1,
    waitTimer: 0,
    detection: 0,          // 0..100, fills while Wren is visible
    state: 'patrol',       // patrol | suspicious | hunt
    lastSeen: null,        // {x, y} of Wren when last spotted
    lostTimer: 0,          // seconds since last sighting while hunting
    justAlerted: false,    // set for one frame when detection hits 100
  };
}

// Cone colour by state: calm yellow, suspicious orange, hunting red.
export function coneColor(g) {
  if (g.state === 'hunt') return 'rgba(255, 46, 46, 0.30)';
  if (g.state === 'suspicious' || g.detection > 25) return 'rgba(255, 150, 40, 0.28)';
  return 'rgba(255, 220, 80, 0.22)';
}

// Does this guard see the thief right now? Smoke blocks sight; cover blocks
// line of sight; sneaking halves how fast detection fills.
export function guardSeesThief(g, thief, blockers, smokes) {
  if (!inVisionCone(g.x, g.y, g.facing, CONE_HALF, CONE_RANGE, thief.x, thief.y)) return false;
  if (!hasLineOfSight(g.x, g.y, thief.x, thief.y, blockers)) return false;
  for (const s of smokes) {
    // A smoke cloud between guard and thief hides her entirely.
    if (segmentThroughCircle(g.x, g.y, thief.x, thief.y, s.x, s.y, s.r)) return false;
  }
  return true;
}

function segmentThroughCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t, py = y1 + dy * t;
  return dist(px, py, cx, cy) < r;
}

// One simulation step for a guard. Returns 'alerted' on the frame detection
// completes, so main.js can raise the alarm exactly once per alert.
export function updateGuard(g, dt, thief, blockers, smokes, now) {
  g.justAlerted = false;
  const sees = guardSeesThief(g, thief, blockers, smokes);
  const fillRate = DETECT_FILL * (thief.sneaking ? 0.5 : 1) * (thief.hidden ? 0 : 1);

  if (sees) {
    // Closer = faster detection: point-blank fills in ~1.6s, cone edge ~3s.
    const d = dist(g.x, g.y, thief.x, thief.y);
    const proximity = 1 + (1 - d / CONE_RANGE) * 0.8;
    g.detection = clamp(g.detection + fillRate * proximity * dt, 0, 100);
    g.lastSeen = { x: thief.x, y: thief.y };
    g.lostTimer = 0;
    if (g.detection >= 100 && g.state !== 'hunt') {
      g.state = 'hunt';
      g.justAlerted = true;
      return 'alerted';
    }
    if (g.detection > 25 && g.state === 'patrol') g.state = 'suspicious';
  } else {
    g.detection = clamp(g.detection - DETECT_DECAY * dt, 0, 100);
    if (g.state === 'suspicious' && g.detection <= 5) g.state = 'patrol';
  }

  // Bump rule: a guard who walks right into you notices instantly — but
  // that alert gives you a split second to break away (the fair rule).
  if (g.state !== 'hunt' && !thief.hidden && dist(g.x, g.y, thief.x, thief.y) < 44) {
    g.detection = 100;
    g.state = 'hunt';
    g.lastSeen = { x: thief.x, y: thief.y };
    g.lostTimer = 0;
    g.justAlerted = true;
    return 'alerted';
  }

  if (g.state === 'hunt') {
    // Hunt the last seen spot; give up after 4s without a sighting.
    g.lostTimer += dt;
    if (!sees && g.lostTimer > 4) {
      g.state = 'patrol';
      g.detection = 30;
      g.lastSeen = null;
    } else if (g.lastSeen) {
      const target = sees ? { x: thief.x, y: thief.y } : g.lastSeen;
      g.facing = angleTo(g.x, g.y, target.x, target.y);
      stepToward(g, target.x, target.y, CHASE_SPEED * dt, blockers);
    }
    return null;
  }

  // Patrol: walk waypoints, pause and look around at each one.
  if (g.waitTimer > 0) {
    g.waitTimer -= dt;
    g.facing += Math.sin(now * 1.4 + g.x) * 0.9 * dt; // scan the room
    return null;
  }
  const wp = g.waypoints[g.wpIndex];
  const d = dist(g.x, g.y, wp[0], wp[1]);
  if (d < 8) {
    g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
    g.waitTimer = g.pause;
    return null;
  }
  g.facing = angleTo(g.x, g.y, wp[0], wp[1]);
  stepToward(g, wp[0], wp[1], g.speed * dt, blockers);
  return null;
}

function stepToward(g, tx, ty, step, blockers) {
  const a = angleTo(g.x, g.y, tx, ty);
  const dx = Math.cos(a) * step, dy = Math.sin(a) * step;
  const moved = moveCircle(g.x, g.y, 12, dx, dy, blockers);
  g.x = moved.x; g.y = moved.y;
}

// True when a guard is close enough to grab Wren.
// Only a guard that has actually spotted you (hunting) can grab you.
// A patrolling guard who bumps into you notices instantly — but that
// alert gives you a split second to break away, which is the fair rule.
export function guardCatchesThief(g, thief) {
  return g.state === 'hunt' && dist(g.x, g.y, thief.x, thief.y) < CATCH_DIST;
}
