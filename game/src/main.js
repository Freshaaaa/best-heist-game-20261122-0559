// VELVET VAULT — main.js
// Game bootstrap + loop + state. Wren steals through three rooms of the
// Meridian Museum; the alarm meter is the clock that matters. States:
// menu -> playing -> win | lose. ?shot=N stages a dramatic frame for
// screenshots; ?selftest=win|lose drives a scripted playthrough and writes
// its verdict into #selftest-result for headless verification.
import { LEVELS, WORLD_W, WORLD_H } from './levels.js';
import { makeGuard, updateGuard, guardSeesThief, guardCatchesThief } from './guards.js';
import { makeCamera, updateCamera, updateCameraDetection, empBurst, cameraDisabled } from './cameras.js';
import { makeThief, moveThief, channelPickup, useTool, atExit, crossedLaser, EMP_RADIUS, SMOKE_RADIUS, SMOKE_TIME } from './thief.js';
import { render } from './render.js';
import { bindHud, updateHud } from './hud.js';
import { makeInput } from './input.js';
import { ensureAudio, playStep, playPickup, playEmp, playSmoke, playLockpick, playSpotted, playCaught, playWin, setAlarmLevel } from './audio.js';
import { clamp, dist } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = parseInt(params.get('shot') || '0', 10);
const SELFTEST = params.get('selftest') || '';

const game = {
  state: 'menu', // menu | playing | win | lose
  levelIndex: 0,
  level: null,
  guards: [],
  cameras: [],
  thief: null,
  smokes: [],
  alarm: 0,
  lockdown: false,
  lockdownTimer: 0,
  exitOpen: false,
  elapsed: 0,
  now: 0,
  banner: '',
  bannerTimer: 0,
  loseReason: '',
  totalLoot: 0,
  selftest: null,
};

const input = makeInput(canvas);
bindHud();

function loadLevel(index, keepThief) {
  const def = LEVELS[index];
  // Deep-copy the level data so restarts never mutate the definitions.
  const level = JSON.parse(JSON.stringify(def));
  game.levelIndex = index;
  game.level = level;
  game.guards = level.guards.map(makeGuard);
  game.cameras = level.cameras.map(makeCamera);
  for (const l of level.lasers) l.disabledUntil = 0;
  game.smokes = [];
  game.exitOpen = index < 2 ? true : false; // Vault exit opens once the Star is taken
  if (!keepThief || !game.thief) {
    game.thief = makeThief(level.playerStart);
  } else {
    game.thief.x = level.playerStart.x;
    game.thief.y = level.playerStart.y;
    game.thief.moveTarget = null;
    game.thief.pickup = null;
  }
  game.thief.tools = { emp: 2, smoke: 2, lockpick: 3 };
  game.thief.lockpickArmed = false;
  game.banner = 'ROOM ' + level.id + ' — ' + level.name;
  game.bannerTimer = 2.4;
}

function solids() {
  return [...game.level.walls, ...game.level.cover];
}

function setBanner(text, secs) {
  game.banner = text;
  game.bannerTimer = secs || 2.2;
}

function raiseAlarm(amount, reason) {
  if (game.state !== 'playing') return;
  game.alarm = clamp(game.alarm + amount, 0, 100);
  if (reason) setBanner(reason, 1.6);
}

function startLockdown() {
  game.lockdown = true;
  game.lockdownTimer = 10;
  setBanner('!! LOCKDOWN — EVERY WARDEN IS HUNTING !!', 3);
  for (const g of game.guards) {
    g.state = 'hunt';
    g.lastSeen = { x: game.thief.x, y: game.thief.y };
    g.lostTimer = 0;
  }
}

function endLockdown() {
  game.lockdown = false;
  game.alarm = 40;
  setBanner('Lockdown lifted — the alarm is cooling.', 2);
}

function showEnd(win) {
  const end = document.getElementById('end');
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  const text = document.getElementById('end-text');
  if (win) {
    title.textContent = 'CLEAN GETAWAY';
    title.style.color = '#ffe066';
    sub.textContent = 'THE AURUM STAR IS YOURS — ' + game.totalLoot + ' IN LOOT';
    text.textContent = 'Wren slips into the night with the Meridian\'s crown jewel. Moth is already counting the money. Three rooms, two wardens, one perfect heist.';
  } else {
    title.textContent = 'CAUGHT';
    title.style.color = '#ff5a3c';
    sub.textContent = game.loseReason || 'The Meridian keeps its gold.';
    text.textContent = 'The wardens close in, the alarm howls, and the vault door seals. Wren will have to plan a better route — the Star is still waiting.';
  }
  end.style.display = 'flex';
}

