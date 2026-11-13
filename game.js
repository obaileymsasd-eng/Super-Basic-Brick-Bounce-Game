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
const BALL_MAX_SPEED = 8;
const LIFE_COLORS = ["#39f5ff", "#ff477e", "#d7ff47"];
const PADDLE_BASE_WIDTH = 90;
const AWP_PADDLE_SKIN_ID = "awp-lightning";
const AWP_PADDLE_IMAGE = "assets/awp-lightning.jpg";
const AWP_PADDLE_UNLOCK_CODE = "435";
const AWP_PADDLE_CROP = { x: 20, y: 150, width: 1010, height: 250 };
const awpPaddleImage = new Image();
let awpPaddleTexture = null;
let lastPaddleDirection = -1;
awpPaddleImage.addEventListener("load", () => {
  const { x, y, width, height } = AWP_PADDLE_CROP;
  const texture = document.createElement("canvas");
  texture.width = width;
  texture.height = height;
  const textureContext = texture.getContext("2d", { willReadFrequently: true });
  textureContext.drawImage(awpPaddleImage, x, y, width, height, 0, 0, width, height);

  const imageData = textureContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const background = [pixels[0], pixels[1], pixels[2]];
  const visited = new Uint8Array(width * height);
  const queue = [];
  const isBackground = (pixelIndex) => {
    const offset = pixelIndex * 4;
    return Math.abs(pixels[offset] - background[0]) <= 42 &&
      Math.abs(pixels[offset + 1] - background[1]) <= 42 &&
      Math.abs(pixels[offset + 2] - background[2]) <= 42;
  };
  const enqueueBackground = (pixelIndex) => {
    if (!visited[pixelIndex] && isBackground(pixelIndex)) {
      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    }
  };

  for (let column = 0; column < width; column++) {
    enqueueBackground(column);
    enqueueBackground((height - 1) * width + column);
  }
  for (let row = 0; row < height; row++) {
    enqueueBackground(row * width);
    enqueueBackground(row * width + width - 1);
  }

  while (queue.length > 0) {
    const pixelIndex = queue.pop();
    pixels[pixelIndex * 4 + 3] = 0;
    const column = pixelIndex % width;
    if (column > 0) enqueueBackground(pixelIndex - 1);
    if (column < width - 1) enqueueBackground(pixelIndex + 1);
    if (pixelIndex >= width) enqueueBackground(pixelIndex - width);
    if (pixelIndex < width * (height - 1)) enqueueBackground(pixelIndex + width);
  }

  textureContext.putImageData(imageData, 0, 0);
  awpPaddleTexture = texture;
});
awpPaddleImage.addEventListener("error", () => {
  console.error(`Could not load paddle skin image: ${AWP_PADDLE_IMAGE}`);
});
awpPaddleImage.src = AWP_PADDLE_IMAGE;
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

  const awpBarrel = getAwpBarrelPosition();
  const startX = awpBarrel
    ? awpBarrel.x + awpBarrel.direction * ball.width / 2
    : paddle.x + paddle.width / 2;
  const startY = awpBarrel ? awpBarrel.y : paddle.y;
  const targetX = mouseX;
  const targetY = Math.min(mouseY, startY - 40);
  const directionX = targetX - startX;
  const directionY = targetY - startY;
  const distance = Math.hypot(directionX, directionY) || 1;

  ball.x = startX - ball.width / 2;
  ball.y = awpBarrel ? startY - ball.height / 2 : startY - ball.height;
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

