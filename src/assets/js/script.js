var canvas, c;
const SCALE = 0.4;
const PARALLAX_FACTOR = 1.5;
const INV_SCALE = 1 / SCALE;
// simple HUD state for recent gold gains
var goldGainFx = [];

function startGame() {
  canvas = window.canvas;

  const camera = new Camera()

  c = canvas.getContext("2d");

  canvas.width = screen.width;
  canvas.height = screen.height;

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
    window.requestAnimationFrame(animate);

    c.setTransform(1, 0, 0, 1, 0, 0);

    camera.updateCamera();
    c.scale(SCALE, SCALE);
    c.translate(-camera.position.x, -camera.position.y);
    background.draw();
    collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    portals.forEach((portal) => portal.draw());
    animals.forEach((animal) => animal.draw());
    risks.forEach((risk) => risk.draw());
    clouds.forEach((cloud) => cloud.draw());
    npcs.forEach((npcs) => npcs.draw());

    // remove dead enemies before drawing / updating
    if (Array.isArray(enemies)) {
      enemies = enemies.filter((enemy) => !enemy.isDead);
    }

    enemies.forEach((enemy) => {
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
    kolagen.refill();
    player.draw();
    if (typeof foregrounds !== 'undefined' && foregrounds && foregrounds.length) {
      const viewX = camera.position.x;
      const viewY = camera.position.y;
      const viewWidth = canvas.width * INV_SCALE;
      const viewHeight = canvas.height * INV_SCALE;
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


    enemies.forEach((enemies) => enemies.update());


    if (typeof drawNpcDialogBar === 'function') {
      drawNpcDialogBar();
    }

    // HUD overlays (screen space)
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
