
var canvas, c, t;
var camera = {
    position: {
      x:0,
      y:0
    }
  }

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

  
  
  // c.scale(0.4,0.4)
  // c.translate(Math.abs(camera.position.x),-2400)
  


  function animate() {
    window.requestAnimationFrame(animate);

    c.setTransform(1, 0, 0, 1, 0, 0); // reset transform

    player.updateCamera();

    c.scale(0.4,0.4)
      c.translate(-camera.position.x, -camera.position.y)


    
    console.log(player.position.y)

    
    background.draw();
    collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
    portals.forEach((portal) => portal.draw());
    animals.forEach((animal) => animal.draw());
    risks.forEach((risk) => risk.draw());
    clouds.forEach((cloud) => cloud.draw());
    // player.updateCamerabox()
    // player.shouldPanCamToLeft()
    // player.shouldPanCamUp()
    player.velocity.x = 0;
    player.playerMovement();
    kolagen.draw();
    kolagen.refill();
    player.draw();
    player.update();
    player.detectCloud();
    player.detectRisk();
    player.textAppear();

// console.log(player.velocity.x)

    c.save();
    c.globalAlpha = overlay.opacity;
    c.fillStyle = "black";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
  }

  animate();
}

window.startGame = startGame;
