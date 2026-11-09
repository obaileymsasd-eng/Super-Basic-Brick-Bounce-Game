// ============================================================
// collisions.js: what happens when the ball touches something
//
// To "bounce", we flip the ball's speed:
//   hit something sideways -> vx = -vx
//   hit something above or below -> vy = -vy
// ============================================================

// Returns true if two rectangles (like the ball and a brick) overlap.
function boxesTouch(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}


// The ball bounces off the left, right, and top walls.
// (The bottom is not a wall: falling off the bottom resets the ball.)
function bounceOffWalls() {
  if (ball.x < 0) {
    ball.x = 0;
    ball.vx = -ball.vx;
  }
  if (ball.x + ball.width > WIDTH) {
    ball.x = WIDTH - ball.width;
    ball.vx = -ball.vx;
  }
  if (ball.y < 0) {
    ball.y = 0;
    ball.vy = -ball.vy;

  }
}


// The ball bounces off the top of the paddle.
// ball.vy > 0 means "the ball is moving down", so it only bounces
// when it is falling onto the paddle.
function bounceOffPaddle() {
  if (!boxesTouch(ball, paddle) || ball.vy <= 0) {
    return;
  }

  const ballCenterX = ball.x + ball.width / 2;
  const cornerWidth = Math.min(12, Math.max(8, paddle.width * 0.08));
  const leftCorner = ballCenterX < paddle.x + cornerWidth;
  const rightCorner = ballCenterX > paddle.x + paddle.width - cornerWidth;
  const speed = Math.hypot(ball.vx, ball.vy) || 5;

  ball.y = paddle.y - ball.height;

  if (leftCorner || rightCorner) {
    const side = leftCorner ? -1 : 1;
    const offset = leftCorner
      ? (ballCenterX - paddle.x) / cornerWidth
      : (paddle.x + paddle.width - ballCenterX) / cornerWidth;
    const normalized = Math.max(0, Math.min(1, offset));
    const angle = side * (18 + normalized * 52) * (Math.PI / 180);

    ball.vx = Math.sin(angle) * speed * 1.1;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
  } else {
    ball.vx *= 0.22;
    ball.vy = -Math.abs(ball.vy || speed);
  }

  paddleRipples.push({
    x: ballCenterX,
    y: paddle.y + paddle.height / 2,
    radius: 6,
    age: 0,
    duration: 0.5
  });

  if (comboProtectionTime === 0) {
    combo = 1;
  }
}

function updatePaddleRipples() {
  for (let index = paddleRipples.length - 1; index >= 0; index--) {
    const ripple = paddleRipples[index];
    ripple.age += STEP / 1000;
    ripple.radius = 6 + (ripple.age / ripple.duration) * 34;
    if (ripple.age >= ripple.duration) {
      paddleRipples.splice(index, 1);
    }
  }
}

function destroyBrick(brick) {
  const index = bricks.indexOf(brick);
  if (index === -1) {
    return;
  }

  bricks.splice(index, 1);
  score = score + 10 * combo;
  combo = combo + 0.5;
  spawnPowerUp(brick);
}

function hitBrick(brick) {
  if (!bricks.includes(brick)) {
    return;
  }

  if (brick.type === "tnt") {
    if (brick.fuseRemaining === 0) {
      brick.fuseRemaining = TNT_FUSE_SECONDS;
    }
    return;
  }

  brick.hitsRemaining--;
  if (brick.hitsRemaining <= 0) {
    destroyBrick(brick);
  }
}

function detonateTnt(brick) {
  if (!bricks.includes(brick)) {
    return;
  }

  const neighbors = bricks.filter((candidate) => candidate !== brick &&
    Math.abs(candidate.row - brick.row) <= 1 && Math.abs(candidate.col - brick.col) <= 1);
  explosions.push({
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height / 2,
    age: 0,
    duration: 0.42,
    radius: Math.hypot(BRICK_WIDTH + BRICK_GAP, BRICK_HEIGHT + BRICK_GAP) * 1.1
  });

  destroyBrick(brick);
  for (const neighbor of neighbors) {
    destroyBrick(neighbor);
  }
}

function updateBrickEffects() {
  const elapsed = STEP / 1000;
  for (const brick of [...bricks]) {
    if (brick.type === "tnt" && brick.fuseRemaining > 0) {
      brick.fuseRemaining -= elapsed;
      if (brick.fuseRemaining <= 0) {
        detonateTnt(brick);
      }
    }
  }

  for (let index = explosions.length - 1; index >= 0; index--) {
    explosions[index].age += elapsed;
    if (explosions[index].age >= explosions[index].duration) {
      explosions.splice(index, 1);
    }
  }
}

function updateBrickSparks() {
  for (let index = brickSparks.length - 1; index >= 0; index--) {
    const spark = brickSparks[index];
    spark.age += STEP / 1000;
    spark.x += spark.vx * (STEP / 16.67);
    spark.y += spark.vy * (STEP / 16.67);
    spark.vx *= 0.94;
    spark.vy *= 0.94;
    if (spark.age >= spark.life) {
      brickSparks.splice(index, 1);
    }
  }
}

function spawnBrickSparks(x, y, color) {
  for (let index = 0; index < 7; index++) {
    const angle = (Math.PI * 2 * index) / 7 + Math.random() * 0.8;
    const speed = 0.8 + Math.random() * 2.2;
    brickSparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + Math.random() * 2.4,
      color,
      age: 0,
      life: 0.35 + Math.random() * 0.25
    });
  }
}


// The ball bounces off and breaks a brick.
function bounceOffBricks() {
  for (const brick of bricks) {
    if (!boxesTouch(ball, brick)) {
      continue;  // not touching this brick, check the next one
    }

    // How far has the ball pushed into the brick on each side?
    const overlapX = Math.min(ball.x + ball.width, brick.x + brick.width) - Math.max(ball.x, brick.x);
    const overlapY = Math.min(ball.y + ball.height, brick.y + brick.height) - Math.max(ball.y, brick.y);

    if (overlapX < overlapY) {
      // The ball hit the brick's left or right side.
      ball.vx = -ball.vx;
      if (ball.x < brick.x) {
        ball.x = brick.x - ball.width;     // left of the brick
      } else {
        ball.x = brick.x + brick.width;    // right of the brick
      }
    } else {
      // The ball hit the brick's top or bottom.
      ball.vy = -ball.vy;
      if (ball.y < brick.y) {
        ball.y = brick.y - ball.height;    // above the brick
      } else {
        ball.y = brick.y + brick.height;   // below the brick
      }
    }
    hitBrick(brick);
    spawnBrickSparks(
      brick.x + brick.width / 2,
      brick.y + brick.height / 2,
      brick.type === "tnt" ? "#ff9f43" : "#d7ff47"
    );

    break;  // bounce off one brick per update, then stop looking
  }
}
