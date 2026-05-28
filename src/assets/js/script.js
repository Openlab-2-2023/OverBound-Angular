var canvas, c;
const SCALE = 0.4;
const PARALLAX_FACTOR = 1.5;
const INV_SCALE = 1 / SCALE;
// simple HUD state for recent gold gains
var goldGainFx = [];
var animationFrameId = null;
var resizeGameCanvas = null;
var healthBarImages = null;

function stopGame() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (resizeGameCanvas) {
    window.removeEventListener('resize', resizeGameCanvas);
    resizeGameCanvas = null;
  }
}

function isBoxNearView(box, viewX, viewY, viewWidth, viewHeight, margin = 300) {
  if (!box || !box.position) return false;

  return box.position.x + box.width >= viewX - margin &&
    box.position.x <= viewX + viewWidth + margin &&
    box.position.y + box.height >= viewY - margin &&
    box.position.y <= viewY + viewHeight + margin;
}

function getSpriteBox(sprite) {
  if (!sprite) return null;
  if (typeof sprite.getDrawBox === 'function') return sprite.getDrawBox();

  return {
    position: sprite.position,
    width: sprite.width || 0,
    height: sprite.height || 0,
  };
}

function drawVisibleSpriteList(sprites, viewX, viewY, viewWidth, viewHeight, margin = 300) {
  if (!Array.isArray(sprites) || !sprites.length) return;

  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    if (!sprite || !sprite.loaded) continue;
    if (!isBoxNearView(getSpriteBox(sprite), viewX, viewY, viewWidth, viewHeight, margin)) continue;
    sprite.draw();
  }
}

function getHealthBarImages() {
  if (healthBarImages) return healthBarImages;

  healthBarImages = {
    frame: getSpriteImage('/assets/sprites/hbar/Frame.png'),
    4: getSpriteImage('/assets/sprites/hbar/100.png'),
    3: getSpriteImage('/assets/sprites/hbar/74.png'),
    2: getSpriteImage('/assets/sprites/hbar/50.png'),
    1: getSpriteImage('/assets/sprites/hbar/24.png'),
    0: getSpriteImage('/assets/sprites/hbar/0.png'),
  };

  return healthBarImages;
}

function drawHealthBar() {
  if (typeof player === 'undefined' || !canvas || !c) return;

  const images = getHealthBarImages();
  const health = Math.max(0, Math.min(player.maxHealth || 4, player.health || 0));
  const fillImage = images[health];
  const frameImage = images.frame;
  const x = 5;
  const y = -50;
  const size = 300;

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;

  if (fillImage && fillImage.complete && fillImage.naturalWidth > 0) {
    c.drawImage(fillImage, x, y, size, size);
  }
  if (frameImage && frameImage.complete && frameImage.naturalWidth > 0) {
    c.drawImage(frameImage, x, y, size, size);
  }

  c.restore();
}

