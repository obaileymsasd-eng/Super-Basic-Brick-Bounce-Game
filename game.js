// ============================================================
// BLOCK BREAKER (base game)
//
// game.js  = the canvas, the ball, the paddle, and the game loop
// bricks.js     = where the bricks are and how they are drawn
// collisions.js = what happens when the ball touches things
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;   // 600
const HEIGHT = canvas.height; // 450
const MAX_LIVES = 3;
const LIFE_COLORS = ["#39f5ff", "#ff477e", "#d7ff47"];
const PADDLE_BASE_WIDTH = 90;
const POWER_UP_STYLES = {
  shot: { color: "#ff477e", label: "A" },
  life: { color: "#d7ff47", label: "+1" },
  combo: { color: "#ff9f43", label: "C" },
  wide: { color: "#39f5ff", label: "W" }
};


// ------------------------------------------------------------
// THE BALL
// x and y are the top-left corner. vx and vy are how many pixels
// the ball moves each update (vx = sideways, vy = up/down).
// A positive vy means the ball is moving DOWN the screen.
// ------------------------------------------------------------
const BALL_SPEED = 4;

const ball = {
  x: 0,
  y: 0,
  width: 12,
  height: 12,
  vx: 0,
  vy: 0
};

// Put the ball in the center and reset its speed and direction.
function resetBall() {
  ball.x = WIDTH / 2 - ball.width / 2;
  ball.y = HEIGHT / 2 - ball.height / 2;
  ball.vx = BALL_SPEED;  // right
  ball.vy = BALL_SPEED;  // down
}


// ------------------------------------------------------------
// THE PADDLE
// ------------------------------------------------------------
const paddle = {
  x: WIDTH / 2 - 45,
  y: HEIGHT - 30,
  width: PADDLE_BASE_WIDTH,
  height: 12,
  speed: 6
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_INFO = {
  common: { label: "COMMON", color: "#39f5ff", weight: 45 },
  uncommon: { label: "UNCOMMON", color: "#7cff9f", weight: 30 },
  rare: { label: "RARE", color: "#6a7dff", weight: 15 },
  epic: { label: "EPIC", color: "#c77dff", weight: 8 },
  legendary: { label: "LEGENDARY", color: "#ffbd59", weight: 2 }
};

const SAVE_KEY = "neonBreakProgress";
let menuMode = "inventory";
let gameState = "menu";
let score = 0;
let coins = 0;
let selectedBall = "common";
let inventory = {
  common: 1,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 0
};
let lastGameRewardGranted = false;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    const loadedInventory = { ...inventory, ...(saved.inventory || {}) };
    coins = Number(saved.coins || 0);
    selectedBall = saved.selectedBall || "common";
    inventory = loadedInventory;
    if (!inventory[selectedBall]) {
      selectedBall = "common";
    }
  } catch (error) {
    coins = 0;
    selectedBall = "common";
    inventory = { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  }
}

function saveProgress() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    coins,
    selectedBall,
    inventory
  }));
  const coinCount = document.getElementById("coinCount");
  if (coinCount) {
    coinCount.textContent = String(coins);
  }
  renderInventory();
}

