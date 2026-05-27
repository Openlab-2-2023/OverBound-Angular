let keys = {
  d: {
    pressed: false,
  },
  a: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
  e: {
    pressed: false,
  },
  o: {
    pressed: false,
  },
  i: {
    pressed: false,
  },
};

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyD":
      // move right (D)
      keys.d.pressed = true;
      break;
    case "KeyA":
      //move left (A)
      keys.a.pressed = true;
      break;
    case "KeyS":
      //duckujes 
      keys.s.pressed = true;
      break;
    case "Space":
    case "KeyW":
      if(keys.s.pressed && player.velocity.y == 0) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -60;
        } else {
          player.velocity.y = -20;
        }
        
        keys.s.pressed = false
      }
      //maly jump
      if(player.velocity.y == 0) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -50;
        } else {
          player.velocity.y = -17;
        }
        
      }

      break;

      case "KeyE":
      keys.e.pressed = true;
      break;

      case "KeyI":
      // attack key (I) – one-shot per press
      if (event.repeat) break;
      keys.i.pressed = true;
      if (typeof player !== 'undefined' && typeof player.performAttack === 'function') {
        player.performAttack();
      }
      break;

      

  }
});


window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyD":
      keys.d.pressed = false;
      player.switchSprite('idleRight')
      break;
    case "KeyA":
      keys.a.pressed = false;
      player.switchSprite('idleLeft')
      break;
    case "KeyS":
      keys.s.pressed = false;
      if(player.lastDirection === 'right') {
        player.switchSprite('idleRight')
      } else if(player.lastDirection === 'left') {
        player.switchSprite('idleLeft')
      }
      break;
    case "KeyE":
      keys.e.pressed = false;
      break;
    case "KeyW":
      keys.w.pressed = false;
      break;

    case "KeyI":
      keys.i.pressed = false;
      break;


      
  }
})

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  switch(event.code) {
    case "KeyO":
      keys.o.pressed = true
      break;
  }
});
