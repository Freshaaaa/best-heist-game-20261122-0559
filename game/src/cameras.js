// VELVET VAULT — cameras.js
// CCTV cameras: wall-mounted, sweeping a cone back and forth. A camera that
// sees Wren fills its own detection meter fast and raises the alarm. An EMP
// pulse shuts every camera (and laser) inside its radius for a few seconds.
import { clamp, dist, inVisionCone, hasLineOfSight } from './util.js';

export const CAM_RANGE = 265;
export const CAM_HALF = 0.44; // ~50 degrees total
export const CAM_FILL = 85;    // detection per second inside a camera cone
export const EMP_DURATION = 8; // seconds a camera stays dead after an EMP

export function makeCamera(def) {
  return {
    x: def.x, y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    angle: def.baseAngle,
    disabledUntil: 0,
    detection: 0,       // 0..100, fills while Wren is in the cone
    justAlerted: false, // set for one frame when detection completes
  };
}

export function cameraDisabled(cam, now) {
  return now < cam.disabledUntil;
}

// Sweep the cone: angle oscillates around baseAngle by +/- sweep.
export function updateCamera(cam, dt, now) {
  cam.angle = cam.baseAngle + Math.sin(now * cam.speed) * cam.sweep;
}

// Does this camera see the thief? Disabled cameras see nothing; smoke hides.
export function cameraSeesThief(cam, thief, blockers, smokes, now) {
  if (cameraDisabled(cam, now)) return false;
  if (!inVisionCone(cam.x, cam.y, cam.angle, CAM_HALF, CAM_RANGE, thief.x, thief.y)) return false;
  if (!hasLineOfSight(cam.x, cam.y, thief.x, thief.y, blockers)) return false;
  for (const s of smokes) {
    if (segmentThroughCircle(cam.x, cam.y, thief.x, thief.y, s.x, s.y, s.r)) return false;
  }
  return true;
}

function segmentThroughCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(x1 + dx * t, y1 + dy * t, cx, cy) < r;
}

// Fill or drain the camera's detection meter. Returns 'alerted' once, on the
// frame the meter completes, so main.js can raise the alarm exactly once.
export function updateCameraDetection(cam, dt, thief, blockers, smokes, now) {
  cam.justAlerted = false;
  if (cameraSeesThief(cam, thief, blockers, smokes, now)) {
    cam.detection = clamp(cam.detection + CAM_FILL * dt, 0, 100);
    if (cam.detection >= 100) {
      cam.detection = 40; // cool down after tripping, so one camera can't spam
      cam.justAlerted = true;
      return 'alerted';
    }
  } else {
    cam.detection = clamp(cam.detection - 30 * dt, 0, 100);
  }
  return null;
}

// EMP burst: shut down every camera (and laser) within radius of (x, y).
export function empBurst(cameras, lasers, x, y, radius, now) {
  let hit = 0;
  for (const cam of cameras) {
    if (dist(cam.x, cam.y, x, y) <= radius) {
      cam.disabledUntil = now + EMP_DURATION;
      cam.detection = 0;
      hit++;
    }
  }
  let lasersHit = 0;
  for (const l of lasers) {
    const midX = (l.x1 + l.x2) / 2, midY = (l.y1 + l.y2) / 2;
    if (dist(midX, midY, x, y) <= radius) {
      l.disabledUntil = now + EMP_DURATION;
      lasersHit++;
    }
  }
  return { cameras: hit, lasers: lasersHit };
}