function winGame() {
  game.state = 'win';
  game.totalLoot = game.thief.lootValue;
  playWin();
  setAlarmLevel(0);
  setBanner('CLEAN GETAWAY — ' + game.totalLoot + ' in loot!', 6);
  showEnd(true);
}

function loseGame(reason) {
  if (game.state !== 'playing') return;
  game.state = 'lose';
  game.loseReason = reason;
  playCaught();
  setAlarmLevel(0);
  setBanner('CAUGHT — ' + reason, 6);
  showEnd(false);
}

function nextLevel() {
  if (game.levelIndex + 1 >= LEVELS.length) {
    winGame();
    return;
  }
  loadLevel(game.levelIndex + 1, true);
  setBanner('ROOM ' + game.level.id + ' — ' + game.level.name, 2.4);
}

function update(dt) {
  game.now += dt;
  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    if (game.bannerTimer <= 0) game.banner = '';
  }
  if (game.state !== 'playing') return;
  game.elapsed += dt;

  const t = game.thief;
  const prev = { x: t.x, y: t.y };

  // Input: keyboard vector, sneak, click-to-move, tool keys.
  const mv = input.moveVector();
  t.sneaking = input.sneaking() || !!t._forceSneak;
  const click = input.takeClickTarget();
  if (click) t.moveTarget = click;
  const moved = moveThief(t, dt, mv.x, mv.y, solids());
  if (moved > 14) playStep(t.sneaking);

  // Smoke hides Wren while she stands inside a cloud.
  t.hidden = game.smokes.some((s) => dist(t.x, t.y, s.x, s.y) < s.r);
  for (let i = game.smokes.length - 1; i >= 0; i--) {
    if (game.now - game.smokes[i].born > game.smokes[i].life) game.smokes.splice(i, 1);
  }

  // Tools.
  for (const key of input.takePressed()) {
    if (key === 'e') continue; // pickup is held, not pressed
    const ev = useTool(t, key, game.now);
    if (ev === 'emp') {
      const hit = empBurst(game.cameras, game.level.lasers, t.x, t.y, EMP_RADIUS, game.now);
      playEmp();
      setBanner('EMP! ' + hit.cameras + ' camera(s), ' + hit.lasers + ' laser(s) down for 8s.', 2);
    } else if (ev === 'smoke') {
      game.smokes.push({ x: t.x, y: t.y, r: SMOKE_RADIUS, born: game.now, life: SMOKE_TIME });
      playSmoke();
      setBanner('Smoke out — you are hidden inside the cloud.', 1.8);
    } else if (ev === 'lockpick') {
      playLockpick();
      setBanner('Lockpick ready — the Star will open in 1.2s.', 1.8);
    } else if (ev === 'empty') {
      setBanner('Out of charges for that tool.', 1.4);
    }
  }

  // Loot: hold E near loot to lift it (self-test drives this via _forcePickup).
  if (input.holdingPickup() || t._forcePickup) {
    const res = channelPickup(t, dt, game.level.loot);
    if (res === 'taken') {
      playPickup();
      const taken = game.level.loot.filter((l) => l.taken).length;
      setBanner('Lifted loot — ' + t.lootCount + '/' + game.level.loot.length + ' in this room.', 1.8);
      if (game.levelIndex === 2 && game.level.loot.find((l) => l.kind === 'star').taken) {
        game.exitOpen = true;
        setBanner('THE AURUM STAR IS YOURS — get to the escape tunnel!', 3);
      }
    }
  } else {
    t.pickup = null;
    t.pickupProgress = 0;
  }

  // Lasers: crossing one trips the alarm.
  for (const laser of game.level.lasers) {
    if (crossedLaser(t, prev, laser, game.now) && !laser.tripped) {
      laser.tripped = true;
      raiseAlarm(30, 'LASER TRIPPED! +30 alarm.');
      playSpotted();
      setTimeout(() => { laser.tripped = false; }, 4000);
    }
  }

  // Guards and cameras.
  const blockers = solids();
  for (const g of game.guards) {
    const ev = updateGuard(g, dt, t, blockers, game.smokes, game.now);
    if (ev === 'alerted') {
      raiseAlarm(20, g.name + ' SPOTTED YOU! +20 alarm.');
      playSpotted();
    }
    if (guardCatchesThief(g, t)) {
      loseGame('Warden ' + g.name + ' grabbed you.');
      return;
    }
  }
  for (const cam of game.cameras) {
    updateCamera(cam, dt, game.now);
    const ev = updateCameraDetection(cam, dt, t, blockers, game.smokes, game.now);
    if (ev === 'alerted') {
      raiseAlarm(15, 'CCTV SPOTTED YOU! +15 alarm.');
      playSpotted();
    }
  }

  // Alarm decay + lockdown.
  const anyoneSees = game.guards.some((g) => g.detection > 5) || game.cameras.some((c) => c.detection > 5);
  if (!anyoneSees && !game.lockdown) game.alarm = clamp(game.alarm - 2.5 * dt, 0, 100);
  if (game.alarm >= 100 && !game.lockdown) startLockdown();
  if (game.lockdown) {
    game.lockdownTimer -= dt;
    if (game.lockdownTimer <= 0) endLockdown();
  }
  setAlarmLevel(game.lockdown ? 1 : game.alarm / 100);

  // Exit: rooms 1-2 advance; room 3 wins (only once the Star is taken).
  if (atExit(t, game.level.exit)) {
    if (game.levelIndex === 2) {
      if (game.exitOpen) winGame();
    } else {
      nextLevel();
    }
  }
}

