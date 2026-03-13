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

    

    c.scale(0.4,0.4)
    c.translate(-camera.position.x, -camera.position.y)
    camera.updateCamera()
    background.draw();
    collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    portals.forEach((portal) => portal.draw());
    animals.forEach((animal) => animal.draw());
    risks.forEach((risk) => risk.draw());
    clouds.forEach((cloud) => cloud.draw());
    npcs.forEach((npcs) => npcs.draw());
    enemies.forEach((enemies) => enemies.draw());



    player.velocity.x = 0;
    player.playerMovement();
    kolagen.refill();
    player.draw();
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