function getAwpBarrelPosition() {
  const equippedSkin = ownedSkins.find((skin) => skin.id === selectedPaddleSkinId);
  if (equippedSkin?.specialId !== AWP_PADDLE_SKIN_ID) {
    return null;
  }

  const direction = lastPaddleDirection > 0 ? 1 : -1;
  const muzzleX = direction > 0
    ? paddle.x + paddle.width * 0.96
    : paddle.x + paddle.width * 0.04;
  const muzzleY = paddle.y - 2 + (paddle.height + 4) * 0.416;
  return { x: muzzleX, y: muzzleY, direction };
}

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_INFO = {
  common: { label: "COMMON", skin: "Static", color: "#39f5ff", shape: "square", weight: 45 },
  uncommon: { label: "UNCOMMON", skin: "Verdant", color: "#7cff9f", shape: "circle", weight: 30 },
  rare: { label: "RARE", skin: "Deep Space", color: "#6a7dff", shape: "diamond", weight: 15 },
  epic: { label: "EPIC", skin: "Prism", color: "#c77dff", shape: "ring", weight: 8 },
  legendary: { label: "LEGENDARY", skin: "Solar Flare", color: "#ffbd59", shape: "star", weight: 2 }
};
const PADDLE_SKIN_INFO = {
  common: { skin: "Arcade Alloy", color: "#39f5ff", pattern: "solid" },
  uncommon: { skin: "Volt Runner", color: "#7cff9f", pattern: "stripes" },
  rare: { skin: "Ion Trail", color: "#6a7dff", pattern: "split" },
  epic: { skin: "Prism Rail", color: "#c77dff", pattern: "glow" },
  legendary: { skin: "Solar Glide", color: "#ffbd59", pattern: "gold" }
};
const CASES = [
  { id: "static", name: "Static Starter", itemType: "ball", price: 150, odds: { common: 72, uncommon: 20, rare: 6, epic: 1.5, legendary: 0.5 } },
  { id: "verdant", name: "Verdant Surge", itemType: "ball", price: 300, odds: { common: 12, uncommon: 58, rare: 22, epic: 7, legendary: 1 } },
  { id: "orbit", name: "Deep Orbit", itemType: "ball", price: 500, odds: { common: 7, uncommon: 15, rare: 55, epic: 18, legendary: 5 } },
  { id: "prism", name: "Prism Overdrive", itemType: "ball", price: 850, odds: { common: 3, uncommon: 9, rare: 20, epic: 52, legendary: 16 } },
  { id: "solar", name: "Solar Crown", itemType: "ball", price: 1300, odds: { common: 2, uncommon: 5, rare: 13, epic: 25, legendary: 55 } },
  { id: "alloy-paddle", name: "Alloy Circuit", itemType: "paddle", price: 150, odds: { common: 72, uncommon: 20, rare: 6, epic: 1.5, legendary: 0.5 } },
  { id: "volt-paddle", name: "Volt Circuit", itemType: "paddle", price: 300, odds: { common: 12, uncommon: 58, rare: 22, epic: 7, legendary: 1 } },
  { id: "ion-paddle", name: "Ion Circuit", itemType: "paddle", price: 500, odds: { common: 7, uncommon: 15, rare: 55, epic: 18, legendary: 5 } },
  { id: "prism-paddle", name: "Prism Circuit", itemType: "paddle", price: 850, odds: { common: 3, uncommon: 9, rare: 20, epic: 52, legendary: 16 } },
  { id: "solar-paddle", name: "Solar Circuit", itemType: "paddle", price: 1300, odds: { common: 2, uncommon: 5, rare: 13, epic: 25, legendary: 55 }, specialDrop: { chance: 0.1 } }
];
const WEAR_CONDITIONS = [
  { label: "Factory New", max: 0.07 },
  { label: "Minimal Wear", max: 0.15 },
  { label: "Field-Tested", max: 0.38 },
  { label: "Well-Worn", max: 0.45 },
  { label: "Battle-Scarred", max: 1 }
];
const MARKET_REFRESH_MS = 30000;
const BALL_MARKET_BASE_PRICES = {
  common: 20,
  uncommon: 45,
  rare: 150,
  epic: 450
};
const PADDLE_MARKET_BASE_PRICES = {
  common: 150,
  uncommon: 250,
  rare: 400,
  epic: 700,
  legendary: 1200
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
let ownedSkins = [
  { id: "starter-common", type: "ball", rarity: "common", condition: "Factory New", float: 0.03 },
  { id: "starter-paddle", type: "paddle", rarity: "common", condition: "Factory New", float: 0.03 }
];
let selectedSkinId = "starter-common";
let selectedPaddleSkinId = "starter-paddle";
let inventoryType = "ball";
let caseAnimating = false;
let lastGameRewardGranted = false;
let marketOffers = [];
let marketPriceFactors = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, 1]));
let nextMarketRefreshAt = 0;
let nextMarketClockUpdateAt = 0;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    coins = Number(saved.coins || 0);
    if (Array.isArray(saved.skins)) {
      ownedSkins = saved.skins.filter((skin) =>
        skin && RARITY_INFO[skin.rarity] && typeof skin.id === "string"
      ).map((skin) => ({
        id: skin.id,
        type: skin.type === "paddle" ? "paddle" : "ball",
        rarity: skin.rarity,
        specialId: skin.specialId === AWP_PADDLE_SKIN_ID ? AWP_PADDLE_SKIN_ID : undefined,
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
            type: "ball",
            rarity,
            condition: "Factory New",
            float: 0.03
          });
        }
      }
    }

    if (!ownedSkins.some((skin) => skin.type === "ball")) {
      ownedSkins.push({ id: "starter-common", type: "ball", rarity: "common", condition: "Factory New", float: 0.03 });
    }
    if (!ownedSkins.some((skin) => skin.type === "paddle")) {
      ownedSkins.push({ id: "starter-paddle", type: "paddle", rarity: "common", condition: "Factory New", float: 0.03 });
    }

    inventory = Object.fromEntries(RARITY_ORDER.map((rarity) => [
      rarity,
      ownedSkins.filter((skin) => skin.rarity === rarity).length
    ]));
    const savedSelection = ownedSkins.find((skin) => skin.id === saved.selectedSkinId);
    const fallbackSelection = ownedSkins.find((skin) => skin.type === "ball" && skin.rarity === saved.selectedBall) ||
      ownedSkins.find((skin) => skin.type === "ball");
    const savedBallSelection = savedSelection?.type === "ball" ? savedSelection : fallbackSelection;
    selectedSkinId = savedBallSelection?.id || ownedSkins.find((skin) => skin.type === "ball")?.id || "";
    selectedBall = savedBallSelection?.rarity || "common";
    selectedPaddleSkinId = ownedSkins.find((skin) => skin.id === saved.selectedPaddleSkinId && skin.type === "paddle")?.id ||
      ownedSkins.find((skin) => skin.type === "paddle")?.id || "";
  } catch (error) {
    coins = 0;
    selectedBall = "common";
    inventory = { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    ownedSkins = [
      { id: "starter-common", type: "ball", rarity: "common", condition: "Factory New", float: 0.03 },
      { id: "starter-paddle", type: "paddle", rarity: "common", condition: "Factory New", float: 0.03 }
    ];
    selectedSkinId = "starter-common";
    selectedPaddleSkinId = "starter-paddle";
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
    selectedPaddleSkinId,
    inventory,
    skins: ownedSkins
  }));
  const coinCount = document.getElementById("coinCount");
  if (coinCount) {
    coinCount.textContent = String(coins);
  }
  renderInventory();
}

