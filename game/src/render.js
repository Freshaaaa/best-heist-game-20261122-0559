// VELVET VAULT — render.js
// Everything drawn on the canvas: floor, walls, cover, loot, lasers, guards
// and their cones, cameras and their cones, smoke, and Wren. The DOM HUD
// (alarm meter, panels, minimap) lives in hud.js; this file only paints the
// room itself. All coordinates are world coordinates: the room IS the canvas.
import { CONE_RANGE, CONE_HALF, coneColor } from './guards.js';
import { CAM_RANGE, CAM_HALF, cameraDisabled } from './cameras.js';
import { LOOT_KINDS } from './levels.js';

const TILE = 40;

export function render(ctx, game, now) {
  const level = game.level;
  drawFloor(ctx, level);
  drawExit(ctx, level.exit, game);
  drawLasers(ctx, level.lasers, now);
  drawCover(ctx, level.cover);
  // Loot after cover: a gem sits ON its pedestal, a painting hangs above
  // its case — the label must not be buried under the furniture.
  drawLoot(ctx, level.loot, now);
  drawCameras(ctx, level.cameras, now);
  drawGuards(ctx, game.guards, now);
  drawSmokes(ctx, game.smokes, now);
  drawThief(ctx, game.thief, game, now);
  drawPickupChannel(ctx, game);
  drawLockdownVignette(ctx, game);
}

function drawFloor(ctx, level) {
  // Warm marble floor, bright enough to read at a glance on a contact
  // sheet, with a clear tile grid.
  ctx.fillStyle = '#33374a';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = TILE; x < 1280; x += TILE) { ctx.moveTo(x, 0); ctx.lineTo(x, 800); }
  for (let y = TILE; y < 800; y += TILE) { ctx.moveTo(0, y); ctx.lineTo(1280, y); }
  ctx.stroke();
  // Crimson carpet runner down the middle of each room.
  ctx.fillStyle = 'rgba(150, 40, 58, 0.65)';
  ctx.fillRect(600, 24, 80, 752);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.fillRect(596, 24, 4, 752);
  ctx.fillRect(676, 24, 4, 752);
  // Room name stencilled on the floor.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(level.name, 640, 760);
  // Walls: lighter stone with a gold trim line.
  ctx.fillStyle = '#4a5068';
  for (const w of level.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 1256, 776);
}

function drawExit(ctx, exit, game) {
  const open = game.exitOpen;
  const pulse = 0.55 + 0.35 * Math.sin(Date.now() / 280);
  ctx.save();
  ctx.fillStyle = open ? `rgba(46, 204, 113, ${pulse})` : 'rgba(120, 120, 120, 0.5)';
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.strokeStyle = open ? '#2ecc71' : '#888';
  ctx.lineWidth = 3;
  ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
  ctx.fillStyle = '#0d1a12';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : 'EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 - 4);
  ctx.font = '11px Georgia, serif';
  ctx.fillText(exit.label, exit.x + exit.w / 2, exit.y + exit.h / 2 + 14);
  ctx.restore();
}

function drawLoot(ctx, lootList, now) {
  for (const l of lootList) {
    if (l.taken) continue;
    const kind = LOOT_KINDS[l.kind];
    const glow = 0.5 + 0.3 * Math.sin(now * 3 + l.x);
    if (l.kind === 'star') {
      // The Aurum Star: a big glowing gem on its pedestal.
      ctx.save();
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 26 + 14 * glow;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y - 20);
      ctx.lineTo(l.x + 14, l.y - 4);
      ctx.lineTo(l.x + 8, l.y + 16);
      ctx.lineTo(l.x - 8, l.y + 16);
      ctx.lineTo(l.x - 14, l.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff7cc';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('AURUM STAR  $5,000', l.x, l.y + 36);
      if (l.locked) {
        ctx.fillStyle = '#ff9d5c';
        ctx.font = '11px Georgia, serif';
        ctx.fillText('LOCKED — hold E (lockpick: 3)', l.x, l.y + 52);
      }
      continue;
    }
    // Paintings and vases: a gold frame with a glowing item.
    ctx.save();
    ctx.shadowColor = kind.color;
    ctx.shadowBlur = 12 + 8 * glow;
    ctx.fillStyle = kind.color;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(l.x - 16, l.y - 16, 32, 32);
    ctx.restore();
    ctx.fillStyle = '#e8d9a0';
    ctx.font = '10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(kind.label + '  $' + l.value, l.x, l.y + 30);
  }
}

