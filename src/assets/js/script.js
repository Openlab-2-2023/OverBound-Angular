var canvas, c, t;
function startGame() {
  canvas = window.canvas;


  c = canvas.getContext("2d");
  t = canvas.getContext("2d");

  canvas.width = screen.width;
  canvas.height = screen.height;

  console.log(screen.width)
  console.log(screen.height)


  console.log('levels:', window.levels);
  console.log('level:', window.level);
  window.levels[window.level].init();

  


  function animate() {
    window.requestAnimationFrame(animate);

    
    background.draw();
    collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    portals.forEach((portal) => portal.draw());
    animals.forEach((animal) => animal.draw());
    risks.forEach((risk) => risk.draw());
    clouds.forEach((cloud) => cloud.draw());
    //player.updateCamerabox()
    //player.shouldPanCamToLeft()
    player.velocity.x = 0;
    player.playerMovement();
    kolagen.draw();
    kolagen.refill();
    player.draw();
    player.update();
    player.detectCloud();
    player.detectRisk();
    player.textAppear();



    c.save();
    c.globalAlpha = overlay.opacity;
    c.fillStyle = "black";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
  }

  animate();
}

window.startGame = startGame;
