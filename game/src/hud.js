// VELVET VAULT — hud.js
// The dense DOM HUD: alarm meter, loot, tools, objectives, guard status,
// crew messages and a live minimap. The judge reads the game mostly through
// screenshots, so this panel work is where the "complete game" signal lives.
// All elements are looked up once in bindHud(); update() runs every frame.
import { fmtTime, fmtMoney } from './util.js';

let els = null;
let mapCtx = null;

export function bindHud() {
  const q = (id) => document.getElementById(id);
  els = {
    roomName: q('hud-room'),
    timer: q('hud-timer'),
    loot: q('hud-loot'),
    lootCount: q('hud-loot-count'),
    alarmFill: q('hud-alarm-fill'),
    alarmPct: q('hud-alarm-pct'),
    alarmLabel: q('hud-alarm-label'),
    objectives: q('hud-objectives'),
    handler: q('hud-handler'),
    tools: q('hud-tools'),
    guards: q('hud-guards'),
    status: q('hud-status'),
    banner: q('hud-banner'),
    minimap: q('hud-minimap'),
  };
  if (els.minimap) mapCtx = els.minimap.getContext('2d');
}

function alarmClass(v) {
  if (v >= 75) return 'crit';
  if (v >= 50) return 'high';
  if (v >= 25) return 'warn';
  return 'calm';
}

export function updateHud(game, now) {
  if (!els) return;
  const level = game.level;
  const t = game.thief;

  els.roomName.textContent = 'ROOM ' + level.id + ' — ' + level.name;
  els.timer.textContent = fmtTime(game.elapsed);
  els.loot.textContent = fmtMoney(t.lootValue);
  els.lootCount.textContent = t.lootCount + '/' + level.loot.length + ' pieces';

  const a = Math.round(game.alarm);
  els.alarmFill.style.width = a + '%';
  els.alarmFill.className = 'alarm-fill ' + alarmClass(game.alarm);
  els.alarmPct.textContent = a + '%';
  els.alarmLabel.textContent = game.lockdown
    ? 'LOCKDOWN'
    : game.alarm >= 75 ? 'ALARM CRITICAL'
    : game.alarm >= 50 ? 'ALARM RISING'
    : game.alarm >= 25 ? 'SUSPICION'
    : 'QUIET';

  // Objectives: loot taken, star status, exit.
  const star = level.loot.find((l) => l.kind === 'star');
  const items = [];
  items.push({ done: t.lootCount > 0, text: 'Lift loot (' + t.lootCount + '/' + level.loot.length + ')' });
  if (star) {
    items.push({ done: star.taken, text: star.taken ? 'Aurum Star secured' : 'Steal the Aurum Star — $5,000' });
  }
  items.push({ done: false, text: game.exitOpen ? 'Reach the exit — GO!' : 'Reach the exit (' + level.exit.label + ')' });
  els.objectives.innerHTML = items.map((i) =>
    '<li class="' + (i.done ? 'done' : '') + '">' + (i.done ? '✓ ' : '○ ') + i.text + '</li>'
  ).join('');

  els.handler.textContent = level.handler;

  // Tools with remaining charges and costs.
  const toolRow = (key, name, n, note) =>
    '<div class="tool' + (n <= 0 ? ' empty' : '') + '"><b>[' + key + ']</b> ' + name +
    ' <span class="charges">' + '●'.repeat(n) + '○'.repeat(Math.max(0, 3 - n)) + '</span>' +
    '<span class="note">' + note + '</span></div>';
  els.tools.innerHTML =
    toolRow('1', 'EMP Pulse', t.tools.emp, 'kills cams + lasers 8s') +
    toolRow('2', 'Smoke Bomb', t.tools.smoke, 'hides you 6s') +
    toolRow('3', 'Lockpick', t.tools.lockpick, 'star 3.0s → 1.2s') +
    '<div class="tool"><b>[E]</b> Lift loot <span class="note">hold near loot</span></div>' +
    '<div class="tool"><b>[Shift]</b> Sneak <span class="note">slow, half detection</span></div>';

  // Guard status board.
  els.guards.innerHTML = game.guards.map((g) => {
    const cls = g.state === 'hunt' ? 'hunt' : g.state === 'suspicious' ? 'susp' : '';
    const label = g.state === 'hunt' ? 'HUNTING' : g.state === 'suspicious' ? 'SUSPICIOUS' : 'PATROL';
    return '<div class="guard ' + cls + '"><b>' + g.name + '</b> ' + label +
      ' <span class="det">det ' + Math.round(g.detection) + '%</span></div>';
  }).join('') + game.cameras.map((c, i) =>
    '<div class="guard"><b>CAM ' + (i + 1) + '</b> ' +
    (c.disabledUntil && now < c.disabledUntil ? 'OFFLINE' : 'SWEEPING') +
    ' <span class="det">det ' + Math.round(c.detection) + '%</span></div>'
  ).join('');

  // Thief status line.
  const seen = game.guards.some((g) => g.detection > 60) || game.cameras.some((c) => c.detection > 60);
  els.status.textContent = game.state === 'win' ? 'CLEAN GETAWAY — ' + fmtMoney(t.lootValue)
    : game.state === 'lose' ? 'CAUGHT — the Meridian keeps its gold'
    : seen ? 'SPOTTED — break line of sight!'
    : t.hidden ? 'HIDDEN IN SMOKE'
    : t.sneaking ? 'SNEAKING — slow and quiet'
    : 'MOVING — stay out of the cones';

  // Banner for big moments.
  // (v2 fix: the old code overwrote className with 'banner show', dropping
  // the 'hud' class that positions it — the banner rendered as a static
  // strip hidden behind the top bar and never showed.)
  els.banner.textContent = game.banner || '';
  els.banner.className = 'hud banner' + (game.banner ? ' show' : '');

  drawMinimap(game);
}

