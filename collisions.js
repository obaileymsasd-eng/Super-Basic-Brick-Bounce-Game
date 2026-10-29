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
  if (boxesTouch(ball, paddle) && ball.vy > 0) {
    ball.y = paddle.y - ball.height;  // sit on top of the paddle
    ball.vy = -ball.vy;
    if (comboProtectionTime === 0) {
      combo = 1;
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

    break;  // bounce off one brick per update, then stop looking
  }
}
