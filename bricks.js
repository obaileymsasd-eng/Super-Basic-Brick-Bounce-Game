// ============================================================
// bricks.js: where the bricks are, and how they are drawn
// ============================================================

const BRICK_COLUMNS = 8;
const BRICK_ROWS = 4;
const BRICK_WIDTH = 60;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 6;     // empty space between bricks
const BRICKS_TOP = 50;   // how far down the first row starts
const POWER_UP_TYPES = ["shot", "life", "combo", "wide"];

// Builds the list of bricks. Each brick is an object with an
// x, y, width, and height.
function makeBricks() {
  const list = [];

  // Center the whole block of bricks on the screen.
  const totalWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP;
  const left = (WIDTH - totalWidth) / 2;

  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLUMNS; col++) {
      list.push({
        x: left + col * (BRICK_WIDTH + BRICK_GAP),
        y: BRICKS_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT
      });
    }
  }

  const availableIndices = list.map((_, index) => index);
  for (let count = 0; count < 4; count++) {
    const randomIndex = Math.floor(Math.random() * availableIndices.length);
    const brickIndex = availableIndices.splice(randomIndex, 1)[0];
    const randomType = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    list[brickIndex].powerUp = randomType;
  }

  return list;
}

// Each row gets its own neon color, with a bright edge and soft glow.
function drawBricks() {
  const rowColors = ["#ff477e", "#ff9f43", "#d7ff47", "#39f5ff"];

  for (const brick of bricks) {
    const row = Math.round((brick.y - BRICKS_TOP) / (BRICK_HEIGHT + BRICK_GAP));
    const color = rowColors[row];

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
    ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 2);
    ctx.fillStyle = "rgba(8, 13, 24, 0.38)";
    ctx.fillRect(brick.x + 2, brick.y + brick.height - 4, brick.width - 4, 2);
    ctx.restore();
  }
}