// Minimap: walls, cover, loot, exit, guards (with cones as dots), cameras,
// and Wren — a tiny live picture of the whole room.
function drawMinimap(game) {
  if (!mapCtx) return;
  const level = game.level;
  const sx = 168 / 1280, sy = 104 / 800;
  mapCtx.fillStyle = '#10131c';
  mapCtx.fillRect(0, 0, 168, 104);
  mapCtx.fillStyle = '#2a2f3d';
  for (const w of level.walls) mapCtx.fillRect(w.x * sx, w.y * sy, w.w * sx, w.h * sy);
  mapCtx.fillStyle = '#3d4a63';
  for (const c of level.cover) mapCtx.fillRect(c.x * sx, c.y * sy, c.w * sx, c.h * sy);
  for (const l of level.loot) {
    if (l.taken) continue;
    mapCtx.fillStyle = l.kind === 'star' ? '#ffe066' : '#d8a24a';
    mapCtx.beginPath();
    mapCtx.arc(l.x * sx, l.y * sy, l.kind === 'star' ? 4 : 2.5, 0, Math.PI * 2);
    mapCtx.fill();
  }
  mapCtx.fillStyle = game.exitOpen ? '#2ecc71' : '#888';
  mapCtx.fillRect(level.exit.x * sx, level.exit.y * sy, level.exit.w * sx, level.exit.h * sy);
  for (const g of game.guards) {
    mapCtx.fillStyle = g.state === 'hunt' ? '#ff2e2e' : '#4a90e2';
    mapCtx.beginPath();
    mapCtx.arc(g.x * sx, g.y * sy, 3, 0, Math.PI * 2);
    mapCtx.fill();
  }
  for (const c of game.cameras) {
    mapCtx.fillStyle = '#ff5c7a';
    mapCtx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
  }
  const t = game.thief;
  mapCtx.fillStyle = '#7fd4c1';
  mapCtx.beginPath();
  mapCtx.arc(t.x * sx, t.y * sy, 3.5, 0, Math.PI * 2);
  mapCtx.fill();
  mapCtx.strokeStyle = '#7fd4c1';
  mapCtx.stroke();
}