function getWeightedRareBall(weights = null) {
  const totalWeight = RARITY_ORDER.reduce((sum, rarity) => sum + (weights?.[rarity] ?? RARITY_INFO[rarity].weight), 0);
  let roll = Math.random() * totalWeight;

  for (const rarity of RARITY_ORDER) {
    roll -= weights?.[rarity] ?? RARITY_INFO[rarity].weight;
    if (roll <= 0) {
      return rarity;
    }
  }

  return "common";
}

function getItemSkinInfo(item) {
  if (item.specialId === AWP_PADDLE_SKIN_ID) {
    return { ...RARITY_INFO.legendary, ...PADDLE_SKIN_INFO.legendary, skin: "AWP Lightning Strike" };
  }
  return item.type === "paddle"
    ? { ...RARITY_INFO[item.rarity], ...PADDLE_SKIN_INFO[item.rarity] }
    : RARITY_INFO[item.rarity];
}

function rollSkin(itemType = "ball", caseConfig = null) {
  const float = Math.random();
  const condition = WEAR_CONDITIONS.find((wear) => float <= wear.max) || WEAR_CONDITIONS[WEAR_CONDITIONS.length - 1];
  const isAwpDrop = itemType === "paddle" &&
    caseConfig?.specialDrop &&
    Math.random() < caseConfig.specialDrop.chance;
  return {
    id: `skin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: itemType,
    rarity: isAwpDrop ? "legendary" : getWeightedRareBall(caseConfig?.odds),
    specialId: isAwpDrop ? AWP_PADDLE_SKIN_ID : undefined,
    condition: condition.label,
    float
  };
}

function getWearCondition(float) {
  return WEAR_CONDITIONS.find((wear) => float <= wear.max)?.label || "Battle-Scarred";
}

function getMarketValue(skin) {
  if (skin.specialId === AWP_PADDLE_SKIN_ID) {
    return 1;
  }

  const marketFactor = marketPriceFactors[skin.rarity] || 1;
  if (skin.type === "ball") {
    let value;
    if (skin.rarity === "legendary") {
      const rareFloatPremium = 2800 * Math.exp(-skin.float / 0.0001);
      const wearFactor = skin.float <= 0.07
        ? 1
        : Math.max(0.1, 1 - ((skin.float - 0.07) / 0.93) * 0.9);
      value = (1200 + rareFloatPremium) * wearFactor;
    } else {
      value = BALL_MARKET_BASE_PRICES[skin.rarity] * (1.15 - skin.float * 0.75);
    }
    return Math.max(1, Math.round(value * marketFactor));
  }

  const floatFactor = 1.2 - skin.float * 0.4;
  return Math.max(1, Math.round(PADDLE_MARKET_BASE_PRICES[skin.rarity] * floatFactor * marketFactor));
}

function refreshMarket() {
  marketPriceFactors = Object.fromEntries(RARITY_ORDER.map((rarity) => [
    rarity,
    0.85 + Math.random() * 0.3
  ]));
  marketOffers = Array.from({ length: 8 }, (_, index) => {
    const float = Math.random();
    const type = index % 2 === 0 ? "ball" : "paddle";
    return {
      id: `market-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      rarity: getWeightedRareBall(),
      condition: getWearCondition(float),
      float
    };
  });
  nextMarketRefreshAt = Date.now() + MARKET_REFRESH_MS;
  nextMarketClockUpdateAt = 0;
  renderInventory();
}

