var canvas, c;
const SCALE = 0.4;
const PARALLAX_FACTOR = 1.5;
const INV_SCALE = 1 / SCALE;
var animationFrameId = null;
var resizeGameCanvas = null;
var healthBarImages = null;
var gamePaused = false;
var overlayTweenFrame = null;
var hudTotalGoldCollected = 0;
window.DEBUG_COLLISIONS = false;
var movementGuide = {
  active: false,
  startedAt: 0,
};
var attackGuide = {
  active: false,
  startedAt: 0,
};
var deathScreen = {
  active: false,
  text: 'YOU DIED',
};

function stopGame() {
  setGamePaused(false);

  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (resizeGameCanvas) {
    window.removeEventListener('resize', resizeGameCanvas);
    resizeGameCanvas = null;
  }
}

function setGamePaused(paused) {
  gamePaused = Boolean(paused);
  window.gamePaused = gamePaused;

  if (gamePaused && typeof resetGameplayKeys === 'function') {
    resetGameplayKeys();
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

  const totalGold = Number.isFinite(Number(hudTotalGoldCollected))
    ? Math.max(0, Math.floor(Number(hudTotalGoldCollected)))
    : 0;
  const totalGoldText = `${totalGold} ◈`;
  const textX = 110;
  const textY = 80;
  c.font = '700 22px "Silkscreen", "Pixelify Sans", Arial';
  const textWidth = c.measureText(totalGoldText).width;
  const boxWidth = Math.max(88, textWidth + 24);

  c.fillStyle = 'rgba(0, 0, 0, 0.72)';
  c.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(textX, textY, boxWidth, 34, 5);
  c.fill();
  c.stroke();

  c.fillStyle = '#ffd84a';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(totalGoldText, textX + 12, textY + 18);

  c.restore();
}

function setEarnedGoldHud(totalGold) {
  hudTotalGoldCollected = Number.isFinite(Number(totalGold)) ? Number(totalGold) : 0;
}

function resetMovementGuide() {
  movementGuide.active = true;
  movementGuide.startedAt = performance.now ? performance.now() : Date.now();
}

function dismissMovementGuide() {
  movementGuide.active = false;
}

function resetAttackGuide() {
  attackGuide.active = true;
  attackGuide.startedAt = performance.now ? performance.now() : Date.now();
}

function dismissAttackGuide() {
  attackGuide.active = false;
}

function drawMovementGuide() {
  if (!movementGuide.active || typeof player === 'undefined' || player.isDead) return;

  const now = performance.now ? performance.now() : Date.now();
  const elapsed = now - movementGuide.startedAt;
  if (elapsed >= 3000) {
    dismissMovementGuide();
    return;
  }
  const fadeStart = 2000;
  const opacity = elapsed <= fadeStart
    ? 1
    : Math.max(0, 1 - (elapsed - fadeStart) / (3000 - fadeStart));

  const box = player.hitbox || {
    position: {
      x: player.position.x + 130,
      y: player.position.y + 10,
    },
    width: 70,
    height: 300,
  };

  const centerX = box.position.x + box.width / 2;
  const topY = box.position.y - 400;
  const keyWidth = 200;
  const keyHeight = 150;
  const gap = 14;

  const bob = Math.sin(elapsed / 260) * 6;

  function drawKey(label, x, y) {
    c.save();
    c.globalAlpha = opacity;
    c.fillStyle = 'rgba(0, 0, 0, 0.72)';
    c.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    c.lineWidth = 6;
    c.beginPath();
    c.roundRect(x, y + bob, keyWidth, keyHeight, 6);
    c.fill();
    c.stroke();

    c.fillStyle = 'white';
    const fontSize = label.length > 6 ? 42 : label.length > 1 ? 64 : 100;
    c.font = `700 ${fontSize}px "Pixelify Sans", Arial`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x + keyWidth / 2, y + bob + keyHeight / 2 + 1);
    c.restore();
  }

  const keybinds = window.overboundKeybinds || {};
  drawKey(formatKeybindLabel(keybinds.jump || 'KeyW'), centerX - keyWidth / 2, topY);
  drawKey(formatKeybindLabel(keybinds.moveLeft || 'KeyA'), centerX - keyWidth - gap / 2, topY + keyHeight + gap);
  drawKey(formatKeybindLabel(keybinds.moveRight || 'KeyD'), centerX + gap / 2, topY + keyHeight + gap);
}