function drawLasers(ctx, lasers, now) {
  for (const l of lasers) {
    const disabled = l.disabledUntil && now < l.disabledUntil;
    ctx.save();
    ctx.strokeStyle = disabled ? 'rgba(120,120,120,0.4)' : 'rgba(255, 40, 40, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash(disabled ? [4, 6] : []);
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!disabled) {
      // Moving dots along the beam so it reads as a live laser.
      const t = (now * 0.35) % 1;
      const px = l.x1 + (l.x2 - l.x1) * t;
      const py = l.y1 + (l.y2 - l.y1) * t;
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCover(ctx, coverList) {
  for (const c of coverList) {
    if (c.kind === 'case') {
      ctx.fillStyle = '#1d2f45';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(127, 212, 193, 0.35)';
      ctx.fillRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    } else if (c.kind === 'statue') {
      ctx.fillStyle = '#4a4f5e';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b93a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    } else if (c.kind === 'desk') {
      ctx.fillStyle = '#5a3d24';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(c.x + 8, c.y + 8, c.w - 16, c.h - 16);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    } else if (c.kind === 'bench') {
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    } else if (c.kind === 'plant') {
      ctx.fillStyle = '#2e4a2e';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#3f7a3f';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'pedestal') {
      ctx.fillStyle = '#3d3a4a';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.kind.toUpperCase(), c.x + c.w / 2, c.y + c.h + 11);
  }
}

function drawCameras(ctx, cameras, now) {
  for (const cam of cameras) {
    const disabled = cameraDisabled(cam, now);
    // Cone.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.arc(cam.x, cam.y, CAM_RANGE, cam.angle - CAM_HALF, cam.angle + CAM_HALF);
    ctx.closePath();
    ctx.fillStyle = disabled
      ? 'rgba(120,120,120,0.10)'
      : cam.detection > 50
        ? 'rgba(255, 60, 60, 0.26)'
        : 'rgba(255, 80, 120, 0.16)';
    ctx.fill();
    ctx.restore();
    // Wall mount + lens.
    ctx.fillStyle = disabled ? '#555' : '#c22e4a';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = disabled ? '#888' : '#ff5c7a';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.angle) * 5, cam.y + Math.sin(cam.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = disabled ? '#999' : '#ff8ba0';
    ctx.font = 'bold 9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(disabled ? 'CAM OFF' : 'CCTV', cam.x, cam.y - 13);
  }
}

function drawGuards(ctx, guards, now) {
  for (const g of guards) {
    // Vision cone.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, CONE_RANGE, g.facing - CONE_HALF, g.facing + CONE_HALF);
    ctx.closePath();
    ctx.fillStyle = coneColor(g);
    ctx.fill();
    ctx.restore();
    // Detection ring while suspicious.
    if (g.detection > 5 && g.state !== 'hunt') {
      ctx.strokeStyle = g.detection > 60 ? '#ff5a3c' : '#ffa028';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 20, -Math.PI / 2, -Math.PI / 2 + (g.detection / 100) * Math.PI * 2);
      ctx.stroke();
    }
    // Body: navy warden with a gold cap line and a facing tick.
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#e8ecf4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * 17, g.y + Math.sin(g.facing) * 17);
    ctx.stroke();
    // Name + state tag.
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    const tag = g.state === 'hunt' ? 'HUNTING!' : g.state === 'suspicious' ? 'SUSPICIOUS' : 'PATROL';
    ctx.fillText(g.name + ' · ' + tag, g.x, g.y - 22);
  }
}

function drawSmokes(ctx, smokes, now) {
  for (const s of smokes) {
    const age = now - s.born;
    const alpha = Math.max(0, 0.55 * (1 - age / s.life));
    ctx.fillStyle = `rgba(180, 185, 195, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(220, 225, 235, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.2, s.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawThief(ctx, thief, game, now) {
  // Soft shadow ring while hidden in smoke.
  if (thief.hidden) {
    ctx.fillStyle = 'rgba(180,185,195,0.25)';
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wren: a hooded figure — dark cloak circle, hood point toward facing.
  ctx.save();
  ctx.translate(thief.x, thief.y);
  ctx.rotate(thief.facing);
  ctx.fillStyle = '#0e0f16';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7fd4c1';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.arc(4, -4, 1.8, 0, Math.PI * 2);
  ctx.arc(4, 4, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#a8f0e0';
  ctx.font = 'bold 10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('WREN' + (thief.sneaking ? ' · SNEAK' : ''), thief.x, thief.y - 20);
  // Move target marker.
  if (thief.moveTarget) {
    ctx.strokeStyle = 'rgba(127, 212, 193, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(thief.moveTarget.x, thief.moveTarget.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPickupChannel(ctx, game) {
  const t = game.thief;
  if (!t.pickup) return;
  const pct = t.pickupProgress / (t.pickup.locked
    ? (t.lockpickArmed ? 1.2 : 3.0)
    : 0.6);
  const w = 90;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(t.x - w / 2 - 4, t.y - 44, w + 8, 16);
  ctx.fillStyle = '#2a2f3d';
  ctx.fillRect(t.x - w / 2, t.y - 40, w, 8);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(t.x - w / 2, t.y - 40, w * Math.min(1, pct), 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(t.pickup.locked ? 'PICKING LOCK…' : 'LIFTING…', t.x, t.y - 48);
}

function drawLockdownVignette(ctx, game) {
  if (!game.lockdown) return;
  const pulse = 0.18 + 0.1 * Math.sin(Date.now() / 160);
  const grad = ctx.createRadialGradient(640, 400, 260, 640, 400, 720);
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(1, `rgba(255, 30, 30, ${pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 800);
  ctx.fillStyle = '#ff2e2e';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('!! LOCKDOWN — RUN !!', 640, 60);
}