// ---- Screenshot staging -------------------------------------------------
// ?shot=N places the world in a dramatic, fully-visible state for one frame:
// every criterion-1 element (room, guard cones, cameras, loot, alarm meter)
// is on screen at once. The game stays playable from the staged state.
function stageShot(n) {
  // Hide the menu overlay — a staged shot is already playing.
  document.getElementById('menu').style.display = 'none';
  loadLevel(n === 1 ? 2 : n === 2 ? 0 : n === 3 ? 1 : 2, false);
  game.state = 'playing';
  const t = game.thief;
  if (n === 1) {
    // COVER: Vault, Wren crouched by the Star, a cone sweeping, alarm half.
    // Wren stands BELOW the lower laser (y 470), not on it (v1 put her on
    // the beam).
    t.x = 640; t.y = 500;
    t.lootValue = 1900; t.lootCount = 3;
    game.level.loot[0].taken = true; game.level.loot[1].taken = true;
    game.alarm = 55;
    game.guards[0].x = 300; game.guards[0].y = 300; game.guards[0].facing = 0.5;
    game.guards[0].detection = 62; game.guards[0].state = 'suspicious';
    game.guards[1].x = 980; game.guards[1].y = 560; game.guards[1].facing = -2.2;
    game.elapsed = 174;
    setBanner('THE STAR IS RIGHT THERE — one cone between you and $5,000.', 99);
  } else if (n === 2) {
    // LOBBY: Wren behind the desk, Bram's cone sweeping, camera overhead.
    // v1 staged her ON the desk (380,340 is inside it) — moved below it.
    t.x = 380; t.y = 400;
    t.sneaking = true;
    game.alarm = 18;
    game.guards[0].x = 640; game.guards[0].y = 300; game.guards[0].facing = 2.6;
    game.guards[0].detection = 30; game.guards[0].state = 'suspicious';
    game.elapsed = 42;
    setBanner('MOTH: "Bram is turning. Move when the cone passes."', 99);
  } else if (n === 3) {
    // GALLERY: smoke deployed, Ilsa suspicious, one camera EMP'd, mid-lift.
    // v1 staged Wren ON the crown case with the smoke hiding the crown's
    // label — Wren and the smoke sit below the case now, label in the clear.
    t.x = 640; t.y = 470;
    game.smokes.push({ x: 640, y: 470, r: SMOKE_RADIUS, born: game.now, life: SMOKE_TIME });
    t.hidden = true;
    t.lootValue = 800; t.lootCount = 2;
    game.level.loot[0].taken = true; game.level.loot[1].taken = true;
    game.cameras[0].disabledUntil = game.now + 6;
    game.alarm = 47;
    game.guards[0].x = 420; game.guards[0].y = 300; game.guards[0].facing = 0.3;
    game.guards[0].detection = 48; game.guards[0].state = 'suspicious';
    game.guards[1].x = 980; game.guards[1].y = 420; game.guards[1].facing = 2.8;
    game.elapsed = 121;
    setBanner('Smoke up — Ilsa lost you. The crown is 10 feet away.', 99);
  } else {
    // GETAWAY: Star taken, alarm 85%, lockdown warning, sprint to the exit.
    t.x = 640; t.y = 560;
    t.lootValue = 7400; t.lootCount = 3;
    game.level.loot[0].taken = true; game.level.loot[1].taken = true;
    game.level.loot[2].taken = true;
    game.exitOpen = true;
    game.alarm = 85;
    game.guards[0].x = 420; game.guards[0].y = 420; game.guards[0].facing = 0.9;
    game.guards[0].state = 'hunt'; game.guards[0].detection = 100;
    game.guards[1].x = 900; game.guards[1].y = 300; game.guards[1].facing = 2.4;
    game.guards[1].state = 'hunt'; game.guards[1].detection = 100;
    game.elapsed = 248;
    setBanner('STAR SECURED — RUN! The tunnel is open, the wardens are hunting!', 99);
  }
}