function startGame() {
  stopGame();

  canvas = window.canvas;

  const camera = new Camera()

  c = canvas.getContext("2d");

  resizeGameCanvas = function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    c.imageSmoothingEnabled = false;
  };
  resizeGameCanvas();
  window.addEventListener('resize', resizeGameCanvas);

  // expose HUD helpers if needed from other scripts
  window._addGoldGainFx = function (amount) {
    if (!canvas) return;
    const now = performance.now ? performance.now() : Date.now();
    goldGainFx.push({
      amount: amount,
      startTime: now,
      duration: 1000, // ms
    });
  };

  function drawGoldGainFx() {
    if (!goldGainFx.length) return;
    const now = performance.now ? performance.now() : Date.now();
    const keep = [];

    for (var i = 0; i < goldGainFx.length; i++) {
      var fx = goldGainFx[i];
      var elapsed = now - fx.startTime;
      if (elapsed >= fx.duration) {
        continue;
      }
      keep.push(fx);

      var tNorm = elapsed / fx.duration; // 0..1
      var alpha = 1 - tNorm;
      var offsetY = tNorm * 30; // float upward

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = alpha;
      c.fillStyle = '#ffd84a';
      c.font = '32px Arial';
      var text = '+' + fx.amount + ' ◈';
      c.fillText(text, 24, 40 - offsetY);
      c.restore();
    }

    goldGainFx = keep;
  }

  // console.log(screen.width)
  // console.log(screen.height)
  // console.log('levels:', window.levels);
  // console.log('level:', window.level);
  window.levels[window.level].init();

  function animate() {
    animationFrameId = window.requestAnimationFrame(animate);

    c.setTransform(1, 0, 0, 1, 0, 0);

    camera.updateCamera();
    c.scale(SCALE, SCALE);
    c.translate(-camera.position.x, -camera.position.y);
    const viewX = camera.position.x;
    const viewY = camera.position.y;
    const viewWidth = canvas.width * INV_SCALE;
    const viewHeight = canvas.height * INV_SCALE;

    if (background && typeof background.drawVisible === 'function') {
      background.drawVisible(viewX, viewY, viewWidth, viewHeight);
    } else {
      background.draw();
    }
    if (window.DEBUG_COLLISIONS) {
      collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    }
    drawVisibleSpriteList(portals, viewX, viewY, viewWidth, viewHeight);
    drawVisibleSpriteList(animals, viewX, viewY, viewWidth, viewHeight);
    drawVisibleSpriteList(risks, viewX, viewY, viewWidth, viewHeight);
    drawVisibleSpriteList(clouds, viewX, viewY, viewWidth, viewHeight);
    drawVisibleSpriteList(npcs, viewX, viewY, viewWidth, viewHeight);

    if (Array.isArray(enemies) && enemies.some((enemy) => enemy.isDead)) {
      enemies = enemies.filter((enemy) => !enemy.isDead);
    }

    enemies.forEach((enemy) => {
      if (!enemy || !enemy.loaded) return;
      if (!isBoxNearView(enemy.getDrawBox(), viewX, viewY, viewWidth, viewHeight, 600)) return;
      if (typeof enemy.updateDamageHitBox === 'function') {
        enemy.updateDamageHitBox();
      }
      enemy.draw();
    });

    
    // normal movement only when not being knocked back
    if (!player.knockbackFrames || player.knockbackFrames <= 0) {
      player.velocity.x = 0;                  
      player.playerMovement();
    }
    player.draw();
    if (typeof foregrounds !== 'undefined' && foregrounds && foregrounds.length) {
      const parallaxOffsetX = camera.position.x * (PARALLAX_FACTOR - 1);

      for (let i = 0; i < foregrounds.length; i++) {
        const foreground = foregrounds[i];
        if (!foreground || !foreground.loaded) continue;

        if (!foreground.basePosition) {
          foreground.basePosition = {
            x: foreground.position.x,
            y: foreground.position.y,
          };
        }

        const worldX = foreground.basePosition.x - parallaxOffsetX;
        const worldY = foreground.basePosition.y;
        const width = foreground.width || 0;
        const height = foreground.height || 0;

        if (
          worldX + width < viewX ||
          worldX > viewX + viewWidth ||
          worldY + height < viewY ||
          worldY > viewY + viewHeight
        ) {
          continue;
        }

        foreground.position.x = worldX;
        foreground.position.y = worldY;
        foreground.draw();
      }
    }                                                            
    player.update();
    player.detectCloud();
    player.detectRisk();
    // first detect NPC proximity / dialog, then enemy hits
    player.detectNpc();
    player.detectEnemy();
    player.textAppear();


    enemies.forEach((enemy) => {
      if (!enemy || !enemy.loaded) return;
      const box = typeof enemy.getDrawBox === 'function' ? enemy.getDrawBox() : getSpriteBox(enemy);
      if (!isBoxNearView(box, viewX, viewY, viewWidth, viewHeight, 1200)) return;
      enemy.update();
    });


    if (typeof drawNpcDialogBar === 'function') {
      drawNpcDialogBar();
    }

    // HUD overlays (screen space)
    drawHealthBar();
    drawGoldGainFx();

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = overlay.opacity;
    c.fillStyle = "black";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
  }

  animate();
}

window.startGame = startGame;
window.stopGame = stopGame;