function renderMarket() {
  const marketList = document.getElementById("marketList");
  if (!marketList) {
    return;
  }

  marketList.replaceChildren();
  for (const offer of marketOffers) {
    const skin = getItemSkinInfo(offer);
    const sellPrice = getMarketValue(offer);
    const buyPrice = Math.ceil(sellPrice * 1.25);
    const row = document.createElement("div");
    row.className = "inventory-item market-item";
    row.innerHTML = `
      <div>
        <span class="rarity-tag ${offer.rarity}">${skin.label}</span>
        <strong class="skin-name">${skin.skin}</strong>
        <small>${offer.type.toUpperCase()} | ${offer.condition} | Float ${offer.float.toFixed(4)}</small>
      </div>
      <div class="market-prices">
        <small>SELL ${sellPrice} | BUY ${buyPrice}</small>
        <button class="buy-button" ${coins < buyPrice ? "disabled" : ""}>BUY</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", () => buyMarketOffer(offer.id));
    marketList.appendChild(row);
  }
  updateMarketClock();
}

function updateMarketClock() {
  const marketTimer = document.getElementById("marketTimer");
  if (!marketTimer) {
    return;
  }
  const seconds = Math.max(0, Math.ceil((nextMarketRefreshAt - Date.now()) / 1000));
  marketTimer.textContent = `PRICE SHIFT IN 00:${String(seconds).padStart(2, "0")}`;
}

function updateMarket() {
  const now = Date.now();
  if (now >= nextMarketRefreshAt) {
    refreshMarket();
    return;
  }
  if (now >= nextMarketClockUpdateAt) {
    updateMarketClock();
    nextMarketClockUpdateAt = now + 1000;
  }
}

function sellSkin(skinId) {
  const skinIndex = ownedSkins.findIndex((skin) => skin.id === skinId);
  if (skinIndex === -1) {
    return;
  }

  const skin = ownedSkins[skinIndex];
  const sameType = ownedSkins.filter((ownedSkin) => ownedSkin.type === skin.type);
  if (sameType.length <= 1) {
    return;
  }

  ownedSkins.splice(skinIndex, 1);
  coins += getMarketValue(skin);
  if (skin.type === "ball" && selectedSkinId === skin.id) {
    const replacement = ownedSkins.find((ownedSkin) => ownedSkin.type === "ball");
    selectedSkinId = replacement.id;
    selectedBall = replacement.rarity;
  } else if (skin.type === "paddle" && selectedPaddleSkinId === skin.id) {
    selectedPaddleSkinId = ownedSkins.find((ownedSkin) => ownedSkin.type === "paddle").id;
  }
  saveProgress();
}

function buyMarketOffer(offerId) {
  const offerIndex = marketOffers.findIndex((offer) => offer.id === offerId);
  if (offerIndex === -1) {
    return;
  }
  const offer = marketOffers[offerIndex];
  const buyPrice = Math.ceil(getMarketValue(offer) * 1.25);
  if (coins < buyPrice) {
    return;
  }

  coins -= buyPrice;
  ownedSkins.push({ ...offer, id: `skin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  marketOffers.splice(offerIndex, 1);
  saveProgress();
}

function createReelCard(skin) {
  const info = getItemSkinInfo(skin);
  const card = document.createElement("div");
  card.className = `reel-card ${skin.rarity}`;
  card.innerHTML = `
    <span class="reel-card-rarity">${info.label}</span>
    ${skin.specialId === AWP_PADDLE_SKIN_ID
      ? `<img class="reel-skin-image" src="${AWP_PADDLE_IMAGE}" alt="">`
      : skin.type === "paddle"
      ? `<span class="reel-paddle ${skin.rarity}" aria-hidden="true"></span>`
      : `<span class="reel-ball ${skin.rarity}" aria-hidden="true"></span>`}
    <small>${skin.type.toUpperCase()}</small>
    <strong>${info.skin}</strong>
  `;
  return card;
}

function finishCaseOpening(skin) {
  if (skin.type === "paddle") {
    selectedPaddleSkinId = skin.id;
  } else {
    selectedSkinId = skin.id;
    selectedBall = skin.rarity;
  }
  caseAnimating = false;
  saveProgress();

  const info = getItemSkinInfo(skin);
  const caseStatus = document.getElementById("caseStatus");
  const caseResult = document.getElementById("caseResult");
  const continueButton = document.getElementById("caseContinueButton");
  const closeButton = document.getElementById("closeCaseButton");
  caseStatus.textContent = "ITEM ACQUIRED";
  caseResult.innerHTML = `
    <span class="item-type-tag">${skin.type.toUpperCase()}</span>
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

function renderCases() {
  const caseList = document.getElementById("caseList");
  if (!caseList) {
    return;
  }

  caseList.replaceChildren();
  for (const caseConfig of CASES) {
    const topRarities = RARITY_ORDER.filter((rarity) => caseConfig.odds[rarity] >= 5)
      .reverse()
      .map((rarity) => `${caseConfig.odds[rarity]}% ${RARITY_INFO[rarity].label}`)
      .join(" / ");
    const allOdds = RARITY_ORDER.map((rarity) =>
      `${RARITY_INFO[rarity].label.slice(0, 1)} ${caseConfig.odds[rarity]}%`
    ).join(" · ");
    const row = document.createElement("div");
    row.className = `shop-item case-card ${caseConfig.itemType}`;
    row.innerHTML = `
      <div class="case-copy">
        <span class="case-type">${caseConfig.itemType.toUpperCase()} DROP</span>
        <strong>${caseConfig.name}</strong>
        <small>${caseConfig.specialDrop
          ? `${Math.round(caseConfig.specialDrop.chance * 100)}% AWP Lightning Strike`
          : topRarities}</small>
        <small class="case-all-odds">${caseConfig.specialDrop
          ? `90% standard drops (${allOdds})`
          : allOdds}</small>
      </div>
      <button class="buy-button" ${coins < caseConfig.price ? "disabled" : ""}>
        OPEN ${caseConfig.price}
      </button>
    `;
    row.querySelector("button").addEventListener("click", () => openSkinCase(caseConfig.id));
    caseList.appendChild(row);
  }
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  const marketList = document.getElementById("marketList");

  if (!inventoryList || !marketList) {
    return;
  }

  inventoryList.innerHTML = "";
  const typedSkins = ownedSkins.filter((skin) => skin.type === inventoryType);
  for (const rarity of RARITY_ORDER) {
    const skinsOfRarity = typedSkins.filter((ownedSkin) => ownedSkin.rarity === rarity);
    for (const ownedSkin of skinsOfRarity) {
      const skin = getItemSkinInfo(ownedSkin);
      const isEquipped = inventoryType === "paddle"
        ? selectedPaddleSkinId === ownedSkin.id
        : selectedSkinId === ownedSkin.id;
      const item = document.createElement("div");
      item.className = "inventory-item";
      item.innerHTML = `
        <div>
          <span class="rarity-tag ${rarity}">${skin.label}</span>
          <br>
          <strong class="skin-name">${skin.skin}</strong>
          <small>${ownedSkin.condition} | Float ${ownedSkin.float.toFixed(4)}</small>
        </div>
        <div class="inventory-actions">
          <button class="buy-button equip-button" ${isEquipped ? "disabled" : ""}>
            ${isEquipped ? "EQUIPPED" : "EQUIP"}
          </button>
          <button class="buy-button sell-button" ${typedSkins.length <= 1 ? "disabled" : ""}>
            SELL ${getMarketValue(ownedSkin)}
          </button>
        </div>
      `;
      item.querySelector(".equip-button").addEventListener("click", () => {
        if (ownedSkin.type === "paddle") {
          selectedPaddleSkinId = ownedSkin.id;
        } else {
          selectedSkinId = ownedSkin.id;
          selectedBall = rarity;
        }
        saveProgress();
      });
      item.querySelector(".sell-button").addEventListener("click", () => sellSkin(ownedSkin.id));
      inventoryList.appendChild(item);
    }
  }

  document.querySelectorAll("[data-inventory-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.inventoryType === inventoryType);
  });
  renderMarket();
  renderCases();
}

function setMenuMode(mode) {
  menuMode = mode;
  const sections = document.querySelectorAll(".panel-section");
  sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.panel === mode);
  });
}

function openSkinCase(caseId) {
  const caseConfig = CASES.find((item) => item.id === caseId);
  if (!caseConfig || coins < caseConfig.price || caseAnimating) {
    return;
  }

  coins -= caseConfig.price;
  const reward = rollSkin(caseConfig.itemType, caseConfig);
  ownedSkins.push(reward);
  saveProgress();

  const caseOpening = document.getElementById("caseOpening");
  const caseReel = document.getElementById("caseReel");
  const reelTrack = document.getElementById("caseReelTrack");
  const caseTitle = document.getElementById("caseTitle");
  const caseStatus = document.getElementById("caseStatus");
  const caseResult = document.getElementById("caseResult");
  const continueButton = document.getElementById("caseContinueButton");
  const closeButton = document.getElementById("closeCaseButton");
  const winningIndex = 28;
  const reelSkins = Array.from({ length: 36 }, (_, index) => index === winningIndex
    ? reward
    : rollSkin(caseConfig.itemType, caseConfig));

  reelTrack.replaceChildren(...reelSkins.map(createReelCard));
  reelTrack.style.transition = "none";
  reelTrack.style.transform = "translateX(0)";
  caseTitle.textContent = caseConfig.name;
  caseStatus.textContent = `${caseConfig.itemType.toUpperCase()} CASE OPENING...`;
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
  isPaused = false;
  score = 0;
  level = 1;
  combo = 1;
  lives = MAX_LIVES;
  fallingPowerUps = [];
  projectiles = [];
  explosions = [];
  paddleRipples = [];
  brickSparks = [];
  aimCharges = 0;
  comboProtectionTime = 0;
  widePaddleTime = 0;
  setPaddleWidth(PADDLE_BASE_WIDTH);
  bricks = makeBricks(level);
  resetBall();
  lastGameRewardGranted = false;
}

function advanceLevel() {
  level++;
  bricks = makeBricks(level);
  fallingPowerUps = [];
  projectiles = [];
  explosions = [];
  paddleRipples = [];
  brickSparks = [];
  combo = 1;
  resetBall();
}

function startGame() {
  resetGameRound();
  isPaused = false;
  gameState = "playing";
  const menuOverlay = document.getElementById("menuOverlay");
  if (menuOverlay) {
    menuOverlay.classList.add("hidden");
  }
}

function showMenu() {
  isPaused = false;
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
  const closeCaseButton = document.getElementById("closeCaseButton");
  const caseContinueButton = document.getElementById("caseContinueButton");
  const menuTitle = document.getElementById("menuTitle");
  const adminCodeForm = document.getElementById("adminCodeForm");
  let titleClicks = 0;
  let lastTitleClickAt = 0;

  if (startButton) {
    startButton.addEventListener("click", startGame);
  }
  if (inventoryButton) {
    inventoryButton.addEventListener("click", () => setMenuMode("inventory"));
  }
  if (shopButton) {
    shopButton.addEventListener("click", () => setMenuMode("shop"));
  }
  document.querySelectorAll("[data-inventory-type]").forEach((button) => {
    button.addEventListener("click", () => {
      inventoryType = button.dataset.inventoryType;
      renderInventory();
    });
  });
  if (closeCaseButton) {
    closeCaseButton.addEventListener("click", closeCaseOpening);
  }
  if (caseContinueButton) {
    caseContinueButton.addEventListener("click", closeCaseOpening);
  }
  if (menuTitle) {
    menuTitle.addEventListener("click", () => {
      const now = Date.now();
      titleClicks = now - lastTitleClickAt > 1200 ? 1 : titleClicks + 1;
      lastTitleClickAt = now;
      if (titleClicks === 5) {
        setMenuMode("admin");
        titleClicks = 0;
      }
    });
  }
  if (adminCodeForm) {
    adminCodeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const codeInput = document.getElementById("adminCodeInput");
      const status = document.getElementById("adminCodeStatus");
      if (codeInput.value.trim() !== AWP_PADDLE_UNLOCK_CODE) {
        status.textContent = "INVALID CODE";
        return;
      }

      let awpSkin = ownedSkins.find((skin) => skin.specialId === AWP_PADDLE_SKIN_ID);
      if (!awpSkin) {
        awpSkin = {
          id: `skin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "paddle",
          rarity: "legendary",
          specialId: AWP_PADDLE_SKIN_ID,
          condition: "Factory New",
          float: 0.03
        };
        ownedSkins.push(awpSkin);
      }
      selectedPaddleSkinId = awpSkin.id;
      inventoryType = "paddle";
      saveProgress();
      codeInput.value = "";
      status.textContent = "AWP LIGHTNING STRIKE UNLOCKED AND EQUIPPED";
    });
  }
}

