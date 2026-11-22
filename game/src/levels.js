// VELVET VAULT — levels.js
// The Meridian Museum in three rooms. Each level is plain data: walls, cover
// (blocks movement AND line of sight), guards, cameras, lasers, loot, exit
// and where Wren starts. Nothing here runs; main.js turns it into a game.
export const WORLD_W = 1280;
export const WORLD_H = 800;

// Loot kinds and what they are worth. The Aurum Star only appears in the Vault.
export const LOOT_KINDS = {
  painting: { label: 'Portrait of the Duchess', value: 400, color: '#d8a24a' },
  vase: { label: 'Celadon Vase', value: 600, color: '#7fd4c1' },
  crown: { label: 'Crown of Saint Anselm', value: 900, color: '#ffd94a' },
  star: { label: 'THE AURUM STAR', value: 5000, color: '#ffe066' },
};

function wall(x, y, w, h) { return { x, y, w, h, kind: 'wall' }; }
function cover(x, y, w, h, kind) { return { x, y, w, h, kind }; }
function loot(x, y, kind, locked) {
  return { x, y, kind, value: LOOT_KINDS[kind].value, locked: !!locked, taken: false, channel: 0 };
}
function guard(name, waypoints, pause) {
  return { name, waypoints, pause: pause || 1.2, speed: 72 };
}
function camera(x, y, baseAngle, sweep, speed) {
  return { x, y, baseAngle, sweep, speed, angle: baseAngle, disabledUntil: 0 };
}
function laser(x1, y1, x2, y2) { return { x1, y1, x2, y2, tripped: false }; }

export const LEVELS = [
  {
    id: 1,
    name: 'LOBBY',
    subtitle: 'The Meridian Museum — ground floor',
    brief: 'Slip past Warden Bram, lift the lobby loot, and reach the service door.',
    playerStart: { x: 90, y: 700 },
    exit: { x: 1180, y: 60, w: 80, h: 90, label: 'SERVICE DOOR' },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 776, 1280, 24),
      wall(0, 0, 24, 800), wall(1256, 0, 24, 800),
      wall(420, 0, 26, 190), wall(840, 610, 26, 190),
    ],
    cover: [
      cover(300, 300, 150, 60, 'desk'),
      cover(700, 180, 170, 60, 'case'),
      cover(180, 130, 90, 90, 'statue'),
      cover(980, 420, 110, 70, 'plant'),
      cover(560, 520, 150, 60, 'case'),
    ],
    guards: [
      guard('Bram', [[640, 420], [640, 180], [980, 180], [980, 560], [400, 560], [400, 300]], 1.4),
    ],
    cameras: [
      camera(640, 26, Math.PI / 2, 0.9, 0.55),
    ],
    lasers: [],
    loot: [
      loot(330, 120, 'painting'),
      loot(1120, 700, 'vase'),
      loot(760, 150, 'painting'),
    ],
    handler: 'MOTH: "Lobby is quiet. One warden, one camera. Grab what you can — the door top-right is your way out."',
  },
  {
    id: 2,
    name: 'GALLERY',
    subtitle: 'The Hall of Kings',
    brief: 'Two wardens, two cameras, three pieces. The crown is worth the risk.',
    playerStart: { x: 90, y: 700 },
    exit: { x: 600, y: 24, w: 80, h: 70, label: 'GRAND STAIR' },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 776, 1280, 24),
      wall(0, 0, 24, 800), wall(1256, 0, 24, 800),
      wall(300, 300, 26, 260), wall(954, 240, 26, 260),
    ],
    cover: [
      cover(200, 140, 170, 60, 'case'),
      cover(910, 140, 170, 60, 'case'),
      cover(555, 340, 170, 60, 'case'),
      cover(200, 600, 150, 60, 'bench'),
      cover(930, 600, 150, 60, 'bench'),
      cover(600, 620, 80, 80, 'statue'),
    ],
    guards: [
      guard('Ilsa', [[200, 420], [200, 180], [640, 180], [640, 420]], 1.2),
      guard('Dario', [[1080, 420], [1080, 180], [640, 520], [1080, 640]], 1.0),
    ],
    cameras: [
      camera(320, 26, Math.PI / 2, 1.0, 0.6),
      camera(960, 774, -Math.PI / 2, 1.0, 0.6),
    ],
    lasers: [],
    loot: [
      loot(250, 110, 'painting'),
      loot(1030, 110, 'painting'),
      loot(640, 330, 'crown'),
    ],
    handler: 'MOTH: "Hall of Kings. Ilsa walks the west wing, Dario the east. The crown sits center — two cones sweep it. Time it."',
  },
  {
    id: 3,
    name: 'VAULT',
    subtitle: 'The Aurum Vault',
    brief: 'The Aurum Star waits on its pedestal. Lasers guard it. Take it and run.',
    playerStart: { x: 90, y: 700 },
    exit: { x: 600, y: 706, w: 80, h: 70, label: 'ESCAPE TUNNEL' },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 776, 1280, 24),
      wall(0, 0, 24, 800), wall(1256, 0, 24, 800),
      wall(420, 200, 26, 220), wall(834, 200, 26, 220),
    ],
    cover: [
      cover(200, 130, 150, 60, 'case'),
      cover(930, 130, 150, 60, 'case'),
      cover(200, 580, 150, 60, 'case'),
      cover(930, 580, 150, 60, 'case'),
      cover(600, 380, 80, 80, 'pedestal'),
    ],
    guards: [
      guard('Bram', [[300, 420], [300, 150], [980, 150], [980, 420]], 0.9),
      guard('Ilsa', [[640, 620], [300, 620], [300, 300], [980, 300], [980, 620]], 0.9),
    ],
    cameras: [
      camera(640, 26, Math.PI / 2, 1.1, 0.7),
      camera(26, 400, 0, 0.9, 0.65),
    ],
    lasers: [
      laser(460, 380, 820, 380),
      laser(460, 470, 820, 470),
    ],
    loot: [
      loot(250, 110, 'vase'),
      loot(1030, 110, 'vase'),
      loot(640, 360, 'star', true),
    ],
    handler: 'MOTH: "The Star is on the pedestal — lasers across it, two wardens, two cameras. EMP the lasers, pick the lock, and RUN."',
  },
];