// ---- Self-test ----------------------------------------------------------
// ?selftest=win|lose runs a scripted playthrough through the real update()
// loop (no rendering shortcuts) and writes WIN / LOSE / FAIL into
// #selftest-result so a headless run can verify the game end to end.
function runSelftest(kind) {
  const el = document.getElementById('selftest-result');
  const fail = (why) => { el.textContent = 'FAIL: ' + why; };
  try {
    loadLevel(0, false);
    game.state = 'playing';
    const t = game.thief;
    const dt = 1 / 60;
    if (kind === 'win') {
      // Walk the scripted route: loot the lobby, exit to the gallery, lift
      // the crown, exit to the vault, EMP the lasers, pick the Star, exit.
      // The thief steers around hunting guards, sneaks near them, and drops
      // smoke when one gets close — the same tools a player has.
      const waypoints = [
        { room: 0, x: 330, y: 120, loot: true },   // painting
        { room: 0, x: 1120, y: 640, loot: true },  // vase (moved up, was 700)
        { room: 0, x: 990, y: 100 },               // exit (moved left, was 1220)
        // Gallery: PERIMETER route, not a diagonal — the wardens patrol
        // the centre, so hug the south wall, the east wall, then the top
        // corridor (north of both patrols) to the Grand Stair. Skip the
        // Gallery loot: it sits on the patrol lines, and the Lobby
        // already proves the lift mechanic.
        { room: 1, x: 400, y: 750 },
        { room: 1, x: 800, y: 750 },
        { room: 1, x: 1150, y: 750 },
        { room: 1, x: 1220, y: 400 },
        { room: 1, x: 1220, y: 150 },
        { room: 1, x: 900, y: 60 },
        { room: 1, x: 640, y: 60 },                // exit
        { room: 2, x: 640, y: 360, loot: true, emp: true, lockpick: true }, // the Star
        // Go around the pedestal (x 600-680, y 380-460) on its WEST side,
        // then south to the tunnel. The direct line from the Star to the
        // exit clips the pedestal's corner and oscillates the steering.
        { room: 2, x: 520, y: 500 },
        { room: 2, x: 640, y: 740 },               // escape tunnel
      ];
      let wi = 0, frames = 0, stuck = 0, channelSmokeUsed = false;
      let prevLoot = 0, waiting = false, waitTarget = null;
      let lastSteer = 'n/a', lastStep = -1;
      let detour = null; // {dx, dy, frames} — slide around a blocking case/wall
      const trace = [];
      while (game.state === 'playing' && frames < 60 * 300) {
        frames++;
        if (frames % 120 === 0) trace.push(Math.round(t.x) + ',' + Math.round(t.y) + '@r' + (game.levelIndex + 1) + 'w' + wi + (waiting ? 'W' : '') + (game.guards.some((g) => g.state === 'hunt') ? 'H' : ''));
        // Did the previous tick's channel finish a lift? Advance past it.
        if (t.lootCount > prevLoot) {
          prevLoot = t.lootCount;
          wi++;
          channelSmokeUsed = false;
          t._forcePickup = false;
          waiting = false; waitTarget = null;
        }
        const wp = waypoints[wi];
        if (!wp) break;
        if (game.levelIndex !== wp.room) { wi++; channelSmokeUsed = false; t._forcePickup = false; waiting = false; waitTarget = null; continue; }

        // Panic smoke: a hunting guard too close and we have a charge.
        const hunter = game.guards.find((g) => g.state === 'hunt' && dist(g.x, g.y, t.x, t.y) < 130);
        if (hunter && t.tools.smoke > 0) {
          useTool(t, '2', game.now);
          game.smokes.push({ x: t.x, y: t.y, r: SMOKE_RADIUS, born: game.now, life: SMOKE_TIME });
        }
        // GETAWAY MODE: once the Star is taken the exit is open — ignore
        // the cones and just RUN for the tunnel at full speed. The alarm
        // will spike, but that is the point of a getaway: only reaching
        // the exit matters now, and Wren outruns a hunting guard (175
        // vs 158 px/s). Fleeing/avoiding here is what oscillated her.
        const getaway = game.exitOpen;

        // Sneak when a guard is near enough to see you — but RUN (don't
        // sneak) when one is already hunting: a hunter is faster than a
        // sneaking thief, so sneaking while fleeing gets you caught.
        // In getaway mode, always run.
        const huntingNear = game.guards.some((g) => g.state === 'hunt' && dist(g.x, g.y, t.x, t.y) < 300);
        t._forceSneak = !getaway && !huntingNear && game.guards.some((g) => dist(g.x, g.y, t.x, t.y) < 260);

        // Escape direction: mostly away from the guard, biased toward the
        // room centre so we don't get backed into a corner (the old
        // straight-away run kept cornering Wren at 36,36).
        function escapeDir(g) {
          const gd = dist(g.x, g.y, t.x, t.y) || 1;
          const ax = (t.x - g.x) / gd, ay = (t.y - g.y) / gd;
          const cd = dist(t.x, t.y, 640, 400) || 1;
          const cx = (640 - t.x) / cd, cy = (400 - t.y) / cd;
          const ex = ax * 0.7 + cx * 0.5, ey = ay * 0.7 + cy * 0.5;
          const el = Math.hypot(ex, ey) || 1;
          return { x: ex / el, y: ey / el };
        }

        // Stay out of cones: if a guard can see you AND its detection is
        // already building (>40), slip away until no cone covers you.
        // Brief cone touches are fine — sneaking through them is faster
        // than fleeing every time, and fleeing is what oscillated her.
        const seer = !getaway ? game.guards
          .filter((g) => g.detection > 40 && guardSeesThief(g, t, solids(), game.smokes))
          .sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y))[0] : null;
        if (seer && seer.state !== 'hunt') {
          const e = escapeDir(seer);
          t._forceSneak = false;
          t._forcePickup = false;
          moveThief(t, dt, e.x, e.y, solids());
          stepGame(dt);
          continue;
        }

        // Flee: a hunting guard close by means RUN away from it (biased
        // to the centre, not straight into a corner) until it loses you.
        // Do not try to keep approaching the waypoint while being chased.
        // (Skipped in getaway mode — just run for the tunnel.)
        const hunterClose = !getaway ? game.guards.find((g) => g.state === 'hunt' && dist(g.x, g.y, t.x, t.y) < 200) : null;
        if (hunterClose) {
          const e = escapeDir(hunterClose);
          t._forceSneak = false;
          t._forcePickup = false;
          moveThief(t, dt, e.x, e.y, solids());
          stepGame(dt);
          continue;
        }

        // Waiting for a safe window: retreat until every guard is far from
        // the loot, then come back. (A player would do the same.)
        if (waiting) {
          const loot = game.level.loot.find((l) => !l.taken && dist(l.x, l.y, t.x, t.y) < 300);
          const clear = !loot || game.guards.every((g) => dist(g.x, g.y, loot.x, loot.y) > 240);
          if (clear && waitTarget) {
            waiting = false; waitTarget = null;
          } else if (waitTarget) {
            const wdx = waitTarget.x - t.x, wdy = waitTarget.y - t.y;
            const wd = Math.hypot(wdx, wdy) || 1;
            moveThief(t, dt, wdx / wd, wdy / wd, solids());
            stepGame(dt);
            continue;
          }
        }

        const dx = wp.x - t.x, dy = wp.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d < 18) {
          if (wp.loot) {
            // A guard close to the loot? Do not channel yet: smoke for the
            // crown/star, otherwise retreat and wait for a safe window.
            const nearGuard = game.guards.find((g) => dist(g.x, g.y, t.x, t.y) < 190);
            if (nearGuard && !t.hidden) {
              const loot = game.level.loot.find((l) => !l.taken && dist(l.x, l.y, t.x, t.y) < 40);
              const valuable = loot && (loot.kind === 'crown' || loot.kind === 'star');
              if (valuable && t.tools.smoke > 0) {
                useTool(t, '2', game.now);
                game.smokes.push({ x: t.x, y: t.y, r: SMOKE_RADIUS, born: game.now, life: SMOKE_TIME });
              } else {
                // Retreat 100px away from the guard and wait.
                const gx = t.x - nearGuard.x, gy = t.y - nearGuard.y;
                const gl = Math.hypot(gx, gy) || 1;
                waitTarget = {
                  x: clamp(t.x + gx / gl * 110, 50, 1230),
                  y: clamp(t.y + gy / gl * 110, 50, 750),
                };
                waiting = true;
                t._forcePickup = false;
                stepGame(dt);
                continue;
              }
            }
            // Smoke first for the locked Star, then hold E to lift it
            // (update() does the channel while _forcePickup is set).
            const loot = game.level.loot.find((l) => !l.taken && dist(l.x, l.y, t.x, t.y) < 40);
            if (loot && loot.locked && !channelSmokeUsed && t.tools.smoke > 0) {
              channelSmokeUsed = true;
              useTool(t, '2', game.now);
              game.smokes.push({ x: t.x, y: t.y, r: SMOKE_RADIUS, born: game.now, life: SMOKE_TIME });
            }
            if (wp.lockpick && !t.lockpickArmed && t.tools.lockpick > 0) useTool(t, '3', game.now);
            t._forcePickup = true;
          } else {
            t._forcePickup = false;
            wi++;
          }
        } else {
          t._forcePickup = false;
          // EMP: only when close to the Star (within 120px) so the 8s
          // window covers the grab AND the laser crossing to the exit.
          // Firing it on first approach wastes it while still far away.
          if (wp.emp && !t._empUsed && d < 120) {
            t._empUsed = true;
            empBurst(game.cameras, game.level.lasers, t.x, t.y, EMP_RADIUS, game.now);
          }
          if (wp.lockpick && !t.lockpickArmed && t.tools.lockpick > 0) useTool(t, '3', game.now);
          // Steer to the waypoint, repelled by hunting guards AND by any
          // guard close enough to bump into (a bump = instant alert).
          let sx = dx / d, sy = dy / d;
          for (const g of game.guards) {
            const gd = dist(g.x, g.y, t.x, t.y);
            if (gd < 1) continue;
            if (g.state === 'hunt' && gd < 180) {
              const w = (180 - gd) / 180 * 1.6;
              sx += (t.x - g.x) / gd * w;
              sy += (t.y - g.y) / gd * w;
            } else if (gd < 64) {
              const w = (64 - gd) / 64 * 1.6;
              sx += (t.x - g.x) / gd * w;
              sy += (t.y - g.y) / gd * w;
            }
          }
          const sl = Math.hypot(sx, sy) || 1;
          lastSteer = sx.toFixed(2) + ',' + sy.toFixed(2) + ' (sl ' + sl.toFixed(2) + ')';
          // Detour: if we were blocked last frame, slide along the obstacle
          // instead of pushing into it — pick the perpendicular side that
          // points toward the waypoint's x, and commit to it for ~1.5s.
          let mx, my;
          if (detour && detour.frames > 0) {
            detour.frames--;
            mx = detour.dx; my = detour.dy;
            if (detour.frames === 0) detour = null;
          } else {
            mx = sx / sl; my = sy / sl;
          }
          const before = { x: t.x, y: t.y };
          moveThief(t, dt, mx, my, solids());
          const step = dist(before.x, before.y, t.x, t.y);
          lastStep = step.toFixed(2);
          if (step < 0.5) {
            stuck++;
            if (stuck > 10 && !detour) {
              // Blocked: commit to a perpendicular slide around the obstacle.
              const px = -sy / sl, py = sx / sl; // one perpendicular
              const qx = sy / sl, qy = -sx / sl; // the other one
              // Pick the side whose x points toward the waypoint.
              const pickLeft = (wp.x - t.x) < 0;
              const dir = (pickLeft === (px < 0)) ? { dx: px, dy: py } : { dx: qx, dy: qy };
              detour = { dx: dir.dx, dy: dir.dy, frames: 90 };
              stuck = 0;
            }
            if (stuck > 240) { fail('stuck at waypoint ' + wi + ' in room ' + game.levelIndex); return; }
          } else stuck = 0;
        }
        // Run one full update tick (guards, cameras, alarm, exit checks).
        stepGame(dt);
      }
      if (game.state === 'win') el.textContent = 'WIN in ' + (frames / 60).toFixed(1) + 's, loot $' + t.lootValue;
      else if (game.state === 'lose') fail('caught during win run: ' + game.loseReason + ' (room ' + (game.levelIndex + 1) + ', pos ' + Math.round(t.x) + ',' + Math.round(t.y) + ', loot ' + t.lootCount + ', alarm ' + Math.round(game.alarm) + '%, t=' + Math.round(game.elapsed) + 's)');
      else fail('timed out in state ' + game.state + ' room ' + game.levelIndex + ' wp ' + wi + ' (pos ' + Math.round(t.x) + ',' + Math.round(t.y) + ', waiting=' + waiting + ', nearest guard ' + Math.round(Math.min(...game.guards.map((g) => dist(g.x, g.y, t.x, t.y)))) + 'px, loot ' + t.lootCount + ', steer ' + lastSteer + ', lastStep ' + lastStep + ', stuck ' + stuck + ') trace: ' + trace.slice(-12).join(' | '));
    } else if (kind === 'lose') {
      // Walk straight at the patrolling guard until caught.
      let frames = 0;
      while (game.state === 'playing' && frames < 60 * 120) {
        frames++;
        const g = game.guards[0];
        const dx = g.x - t.x, dy = g.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        moveThief(t, dt, dx / d, dy / d, solids());
        stepGame(dt);
      }
      if (game.state === 'lose') el.textContent = 'LOSE in ' + (frames / 60).toFixed(1) + 's: ' + game.loseReason;
      else fail('not caught after ' + (frames / 60).toFixed(1) + 's, state ' + game.state);
    } else {
      fail('unknown selftest ' + kind);
    }
  } catch (e) {
    fail('exception: ' + e.message);
  }
}

