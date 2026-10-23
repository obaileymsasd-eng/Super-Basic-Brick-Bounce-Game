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
let ballLaunched = false;

// Place the ball above the paddle and wait for the player's aim.
function resetBall() {
  ball.x = paddle.x + paddle.width / 2 - ball.width / 2;
  ball.y = paddle.y - ball.height;
  ball.vx = 0;
  ball.vy = 0;
  ballLaunched = false;
}

function launchBall() {
  if (gameState !== "playing" || ballLaunched) {
    return;
  }

  const startX = paddle.x + paddle.width / 2;
  const startY = paddle.y;
  const targetX = mouseX;
  const targetY = Math.min(mouseY, startY - 40);
  const directionX = targetX - startX;
  const directionY = targetY - startY;
  const distance = Math.hypot(directionX, directionY) || 1;

  ball.x = startX - ball.width / 2;
  ball.y = startY - ball.height;
  ball.vx = directionX / distance * BALL_SPEED;
  ball.vy = directionY / distance * BALL_SPEED;
  ballLaunched = true;
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
  common: { label: "COMMON", skin: "Static", color: "#39f5ff", shape: "square", weight: 45 },
  uncommon: { label: "UNCOMMON", skin: "Verdant", color: "#7cff9f", shape: "circle", weight: 30 },
  rare: { label: "RARE", skin: "Deep Space", color: "#6a7dff", shape: "diamond", weight: 15 },
  epic: { label: "EPIC", skin: "Prism", color: "#c77dff", shape: "ring", weight: 8 },
  legendary: { label: "LEGENDARY", skin: "Solar Flare", color: "#ffbd59", shape: "star", weight: 2 }
};
const WEAR_CONDITIONS = [
  { label: "Factory New", max: 0.07 },
  { label: "Minimal Wear", max: 0.15 },
  { label: "Field-Tested", max: 0.38 },
  { label: "Well-Worn", max: 0.45 },
  { label: "Battle-Scarred", max: 1 }
];

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
let ownedSkins = [{ id: "starter-common", rarity: "common", condition: "Factory New", float: 0.03 }];
let selectedSkinId = "starter-common";
let caseAnimating = false;
let lastGameRewardGranted = false;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    coins = Number(saved.coins || 0);
    if (Array.isArray(saved.skins)) {
      ownedSkins = saved.skins.filter((skin) =>
        skin && RARITY_INFO[skin.rarity] && typeof skin.id === "string"
      ).map((skin) => ({
        id: skin.id,
        rarity: skin.rarity,
        condition: WEAR_CONDITIONS.find((condition) => condition.label === skin.condition)?.label || "Factory New",
        float: Math.max(0, Math.min(1, Number(skin.float) || 0))
      }));
    } else {
      const legacyInventory = { ...inventory, ...(saved.inventory || {}) };
      ownedSkins = [];
      for (const rarity of RARITY_ORDER) {
        const count = Math.max(0, Math.floor(Number(legacyInventory[rarity]) || 0));
        for (let index = 0; index < count; index++) {
          ownedSkins.push({
            id: `legacy-${rarity}-${index}`,
            rarity,
            condition: "Factory New",
            float: 0.03
          });
        }
      }
    }

    inventory = Object.fromEntries(RARITY_ORDER.map((rarity) => [
      rarity,
      ownedSkins.filter((skin) => skin.rarity === rarity).length
    ]));
    const savedSelection = ownedSkins.find((skin) => skin.id === saved.selectedSkinId);
    const fallbackSelection = ownedSkins.find((skin) => skin.rarity === saved.selectedBall) || ownedSkins[0];
    selectedSkinId = (savedSelection || fallbackSelection)?.id || "";
    selectedBall = (savedSelection || fallbackSelection)?.rarity || "common";
  } catch (error) {
    coins = 0;
    selectedBall = "common";
    inventory = { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    ownedSkins = [{ id: "starter-common", rarity: "common", condition: "Factory New", float: 0.03 }];
    selectedSkinId = "starter-common";
  }
}

