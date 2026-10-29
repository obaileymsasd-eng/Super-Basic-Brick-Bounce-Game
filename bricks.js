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
const TNT_FUSE_SECONDS = 1.2;

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
        height: BRICK_HEIGHT,
        row,
        col,
        type: "normal",
        hitsRemaining: 1
      });
    }
  }

  const specialIndices = list.map((_, index) => index);
  for (let count = 0; count < 4; count++) {
    const randomIndex = Math.floor(Math.random() * specialIndices.length);
    const brickIndex = specialIndices.splice(randomIndex, 1)[0];
    list[brickIndex].type = "reinforced";
    list[brickIndex].hitsRemaining = 2;
  }
  const tntIndex = Math.floor(Math.random() * specialIndices.length);
  const tntBrick = list[specialIndices[tntIndex]];
  tntBrick.type = "tnt";
  tntBrick.fuseRemaining = 0;

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
    const color = brick.type === "tnt"
      ? brick.fuseRemaining > 0 ? "#ff477e" : "#ff9f43"
      : rowColors[row];

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

    if (brick.type === "reinforced") {
      ctx.strokeStyle = "rgba(8, 13, 24, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(brick.x + 20, brick.y + 5);
      ctx.lineTo(brick.x + 27, brick.y + 10);
      ctx.lineTo(brick.x + 23, brick.y + 15);
      ctx.stroke();
      ctx.fillStyle = "rgba(8, 13, 24, 0.75)";
      ctx.fillRect(brick.x + brick.width - 13, brick.y + 5, 4, 4);
      if (brick.hitsRemaining === 2) {
        ctx.fillRect(brick.x + brick.width - 19, brick.y + 5, 4, 4);
      }
    } else if (brick.type === "tnt") {
      ctx.save();
      ctx.fillStyle = "rgba(8, 13, 24, 0.55)";
      for (let stripe = -1; stripe < 5; stripe++) {
        ctx.fillRect(brick.x + stripe * 16, brick.y, 7, brick.height);
      }
      ctx.fillStyle = "#fff1d2";
      ctx.font = "700 10px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TNT", brick.x + brick.width / 2, brick.y + brick.height / 2);
      if (brick.fuseRemaining > 0) {
        const fuseX = brick.x + brick.width / 2;
        const sparkY = brick.y - 5 - (Math.sin(performance.now() / 45) + 1) * 2;
        ctx.strokeStyle = "#ffe083";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fuseX, brick.y + 2);
        ctx.lineTo(fuseX, brick.y - 6);
        ctx.stroke();
        ctx.shadowColor = "#ffbd59";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#fff4a8";
        ctx.beginPath();
        ctx.arc(fuseX, sparkY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#24121a";
        ctx.fillRect(brick.x + 6, brick.y + brick.height - 3, brick.width - 12, 2);
        ctx.fillStyle = "#fff4a8";
        ctx.fillRect(brick.x + 6, brick.y + brick.height - 3,
          (brick.width - 12) * Math.max(0, brick.fuseRemaining / TNT_FUSE_SECONDS), 2);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawBrickEffects() {
  for (const explosion of explosions) {
    const progress = explosion.age / explosion.duration;
    const radius = explosion.radius * progress;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "rgba(255, 159, 67, 0.2)";
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5 * (1 - progress) + 1;
    ctx.strokeStyle = "#ffe083";
    ctx.shadowColor = "#ff477e";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

