


var canvas, c, t;
function startGame() {
  canvas = window.canvas;


  c = canvas.getContext("2d");
  t = canvas.getContext("2d");

  canvas.width = 1024;
  canvas.height = 596;
  console.log('levels:', window.levels);
console.log('level:', window.level);
  window.levels[window.level].init();


  function animate() {
    // Fixed-step update (physics) at 60 FPS, render as often as possible
    let last = 0;
    let accumulator = 0;
    const step = 1000 / 60; // ms per physics update

    function animateFrame(timestamp) {
      window.requestAnimationFrame(animateFrame);

      if (!last) last = timestamp;
      const delta = timestamp - last;
      last = timestamp;

      accumulator += delta;

      while (accumulator >= step) {
        // physics / game-state updates (fixed timestep)
        player.velocity.x = 0;
        player.playerMovement();
        player.update();
        player.detectCloud();
        player.detectRisk();
        kolagen.refill();

        accumulator -= step;
      }

      // rendering (can run at display frame rate)
      background.draw();
      collisionBlocks.forEach((CollisionBlock) => CollisionBlock.draw());
      portals.forEach((portal) => portal.draw());
      animals.forEach((animal) => animal.draw());
      risks.forEach((risk) => risk.draw());
      clouds.forEach((cloud) => cloud.draw());

      kolagen.draw();
      player.draw();
      player.textAppear();

      c.save();
      c.globalAlpha = overlay.opacity;
      c.fillStyle = "black";
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.restore();
    }

    window.requestAnimationFrame(animateFrame);
  }

  animate();
}

window.startGame = startGame;