// ------------------------------------------------------------
// THE BRICKS (the list is filled in by makeBricks() in bricks.js)
// ------------------------------------------------------------
let bricks = [];
let explosions = [];
let paddleRipples = [];
let brickSparks = [];


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
let isPaused = false;
let rWasDown = false;
let mWasDown = false;
let pWasDown = false;
let lives = MAX_LIVES;
let level = 1;
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
    if (!isPaused) {
      launchBall();
    }
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
  const pJustPressed = keys["p"] && !pWasDown;

  if (pJustPressed && (gameState === "playing" || isPaused) && (pendingCommand === null || isPaused)) {
    isPaused = !isPaused;
  }

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
  pWasDown = keys["p"];
}


// ------------------------------------------------------------
// UPDATE: runs 60 times every second. Move things, then check
// what they touched.
// ------------------------------------------------------------
function update() {
  updateMarket();
  if (gameState === "menu") {
    return;
  }

  checkCommands();
  if (gameState === "menu" || isPaused) {
    return;
  }

  if (gameState === "won" || gameState === "lost") {
    grantLastGameReward();
    return;
  }

  movePaddle();
  updateMovingBrickRow();
  updatePaddleRipples();
  updateBrickSparks();
  if (!ballLaunched) {
    ball.x = paddle.x + paddle.width / 2 - ball.width / 2;
    ball.y = paddle.y - ball.height;
    return;
  }

  clampBallSpeed();
  moveBall();

  bounceOffWalls();   // collisions.js
  bounceOffPaddle();  // collisions.js
  bounceOffBricks();  // collisions.js
  updatePowerUps();
  updateProjectiles();
  updateBrickEffects();
  updatePowerUpTimers();
  if (bricks.length === 0 && gameState === "playing") {
    if (level < LEVEL_LAYOUTS.length) {
      advanceLevel();
    } else {
      gameState = "won";
    }
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
    lastPaddleDirection = -1;
  }
  if (keys["arrowright"] || keys["d"]) {
    paddle.x = paddle.x + paddle.speed;
    lastPaddleDirection = 1;
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
  const awpBarrel = getAwpBarrelPosition();
  const startX = awpBarrel
    ? awpBarrel.x + awpBarrel.direction * 4
    : paddle.x + paddle.width / 2;
  const startY = awpBarrel ? awpBarrel.y : paddle.y;
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
        hitBrick(brick);
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

function clampBallSpeed() {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > BALL_MAX_SPEED) {
    const scale = BALL_MAX_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }
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

function getSkinWearValue(skin) {
  const wear = Number(skin?.float ?? 0.03);
  return Math.max(0, Math.min(1, wear));
}

function drawWearTexture({ x, y, width, height, wear, tint = "rgba(7, 12, 18, 0.58)", rotation = 0 }) {
  const scratches = Math.max(4, Math.round(6 + wear * 18));
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.translate(-(x + width / 2), -(y + height / 2));
  ctx.lineCap = "round";

  for (let index = 0; index < scratches; index++) {
    const baseX = x + width * (0.12 + ((index * 0.19) % 0.78));
    const baseY = y + height * (0.08 + ((index * 0.27) % 0.72));
    const endX = x + width * (0.78 + ((index % 3) - 1) * 0.12);
    const endY = y + height * (0.7 + ((index + 1) % 4) * 0.12);
    ctx.strokeStyle = `rgba(8, 12, 18, ${0.2 + wear * 0.5})`;
    ctx.lineWidth = 1 + wear * 1.8;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  const chipCount = Math.max(1, Math.round(2 + wear * 8));
  for (let index = 0; index < chipCount; index++) {
    const chipX = x + width * ((index * 0.23 + 0.15) % 1);
    const chipY = y + height * ((index * 0.31 + 0.11) % 1);
    const chipRadius = Math.max(2, width * (0.03 + wear * 0.06));
    ctx.fillStyle = `rgba(12, 18, 24, ${0.08 + wear * 0.28})`;
    ctx.beginPath();
    ctx.arc(chipX, chipY, chipRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = tint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, width - 4, height - 4);
  ctx.stroke();
  ctx.restore();
}

function drawPaddle() {
  const equippedSkin = ownedSkins.find((skin) => skin.id === selectedPaddleSkinId) || { rarity: "common", float: 0.03 };
  const skinInfo = PADDLE_SKIN_INFO[equippedSkin.rarity || "common"];
  const color = skinInfo.color;
  if (equippedSkin.specialId === AWP_PADDLE_SKIN_ID) {
    ctx.save();
    ctx.fillStyle = "#160f25";
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    if (awpPaddleTexture) {
      const imageHeight = paddle.height + 4;
      ctx.imageSmoothingEnabled = true;
      if (lastPaddleDirection > 0) {
        ctx.translate(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(awpPaddleTexture, -paddle.width / 2, -imageHeight / 2, paddle.width, imageHeight);
      } else {
        ctx.drawImage(awpPaddleTexture, paddle.x, paddle.y - 2, paddle.width, imageHeight);
      }
    }
    ctx.restore();
    return;
  }
  const sideWidth = Math.max(10, paddle.width * 0.18);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  ctx.fillStyle = "#101827";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

  ctx.fillStyle = color;
  ctx.fillRect(paddle.x + sideWidth, paddle.y, paddle.width - sideWidth * 2, paddle.height);

  ctx.fillStyle = "rgba(255, 136, 164, 0.9)";
  ctx.fillRect(paddle.x, paddle.y, sideWidth, paddle.height);

  ctx.fillStyle = "rgba(92, 214, 255, 0.8)";
  ctx.fillRect(paddle.x + paddle.width - sideWidth, paddle.y, sideWidth, paddle.height);

  if (["stripes", "gold"].includes(skinInfo.pattern)) {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.clip();
    ctx.translate(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2);
    ctx.rotate(-0.45);
    ctx.fillStyle = skinInfo.pattern === "gold" ? "rgba(255, 255, 255, 0.75)" : "rgba(8, 13, 24, 0.55)";
    for (let stripe = -paddle.width; stripe < paddle.width; stripe += 14) {
      ctx.fillRect(stripe, -paddle.width, 5, paddle.width * 2);
    }
  } else if (skinInfo.pattern === "split") {
    ctx.fillStyle = "rgba(8, 13, 24, 0.55)";
    ctx.fillRect(paddle.x + paddle.width / 2, paddle.y, paddle.width / 2, paddle.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillRect(paddle.x + paddle.width / 2 - 1, paddle.y + 2, 2, paddle.height - 4);
  } else if (skinInfo.pattern === "glow") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillRect(paddle.x + 8, paddle.y + 2, paddle.width - 16, 2);
  }

  drawWearTexture({
    x: paddle.x,
    y: paddle.y,
    width: paddle.width,
    height: paddle.height,
    wear: getSkinWearValue(equippedSkin),
    tint: "rgba(14, 20, 28, 0.45)",
    rotation: -0.28
  });
  ctx.restore();
}

function drawBall() {
  if (!ballLaunched && getAwpBarrelPosition()) {
    return;
  }

  const equippedSkin = ownedSkins.find((skin) => skin.id === selectedSkinId) || { rarity: selectedBall, float: 0.03 };
  const skin = { ...RARITY_INFO[equippedSkin.rarity || selectedBall], ...equippedSkin };
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

  drawWearTexture({
    x: ball.x,
    y: ball.y,
    width: ball.width,
    height: ball.height,
    wear: getSkinWearValue(equippedSkin),
    tint: "rgba(15, 23, 32, 0.68)",
    rotation: 0.9
  });
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

function drawPaddleRipples() {
  for (const ripple of paddleRipples) {
    const alpha = 1 - ripple.age / ripple.duration;
    ctx.save();
    ctx.strokeStyle = `rgba(57, 245, 255, ${Math.max(0, alpha * 0.9)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLaunchAim() {
  if (gameState !== "playing" || ballLaunched) {
    return;
  }

  const awpBarrel = getAwpBarrelPosition();
  const startX = awpBarrel
    ? awpBarrel.x + awpBarrel.direction * ball.width / 2
    : paddle.x + paddle.width / 2;
  const startY = awpBarrel ? awpBarrel.y : paddle.y - 4;
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

  const awpBarrel = getAwpBarrelPosition();
  const startX = awpBarrel
    ? awpBarrel.x + awpBarrel.direction * 4
    : paddle.x + paddle.width / 2;
  const startY = awpBarrel ? awpBarrel.y : paddle.y - 5;
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
  drawBrickEffects();
  drawPowerUps();
  drawProjectiles();
  drawPaddle();
  drawPaddleRipples();
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
  ctx.textAlign = "center";
  ctx.fillStyle = "#e7f2ff";
  ctx.fillText("LEVEL // " + level + "/" + LEVEL_LAYOUTS.length, WIDTH / 2, 11);
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

  if (gameState === "won" || gameState === "lost" || pendingCommand !== null || isPaused) {
    ctx.fillStyle = "rgba(5, 10, 20, 0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 18;
    const overlayColor = isPaused || gameState === "won" ? "#39f5ff" : "#ff477e";
    ctx.shadowColor = overlayColor;
    ctx.fillStyle = overlayColor;
    ctx.font = "700 28px 'Orbitron', monospace";
    const title = pendingCommand === "restart"
      ? "RESTART?"
      : pendingCommand === "menu"
        ? "RETURN TO MENU?"
        : isPaused
          ? "PAUSED"
          : gameState === "won" ? "SYSTEM CLEARED" : "GAME OVER";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e7f2ff";
    ctx.font = "12px 'Space Mono', monospace";
    const prompt = pendingCommand === "restart"
      ? "PRESS R AGAIN TO CONFIRM"
      : pendingCommand === "menu"
        ? "PRESS M AGAIN TO CONFIRM"
        : isPaused
          ? "PRESS P TO RESUME"
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
  refreshMarket();
  renderInventory();
  saveProgress();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