function saveProgress() {
  inventory = Object.fromEntries(RARITY_ORDER.map((rarity) => [
    rarity,
    ownedSkins.filter((skin) => skin.rarity === rarity).length
  ]));
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    coins,
    selectedBall,
    selectedSkinId,
    inventory,
    skins: ownedSkins
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

function rollSkin() {
  const float = Math.random();
  const condition = WEAR_CONDITIONS.find((wear) => float <= wear.max) || WEAR_CONDITIONS[WEAR_CONDITIONS.length - 1];
  return {
    id: `skin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rarity: getWeightedRareBall(),
    condition: condition.label,
    float
  };
}

function createReelCard(skin) {
  const info = RARITY_INFO[skin.rarity];
  const card = document.createElement("div");
  card.className = `reel-card ${skin.rarity}`;
  card.innerHTML = `
    <span class="reel-card-rarity">${info.label}</span>
    <span class="reel-ball ${skin.rarity}" aria-hidden="true"></span>
    <strong>${info.skin}</strong>
  `;
  return card;
}

function finishCaseOpening(skin) {
  selectedSkinId = skin.id;
  selectedBall = skin.rarity;
  caseAnimating = false;
  saveProgress();

  const info = RARITY_INFO[skin.rarity];
  const caseStatus = document.getElementById("caseStatus");
  const caseResult = document.getElementById("caseResult");
  const continueButton = document.getElementById("caseContinueButton");
  const closeButton = document.getElementById("closeCaseButton");
  caseStatus.textContent = "ITEM ACQUIRED";
  caseResult.innerHTML = `
    <span class="rarity-tag ${skin.rarity}">${info.label}</span>
    <strong>${info.skin}</strong>
    <span class="condition-tag">${skin.condition}</span>
    <small>Float: ${skin.float.toFixed(6)}</small>
  `;
  caseResult.hidden = false;
  continueButton.hidden = false;
  closeButton.disabled = false;
}

function closeCaseOpening() {
  if (caseAnimating) {
    return;
  }
  document.getElementById("caseOpening").classList.remove("active");
  document.getElementById("caseOpening").setAttribute("aria-hidden", "true");
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  const shopList = document.getElementById("shopList");

  if (!inventoryList || !shopList) {
    return;
  }

  inventoryList.innerHTML = "";
  for (const rarity of RARITY_ORDER) {
    const skin = RARITY_INFO[rarity];
    const skinsOfRarity = ownedSkins.filter((ownedSkin) => ownedSkin.rarity === rarity);
    for (const ownedSkin of skinsOfRarity) {
      const item = document.createElement("div");
      item.className = "inventory-item";
      item.innerHTML = `
        <div>
          <span class="rarity-tag ${rarity}">${skin.label}</span>
          <br>
          <strong class="skin-name">${skin.skin}</strong>
          <small>${ownedSkin.condition} | Float ${ownedSkin.float.toFixed(4)}</small>
        </div>
        <button class="buy-button" ${selectedSkinId === ownedSkin.id ? "disabled" : ""}>
          ${selectedSkinId === ownedSkin.id ? "EQUIPPED" : "EQUIP"}
        </button>
      `;
      item.querySelector("button").addEventListener("click", () => {
        selectedSkinId = ownedSkin.id;
        selectedBall = rarity;
        saveProgress();
      });
      inventoryList.appendChild(item);
    }
  }

  shopList.innerHTML = "";
  for (const rarity of RARITY_ORDER) {
    const skin = RARITY_INFO[rarity];
    const row = document.createElement("div");
    row.className = "inventory-item";
    row.innerHTML = `
      <div>
        <span class="rarity-tag ${rarity}">${skin.label}</span>
        <br>
        <strong class="skin-name">${skin.skin}</strong>
      </div>
      <small>${skin.weight}% drop | ${inventory[rarity] || 0} owned</small>
    `;
    shopList.appendChild(row);
  }

  const openCaseButton = document.getElementById("openCaseButton");
  if (openCaseButton) {
    openCaseButton.disabled = coins < 150;
    openCaseButton.title = openCaseButton.disabled ? "Earn more coins to open a case" : "Open a skin case";
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
  if (coins < 150 || caseAnimating) {
    return;
  }

  coins -= 150;
  const reward = rollSkin();
  ownedSkins.push(reward);
  saveProgress();

  const caseOpening = document.getElementById("caseOpening");
  const caseReel = document.getElementById("caseReel");
  const reelTrack = document.getElementById("caseReelTrack");
  const caseStatus = document.getElementById("caseStatus");
  const caseResult = document.getElementById("caseResult");
  const continueButton = document.getElementById("caseContinueButton");
  const closeButton = document.getElementById("closeCaseButton");
  const winningIndex = 28;
  const reelSkins = Array.from({ length: 36 }, (_, index) => index === winningIndex ? reward : rollSkin());

  reelTrack.replaceChildren(...reelSkins.map(createReelCard));
  reelTrack.style.transition = "none";
  reelTrack.style.transform = "translateX(0)";
  caseStatus.textContent = "CASE OPENING...";
  caseResult.hidden = true;
  continueButton.hidden = true;
  closeButton.disabled = true;
  caseOpening.classList.add("active");
  caseOpening.setAttribute("aria-hidden", "false");
  caseAnimating = true;

  requestAnimationFrame(() => {
    const target = reelTrack.children[winningIndex];
    const offset = target.offsetLeft + target.offsetWidth / 2 - caseReel.clientWidth / 2;
    reelTrack.style.transition = "transform 5.4s cubic-bezier(0.08, 0.72, 0.08, 1)";
    reelTrack.style.transform = `translateX(-${offset}px)`;
  });
  window.setTimeout(() => finishCaseOpening(reward), 5500);
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
  const closeCaseButton = document.getElementById("closeCaseButton");
  const caseContinueButton = document.getElementById("caseContinueButton");

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
  if (closeCaseButton) {
    closeCaseButton.addEventListener("click", closeCaseOpening);
  }
  if (caseContinueButton) {
    caseContinueButton.addEventListener("click", closeCaseOpening);
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
// --- COMMAND CONFIRMATION ----------------------------------------------
const COMMAND_PROMPT_DURATION = 4000;
let pendingCommand = null;
let commandPromptExpiresAt = 0;
let commandPromptDismissed = false;
let rWasDown = false;
let mWasDown = false;
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
  if (event.code === "Space") {
    event.preventDefault();
    launchBall();
  }
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

canvas.addEventListener("pointermove", updateMousePosition);
canvas.addEventListener("click", function (event) {
  updateMousePosition(event);
  if (gameState === "playing" && pendingCommand === null && aimCharges > 0) {
    fireProjectile();
  }
});

function checkCommands() {
  const now = performance.now();
  const rJustPressed = keys["r"] && !rWasDown;
  const mJustPressed = keys["m"] && !mWasDown;

  if (pendingCommand !== null && now >= commandPromptExpiresAt) {
    pendingCommand = null;
    commandPromptDismissed = true;
  }

  if (pendingCommand === "restart" && rJustPressed) {
      resetGameRound();
      gameState = "playing";
      pendingCommand = null;
  } else if (pendingCommand === "menu" && mJustPressed) {
    pendingCommand = null;
    showMenu();
  } else if (pendingCommand === null) {
    if (rJustPressed) {
      pendingCommand = "restart";
      commandPromptExpiresAt = now + COMMAND_PROMPT_DURATION;
      commandPromptDismissed = false;
    } else if (mJustPressed) {
      pendingCommand = "menu";
      commandPromptExpiresAt = now + COMMAND_PROMPT_DURATION;
      commandPromptDismissed = false;
    }
  }

  rWasDown = keys["r"];
  mWasDown = keys["m"];
}


// ------------------------------------------------------------
// UPDATE: runs 60 times every second. Move things, then check
// what they touched.
// ------------------------------------------------------------
function update() {
  if (gameState === "menu") {
    return;
  }

  checkCommands();
  if (gameState === "menu") {
    return;
  }

  if (gameState === "won" || gameState === "lost") {
    grantLastGameReward();
    return;
  }

  movePaddle();
  if (!ballLaunched) {
    ball.x = paddle.x + paddle.width / 2 - ball.width / 2;
    ball.y = paddle.y - ball.height;
    return;
  }

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

function bindPaddleControls() {
  document.querySelectorAll("[data-paddle-direction]").forEach((button) => {
    const key = button.dataset.paddleDirection === "left" ? "arrowleft" : "arrowright";
    const stopMoving = () => {
      keys[key] = false;
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      keys[key] = true;
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", stopMoving);
    button.addEventListener("pointercancel", stopMoving);
    button.addEventListener("lostpointercapture", stopMoving);
  });
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
  const skin = RARITY_INFO[selectedBall] || RARITY_INFO.common;
  const centerX = ball.x + ball.width / 2;
  const centerY = ball.y + ball.height / 2;
  ctx.save();
  ctx.shadowColor = skin.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = skin.color;
  ctx.strokeStyle = skin.color;
  ctx.lineWidth = 2;

  if (skin.shape === "circle") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, ball.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (skin.shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(centerX, ball.y);
    ctx.lineTo(ball.x + ball.width, centerY);
    ctx.lineTo(centerX, ball.y + ball.height);
    ctx.lineTo(ball.x, centerY);
    ctx.closePath();
    ctx.fill();
  } else if (skin.shape === "ring") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, ball.width / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  } else if (skin.shape === "star") {
    ctx.beginPath();
    for (let point = 0; point < 10; point++) {
      const radius = point % 2 === 0 ? ball.width / 2 : ball.width / 4;
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (point === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(ball.x, ball.y, ball.width, ball.height);
  }
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

function drawLaunchAim() {
  if (gameState !== "playing" || ballLaunched) {
    return;
  }

  const startX = paddle.x + paddle.width / 2;
  const startY = paddle.y - 4;
  const targetX = mouseX;
  const targetY = Math.min(mouseY, startY - 40);
  const angle = Math.atan2(targetY - startY, targetX - startX);
  const endX = startX + Math.cos(angle) * 70;
  const endY = startY + Math.sin(angle) * 70;

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(215, 255, 71, 0.8)";
  ctx.fillStyle = "#d7ff47";
  ctx.shadowColor = "#d7ff47";
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(endX, endY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, -5);
  ctx.lineTo(-9, 5);
  ctx.closePath();
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "700 11px 'Space Mono', monospace";
  ctx.fillText("AIM WITH POINTER  //  PRESS SPACE TO LAUNCH", WIDTH / 2, HEIGHT - 48);
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
  drawLaunchAim();
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

  if (gameState === "won" || gameState === "lost" || pendingCommand !== null) {
    ctx.fillStyle = "rgba(5, 10, 20, 0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 18;
    ctx.shadowColor = gameState === "won" ? "#39f5ff" : "#ff477e";
    ctx.fillStyle = gameState === "won" ? "#39f5ff" : "#ff477e";
    ctx.font = "700 28px 'Orbitron', monospace";
    const title = pendingCommand === "restart"
      ? "RESTART?"
      : pendingCommand === "menu"
        ? "RETURN TO MENU?"
      : gameState === "won" ? "SYSTEM CLEARED" : "GAME OVER";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e7f2ff";
    ctx.font = "12px 'Space Mono', monospace";
    const prompt = pendingCommand === "restart"
      ? "PRESS R AGAIN TO CONFIRM"
      : pendingCommand === "menu"
        ? "PRESS M AGAIN TO CONFIRM"
        : commandPromptDismissed
          ? ""
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
  bindPaddleControls();
  renderInventory();
  saveProgress();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