function drawAttackGuide() {
  if (!attackGuide.active || typeof player === 'undefined' || player.isDead) return;

  const now = performance.now ? performance.now() : Date.now();
  const elapsed = now - attackGuide.startedAt;
  if (elapsed >= 3500) {
    dismissAttackGuide();
    return;
  }

  const fadeStart = 2400;
  const opacity = elapsed <= fadeStart
    ? 1
    : Math.max(0, 1 - (elapsed - fadeStart) / (3500 - fadeStart));

  const box = player.hitbox || {
    position: {
      x: player.position.x + 130,
      y: player.position.y + 10,
    },
    width: 70,
    height: 300,
  };

  const bob = Math.sin(elapsed / 260) * 6;
  const keybinds = window.overboundKeybinds || {};
  const label = formatKeybindLabel(keybinds.attack || 'KeyI');
  const keyWidth = 200;
  const keyHeight = 150;
  const keyX = box.position.x + box.width + 150;
  const keyY = box.position.y - 250;

  c.save();
  c.globalAlpha = opacity;
  c.fillStyle = 'rgba(0, 0, 0, 0.72)';
  c.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(keyX, keyY + bob, keyWidth, keyHeight, 6);
  c.fill();
  c.stroke();

  c.fillStyle = 'white';
  const fontSize = label.length > 6 ? 42 : label.length > 1 ? 64 : 100;
  c.font = `700 ${fontSize}px "Pixelify Sans", Arial`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, keyX + keyWidth / 2, keyY + bob + keyHeight / 2 + 1);

  c.strokeStyle = '#ffd84a';
  c.lineWidth = 12;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(keyX + keyWidth + 70, keyY + bob + 25);
  c.quadraticCurveTo(keyX + keyWidth + 190, keyY + bob + 70, keyX + keyWidth + 80, keyY + bob + 135);
  c.stroke();
  c.restore();
}

function fadeGameOverlayTo(opacity, duration = 0.5, onComplete) {
  const targetOpacity = Math.max(0, Math.min(1, opacity));

  if (typeof overlay === 'undefined') {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  if (overlayTweenFrame !== null) {
    window.cancelAnimationFrame(overlayTweenFrame);
    overlayTweenFrame = null;
  }

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(overlay);
    gsap.to(overlay, {
      opacity: targetOpacity,
      duration: duration,
      onComplete: onComplete
    });
    return;
  }

  const startOpacity = Number.isFinite(overlay.opacity) ? overlay.opacity : 0;
  const startedAt = performance.now ? performance.now() : Date.now();
  const durationMs = Math.max(0, duration * 1000);

  if (durationMs === 0) {
    overlay.opacity = targetOpacity;
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  const tick = () => {
    const now = performance.now ? performance.now() : Date.now();
    const progress = Math.min(1, (now - startedAt) / durationMs);
    overlay.opacity = startOpacity + (targetOpacity - startOpacity) * progress;

    if (progress < 1) {
      overlayTweenFrame = window.requestAnimationFrame(tick);
      return;
    }

    overlayTweenFrame = null;
    if (typeof onComplete === 'function') onComplete();
  };

  overlayTweenFrame = window.requestAnimationFrame(tick);
}

function drawDeathScreen() {
  if (!deathScreen.active || !canvas || !c) return;

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = Math.max(0, Math.min(1, overlay?.opacity ?? 1));
  c.fillStyle = '#f2f2f2';
  c.font = '700 104px "Silkscreen", "Pixelify Sans", Arial';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(deathScreen.text, canvas.width / 2, canvas.height / 2);
  c.restore();
}

function playDeathRespawnTransition(respawn) {
  deathScreen.active = true;

  const finishRespawn = () => {
    if (typeof respawn === 'function') {
      respawn();
    }

    window.setTimeout(() => {
      fadeGameOverlayTo(0, 1, () => {
        deathScreen.active = false;
      });
    }, 500);
  };

  if (typeof fadeGameOverlayTo === 'function') {
    fadeGameOverlayTo(1, 0.9, () => {
      window.setTimeout(finishRespawn, 850);
    });
    return;
  }

  if (typeof overlay !== 'undefined') {
    overlay.opacity = 1;
  }
  window.setTimeout(() => {
    finishRespawn();
    if (typeof overlay !== 'undefined') {
      overlay.opacity = 0;
    }
  }, 900);
}

function formatKeybindLabel(code) {
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.replace('Key', '');
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Arrow')) return code.replace('Arrow', 'Arrow ');
  return code;
}

function startGame() {
  stopGame();

  canvas = window.canvas;
  if (typeof overlay !== 'undefined') {
    overlay.opacity = 1;
  }
  let initialFadeStarted = false;

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

  // console.log(screen.width)
  // console.log(screen.height)
  // console.log('levels:', window.levels);
  // console.log('level:', window.level);
  window.levels[window.level].init();
  resetMovementGuide();

  function animate() {
    animationFrameId = window.requestAnimationFrame(animate);

    if (gamePaused || window.gamePaused) {
      return;
    }

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

    
    // normal movement only when not being knocked back or typing in NPC chat
    if (window.npcChatOpen) {
      player.velocity.x = 0;
    } else if (!player.knockbackFrames || player.knockbackFrames <= 0) {
      player.velocity.x = 0;                  
      player.playerMovement();
    }
    player.draw();
    drawMovementGuide();
    drawAttackGuide();
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

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = overlay.opacity;
    c.fillStyle = "black";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
    drawDeathScreen();

    if (!initialFadeStarted) {
      initialFadeStarted = true;
      window.requestAnimationFrame(() => fadeGameOverlayTo(0, 0.55));
    }
  }

  animate();
}

window.startGame = startGame;
window.stopGame = stopGame;
window.setGamePaused = setGamePaused;
window.fadeGameOverlayTo = fadeGameOverlayTo;
window.setEarnedGoldHud = setEarnedGoldHud;
window.playDeathRespawnTransition = playDeathRespawnTransition;