function getWeightedRareBall() {
  const totalWeight = RARITY_ORDER.reduce((sum, rarity) => sum + RARITY_INFO[rarity].weight, 0);
  let roll = Math.random() * totalWeight;

  for (const rarity of RARITY_ORDER) {
    roll -= RARITY_INFO[rarity].weight;
    if (roll <= 0) {
      return rarity;
    }
  }

  return "common";
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  const shopList = document.getElementById("shopList");

  if (!inventoryList || !shopList) {
    return;
  }

  inventoryList.innerHTML = "";
  for (const rarity of RARITY_ORDER) {
    const count = inventory[rarity] || 0;
    const item = document.createElement("div");
    item.className = "inventory-item";
    item.innerHTML = `
      <div>
        <span class="rarity-tag ${rarity}">${RARITY_INFO[rarity].label}</span>
        <br>
        <small>Owned: ${count}</small>
      </div>
      <button class="buy-button" data-select-ball="${rarity}" ${selectedBall === rarity ? "disabled" : ""}>
        ${selectedBall === rarity ? "SELECTED" : "SELECT"}
      </button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      if (count > 0) {
        selectedBall = rarity;
        saveProgress();
      }
    });
    inventoryList.appendChild(item);
  }

  shopList.innerHTML = "";
  for (const rarity of RARITY_ORDER) {
    const row = document.createElement("div");
    row.className = "inventory-item";
    row.innerHTML = `
      <div>
        <span class="rarity-tag ${rarity}">${RARITY_INFO[rarity].label}</span>
      </div>
      <small>${inventory[rarity] || 0} owned</small>
    `;
    shopList.appendChild(row);
  }
}

function setMenuMode(mode) {
  menuMode = mode;
  const sections = document.querySelectorAll(".panel-section");
  sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.panel === mode);
  });
}

function openBallCase() {
  if (coins < 150) {
    return;
  }

  coins -= 150;
  const rarity = getWeightedRareBall();
  inventory[rarity] = (inventory[rarity] || 0) + 1;
  selectedBall = rarity;
  saveProgress();
}

function grantLastGameReward() {
  if (lastGameRewardGranted) {
    return;
  }

  const reward = Math.floor(score * 0.75);
  coins += reward;
  lastGameRewardGranted = true;
  saveProgress();
}

function resetGameRound() {
  score = 0;
  combo = 1;
  lives = MAX_LIVES;
  fallingPowerUps = [];
  projectiles = [];
  aimCharges = 0;
  comboProtectionTime = 0;
  widePaddleTime = 0;
  setPaddleWidth(PADDLE_BASE_WIDTH);
  bricks = makeBricks();
  resetBall();
  lastGameRewardGranted = false;
}

function startGame() {
  resetGameRound();
  gameState = "playing";
  const menuOverlay = document.getElementById("menuOverlay");
  if (menuOverlay) {
    menuOverlay.classList.add("hidden");
  }
}

function showMenu() {
  gameState = "menu";
  const menuOverlay = document.getElementById("menuOverlay");
  if (menuOverlay) {
    menuOverlay.classList.remove("hidden");
  }
  setMenuMode(menuMode || "inventory");
}

function bindMenuControls() {
  const startButton = document.getElementById("startButton");
  const inventoryButton = document.getElementById("inventoryButton");
  const shopButton = document.getElementById("shopButton");
  const openCaseButton = document.getElementById("openCaseButton");

  if (startButton) {
    startButton.addEventListener("click", startGame);
  }
  if (inventoryButton) {
    inventoryButton.addEventListener("click", () => setMenuMode("inventory"));
  }
  if (shopButton) {
    shopButton.addEventListener("click", () => setMenuMode("shop"));
  }
  if (openCaseButton) {
    openCaseButton.addEventListener("click", openBallCase);
  }
}

// ------------------------------------------------------------
// THE BRICKS (the list is filled in by makeBricks() in bricks.js)
// ------------------------------------------------------------
let bricks = [];


// ------------------------------------------------------------
// KEYBOARD
// keys["arrowleft"] is true while the left arrow is held down.
// ------------------------------------------------------------
const keys = {};
// --- RESTART CONFIRMATION ---------------------------------------------  
// Two states: "normal" and "confirming". Pressing R once asks the  
// question; pressing R again while confirming restarts.  
let confirmState = "normal";  
let rWasDown = false;
let gameState = "playing";   // "playing", "won", or "lost"
let lives = MAX_LIVES;
// --- SCORE -------------------------------------------------------------  
// A singleton: there is only one score, and every file shares it.  
// --- COMBO --------------------------------------------------------------  
// Multiplier for bricks broken without touching the paddle.  
// Grows by 0.5 per brick, resets to 1x on a paddle bounce.  
let combo = 1;  
let fallingPowerUps = [];
let projectiles = [];
let aimCharges = 0;
let comboProtectionTime = 0;
let widePaddleTime = 0;
let mouseX = WIDTH / 2;
let mouseY = HEIGHT / 2;





document.addEventListener("keydown", function (event) {
  keys[event.key.toLowerCase()] = true;
  // Stop the arrow keys from scrolling the page.
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", function (event) {
  keys[event.key.toLowerCase()] = false;
  
});

function updateMousePosition(event) {
  const bounds = canvas.getBoundingClientRect();
  mouseX = (event.clientX - bounds.left) * WIDTH / bounds.width;
  mouseY = (event.clientY - bounds.top) * HEIGHT / bounds.height;
}

canvas.addEventListener("mousemove", updateMousePosition);
canvas.addEventListener("click", function (event) {
  updateMousePosition(event);
  if (gameState === "playing" && confirmState === "normal" && aimCharges > 0) {
    fireProjectile();
  }
});

// Press R once: show the question. Press R again: restart for real.  
function checkRestart() {  
  const rJustPressed = keys["r"] && !rWasDown;  
  
  if (confirmState === "normal") {  
    if (rJustPressed) {  
      confirmState = "confirming";  
    }  
  } else if (confirmState === "confirming") {  
    if (rJustPressed) {  
      bricks = makeBricks();   // rebuild the wall  
      resetBall();
            score = 0;   // a fresh game starts at zero
            combo = 1;   // a fresh game starts at 1x  
        lives = MAX_LIVES;
          fallingPowerUps = [];
          projectiles = [];
          aimCharges = 0;
          comboProtectionTime = 0;
          widePaddleTime = 0;
          setPaddleWidth(PADDLE_BASE_WIDTH);
            gameState = "playing";   // leave the won state on restart    
      confirmState = "normal";  
    }  
  }  
  
  rWasDown = keys["r"];  
}  


// ------------------------------------------------------------
// UPDATE: runs 60 times every second. Move things, then check
// what they touched.
// ------------------------------------------------------------
function update() {
  if (gameState === "menu") {
    return;
  }

  if (gameState === "won" || gameState === "lost") {
    grantLastGameReward();
    return;
  }

  checkRestart();   // R once = ask, R again = restart

  movePaddle();
  moveBall();

  bounceOffWalls();   // collisions.js
  bounceOffPaddle();  // collisions.js
  bounceOffBricks();  // collisions.js
  updatePowerUps();
  updateProjectiles();
  updatePowerUpTimers();
    // if every brick is gone, the player has won  
  if (bricks.length === 0 && gameState === "playing") {  
    gameState = "won";  
  }  


  // The ball fell off the bottom: back to the center.
  if (gameState === "playing" && ball.y > HEIGHT) {
    lives = lives - 1;
    if (lives === 0) {
      gameState = "lost";
    } else {
      resetBall();
    }
  }
}

function movePaddleLeft() {
  paddle.x = paddle.x - paddle.speed;
}

function movePaddle() {
  if (keys["arrowleft"] || keys["a"]) {
    movePaddleLeft();
  }
  if (keys["arrowright"] || keys["d"]) {
    paddle.x = paddle.x + paddle.speed;
  }

  // Keep the paddle on the screen.
  clampPaddle();
}

function clampPaddle() {
  if (paddle.x < 0) {
    paddle.x = 0;
  }
  if (paddle.x + paddle.width > WIDTH) {
    paddle.x = WIDTH - paddle.width;
  }
}

function setPaddleWidth(width) {
  const center = paddle.x + paddle.width / 2;
  paddle.width = width;
  paddle.x = center - paddle.width / 2;
  clampPaddle();
}

function spawnPowerUp(brick) {
  if (!brick.powerUp) {
    return;
  }

  fallingPowerUps.push({
    x: brick.x + brick.width / 2 - 9,
    y: brick.y + brick.height / 2 - 9,
    width: 18,
    height: 18,
    speed: 2.4,
    type: brick.powerUp
  });
}

function collectPowerUp(type) {
  if (type === "shot") {
    aimCharges++;
  } else if (type === "life") {
    lives = Math.min(MAX_LIVES, lives + 1);
  } else if (type === "combo") {
    comboProtectionTime = 10;
  } else if (type === "wide") {
    setPaddleWidth(PADDLE_BASE_WIDTH * 1.5);
    widePaddleTime = 8;
  }
}

function updatePowerUps() {
  for (let index = fallingPowerUps.length - 1; index >= 0; index--) {
    const powerUp = fallingPowerUps[index];
    powerUp.y += powerUp.speed;

    if (boxesTouch(powerUp, paddle)) {
      collectPowerUp(powerUp.type);
      fallingPowerUps.splice(index, 1);
    } else if (powerUp.y > HEIGHT) {
      fallingPowerUps.splice(index, 1);
    }
  }
}

function fireProjectile() {
  const startX = paddle.x + paddle.width / 2;
  const startY = paddle.y;
  const directionX = mouseX - startX;
  const directionY = mouseY - startY;
  const distance = Math.hypot(directionX, directionY) || 1;
  const speed = 8;

  projectiles.push({
    x: startX,
    y: startY,
    vx: directionX / distance * speed,
    vy: directionY / distance * speed,
    radius: 4
  });
  aimCharges--;
}

function updateProjectiles() {
  for (let shotIndex = projectiles.length - 1; shotIndex >= 0; shotIndex--) {
    const projectile = projectiles[shotIndex];
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    if (projectile.x < 0 || projectile.x > WIDTH || projectile.y < 0 || projectile.y > HEIGHT) {
      projectiles.splice(shotIndex, 1);
      continue;
    }

    for (const brick of bricks) {
      if (
        projectile.x + projectile.radius > brick.x &&
        projectile.x - projectile.radius < brick.x + brick.width &&
        projectile.y + projectile.radius > brick.y &&
        projectile.y - projectile.radius < brick.y + brick.height
      ) {
        breakBrick(brick);
        projectiles.splice(shotIndex, 1);
        break;
      }
    }
  }
}

function updatePowerUpTimers() {
  const elapsed = STEP / 1000;
  comboProtectionTime = Math.max(0, comboProtectionTime - elapsed);

  if (widePaddleTime > 0) {
    widePaddleTime = Math.max(0, widePaddleTime - elapsed);
    if (widePaddleTime === 0) {
      setPaddleWidth(PADDLE_BASE_WIDTH);
    }
  }
}

function moveBall() {
  ball.x = ball.x + ball.vx;
  ball.y = ball.y + ball.vy;
}

function drawArena() {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#101b2c");
  background.addColorStop(1, "#07111b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.strokeStyle = "rgba(57, 245, 255, 0.11)";
  ctx.lineWidth = 1;
  for (let x = 20; x < WIDTH; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 20; y < HEIGHT; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.shadowColor = "#39f5ff";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(57, 245, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 1);
  ctx.lineTo(WIDTH, HEIGHT - 1);
  ctx.stroke();
  ctx.restore();
}

function drawPaddle() {
  const paddleGradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
  paddleGradient.addColorStop(0, "#ff477e");
  paddleGradient.addColorStop(0.18, "#39f5ff");
  paddleGradient.addColorStop(0.82, "#39f5ff");
  paddleGradient.addColorStop(1, "#ff477e");

  ctx.save();
  ctx.shadowColor = "#39f5ff";
  ctx.shadowBlur = 18;
  ctx.fillStyle = paddleGradient;
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.restore();
}

function drawBall() {
  const color = RARITY_INFO[selectedBall]?.color || RARITY_INFO.common.color;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.fillRect(ball.x, ball.y, ball.width, ball.height);
  ctx.restore();
}

function drawPowerUps() {
  for (const powerUp of fallingPowerUps) {
    const style = POWER_UP_STYLES[powerUp.type];
    ctx.save();
    ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#101827";
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.rotate(-Math.PI / 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.color;
    ctx.font = "700 9px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.label, 0, 0);
    ctx.restore();
  }
}

function drawProjectiles() {
  ctx.save();
  ctx.fillStyle = "#ff477e";
  ctx.shadowColor = "#ff477e";
  ctx.shadowBlur = 14;
  for (const projectile of projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAimArrow() {
  if (aimCharges === 0) {
    return;
  }

  const startX = paddle.x + paddle.width / 2;
  const startY = paddle.y - 5;
  const angle = Math.atan2(mouseY - startY, mouseX - startX);
  const endX = startX + Math.cos(angle) * 34;
  const endY = startY + Math.sin(angle) * 34;

  ctx.save();
  ctx.strokeStyle = "#ff477e";
  ctx.fillStyle = "#ff477e";
  ctx.shadowColor = "#ff477e";
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.translate(endX, endY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, -5);
  ctx.lineTo(-9, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}


// ------------------------------------------------------------
// DRAW: paints the neon arena and its game objects.
// ------------------------------------------------------------
function draw() {
  drawArena();
  drawBricks();
  drawPowerUps();
  drawProjectiles();
  drawPaddle();
  drawBall();
  drawAimArrow();

  ctx.save();
  ctx.font = "700 12px 'Space Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#8a9bad";
  ctx.fillText("SCORE //", 14, 11);
  ctx.fillStyle = "#39f5ff";
  ctx.fillText(String(score).padStart(5, "0"), 100, 11);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8a9bad";
  ctx.fillText("BLOCKS // " + bricks.length, WIDTH - 14, 11);
  if (combo > 1) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#d7ff47";
    ctx.fillText("COMBO x" + combo, 14, 31);
  }
  if (comboProtectionTime > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff9f43";
    ctx.fillText("SAFE " + comboProtectionTime.toFixed(1) + "s", 132, 31);
  }
  if (widePaddleTime > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#39f5ff";
    ctx.fillText("WIDE " + widePaddleTime.toFixed(1) + "s", 244, 31);
  }
  if (aimCharges > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff477e";
    ctx.fillText("AIM x" + aimCharges, 356, 31);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#8a9bad";
  ctx.fillText("LIVES", WIDTH - 136, 31);
  for (let index = 0; index < MAX_LIVES; index++) {
    const isRemainingLife = index >= MAX_LIVES - lives;
    ctx.globalAlpha = isRemainingLife ? 1 : 0.18;
    ctx.fillStyle = LIFE_COLORS[index];
    ctx.shadowColor = LIFE_COLORS[index];
    ctx.shadowBlur = isRemainingLife ? 8 : 0;
    ctx.beginPath();
    ctx.arc(WIDTH - 75 + index * 22, 37, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (gameState === "won" || gameState === "lost" || confirmState === "confirming") {
    ctx.fillStyle = "rgba(5, 10, 20, 0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 18;
    ctx.shadowColor = gameState === "won" ? "#39f5ff" : "#ff477e";
    ctx.fillStyle = gameState === "won" ? "#39f5ff" : "#ff477e";
    ctx.font = "700 28px 'Orbitron', monospace";
    const title = confirmState === "confirming"
      ? "RESTART?"
      : gameState === "won" ? "SYSTEM CLEARED" : "GAME OVER";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e7f2ff";
    ctx.font = "12px 'Space Mono', monospace";
    const prompt = confirmState === "confirming"
      ? "PRESS R AGAIN TO CONFIRM"
      : gameState === "won"
        ? "PRESS R, THEN R AGAIN TO PLAY AGAIN"
        : "PRESS R, THEN R AGAIN TO RESTART";
    ctx.fillText(prompt, WIDTH / 2, HEIGHT / 2 + 20);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

}


// ------------------------------------------------------------
// THE GAME LOOP
// The browser calls frame() every time it is ready to draw.
// Some screens are faster than others, so we make sure update()
// always runs exactly 60 times per second on every computer.
// ------------------------------------------------------------
const STEP = 1000 / 60;
let lastTime = 0;
let leftover = 0;

function frame(now) {
  leftover = leftover + (now - lastTime);
  lastTime = now;

  // If the tab was hidden for a while, don't try to catch up.
  if (leftover > 250) {
    leftover = 250;
  }

  while (leftover >= STEP) {
    update();
    leftover = leftover - STEP;
  }

  draw();
  requestAnimationFrame(frame);
}

function start() {
  loadProgress();
  bindMenuControls();
  renderInventory();
  saveProgress();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
