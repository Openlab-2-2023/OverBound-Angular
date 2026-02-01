let keys = {
  d: {
    pressed: false,
  },
  a: {
    pressed: false,
  },
  p: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
  o: {
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
      /*
    case "KeyP":
      //charge kolagenbar
      keys.p.pressed = true;
        
      break;
      */
    case "Space":
    case "KeyW":
      
      if(keys.s.pressed && player.velocity.y == 0 && kolagen.kolagenbar <= -28) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -22;
          kolagen.kolagenbar = kolagen.kolagenbar + 28;
        } else {
          player.velocity.y = -20;
          kolagen.kolagenbar = kolagen.kolagenbar + 28;
        }
        
        keys.s.pressed = false
      }
      //maly jump
      if(player.velocity.y == 0 && kolagen.kolagenbar <= -14) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -16;
          kolagen.kolagenbar = kolagen.kolagenbar + 14;
        } else {
          player.velocity.y = -17;
          kolagen.kolagenbar = kolagen.kolagenbar + 14;
        }
        
      }

      break;

      case "KeyE":
    for(let i = 0; i < portals.length; i++) {
      const portal = portals[i]
      if(player.hitbox.position.x <= portal.position.x + portal.width &&
        player.hitbox.position.x + player.hitbox.width >= portal.position.x &&
        player.hitbox.position.y + player.hitbox.height >= portal.position.y &&
        player.hitbox.position.y <= portal.position.y + portal.height) {
          player.switchSprite('perish')
        } 
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
    case "KeyP":
      keys.p.pressed = false;
      if(player.lastDirection === 'right') {
        player.switchSprite('idleRight')
      } else if(player.lastDirection === 'left') {
        player.switchSprite('idleLeft')
      }
      break;
    case "KeyS":
      keys.s.pressed = false;
      if(player.lastDirection === 'right') {
        player.switchSprite('idleRight')
      } else if(player.lastDirection === 'left') {
        player.switchSprite('idleLeft')
      }
    case "KeyW":
      keys.w.pressed = false;
      break;


      
  }
})

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  switch(event.code) {
    case "KeyO":
      if(kolagen.kolagenbar <= -28) {
        keys.o.pressed = true
        kolagen.kolagenbar = kolagen.kolagenbar + 28;
      }
      break;
  }
});