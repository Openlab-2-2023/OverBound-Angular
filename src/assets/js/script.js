var canvas, c, t;
function startGame() {
  canvas = window.canvas;

  const camera = new Camera()

  c = canvas.getContext("2d");
  t = canvas.getContext("2d");

  canvas.width = screen.width;
  canvas.height = screen.height;

  // console.log(screen.width)
  // console.log(screen.height)
  // console.log('levels:', window.levels);
  // console.log('level:', window.level);
  window.levels[window.level].init();

  function animate() {
    window.requestAnimationFrame(animate);

    c.setTransform(1, 0, 0, 1, 0, 0);

    camera.updateCamera()
    c.scale(0.4,0.4)
    c.translate(-camera.position.x, -camera.position.y)
    background.draw();
    collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    portals.forEach((portal) => portal.draw());
    animals.forEach((animal) => animal.draw());
    risks.forEach((risk) => risk.draw());
    clouds.forEach((cloud) => cloud.draw());
    npcs.forEach((npcs) => npcs.draw());
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
      const parallaxFactor = 1.5
      foregrounds.forEach((foreground) => {
        if (!foreground.basePosition) {
          foreground.basePosition = {
            x: foreground.position.x,
            y: foreground.position.y,
          }
        }
        foreground.position.x =
          foreground.basePosition.x - camera.position.x * (parallaxFactor - 1)
        foreground.draw()
      })
    }                                                            
    player.update();
    player.detectCloud();
    player.detectRisk();
    player.detectEnemy();
    player.detectNpc();
    player.textAppear();


    enemies.forEach((enemies) => enemies.update());


    if (typeof drawNpcDialogBar === 'function') {
      drawNpcDialogBar();
    }

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