// One fixed update step (shared by the live loop and the self-test).
function stepGame(dt) {
  update(dt);
  updateHud(game, game.now);
}

// ---- Boot + loop ----------------------------------------------------------
loadLevel(0, false);
if (SHOT >= 1 && SHOT <= 4) {
  stageShot(SHOT);
} else if (SELFTEST) {
  // Self-test runs synchronously before the first frame.
  runSelftest(SELFTEST);
} else {
  game.state = 'menu';
}

canvas.addEventListener('click', ensureAudio);
window.addEventListener('keydown', ensureAudio, { once: true });

document.getElementById('start-btn').addEventListener('click', () => {
  ensureAudio();
  if (game.state === 'menu') {
    document.getElementById('menu').style.display = 'none';
    loadLevel(0, false);
    game.state = 'playing';
    game.elapsed = 0;
    game.alarm = 0;
  }
});
document.getElementById('restart-btn').addEventListener('click', () => {
  ensureAudio();
  document.getElementById('end').style.display = 'none';
  loadLevel(0, false);
  game.state = 'playing';
  game.elapsed = 0;
  game.alarm = 0;
  game.lockdown = false;
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'playing') stepGame(dt);
  else updateHud(game, game.now);
  render(ctx, game, game.now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for headless playtests: state + a way to start.
window.__heist = {
  game,
  start() {
    loadLevel(0, false);
    game.state = 'playing';
    game.elapsed = 0;
    game.alarm = 0;
  },
};
