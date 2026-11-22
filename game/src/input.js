// VELVET VAULT — input.js
// Keyboard + mouse, nothing else. Tracks held keys, edge-triggered tool keys,
// and click-to-move targets in canvas coordinates. main.js polls this every
// frame; it never touches game state itself.
export function makeInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed by main.js each frame
  let clickTarget = null;
  let mouse = { x: 0, y: 0 };

  function keyName(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return k;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });

  return {
    // -1..1 movement vector from WASD / arrows.
    moveVector() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    sneaking() {
      return keys.has('Shift');
    },
    holdingPickup() {
      return keys.has('e');
    },
    // Edge-triggered tool keys, consumed once per frame by the caller.
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    // Click-to-move target, consumed once.
    takeClickTarget() {
      const t = clickTarget;
      clickTarget = null;
      return t;
    },
    mousePos() { return mouse; },
  };
}
