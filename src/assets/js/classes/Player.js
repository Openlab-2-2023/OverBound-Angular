class Player extends Sprite  {
  constructor ({
    collisionBlocks = [],
    clouds = [],
    imageSrc,
    frameRate,
    animations,
    loop,
    lastDirection,
    levelSpawnPosition
  }) {
    super({imageSrc, frameRate, animations,loop, lastDirection,levelSpawnPosition})
    //spawnovacia pozicia
    this.position = {
      x:100,
      y:3000
    }

    this.sides = {
      bottom: this.position.y + this.height
    }

    this.velocity = {
      x:0,
      y:0
    }

    this.gravity = 2

    this.collisionBlocks = collisionBlocks

  }

  updateCamera() {
  if (player.position.x >= 2200 && player.position.x <= 6370) {
    camera.position.x = player.position.x - canvas.width - 240;
  }
   else if(player.position.x >= 6370) {
    camera.position.x = 4200
  }
   else {
    camera.position.x = 0;
  }
  // console.log(this.position.x)

  
  const followStartY = 3650;

  if (player.position.y < followStartY && player.position.y > 980) {
    
    camera.position.y = player.position.y - canvas.height;
  } 
   else if(player.position.y < 980 ) {
    camera.position.y = -50
   }
   else {
    
    camera.position.y = followStartY - canvas.height;
  }
}


  // updateCamerabox(){
  //   this.camerabox = {
  //     position: {
  //       x: this.position.x -1800,
  //       y: this.position.y - 1000
  //     },

  //     width:4300,
  //     height:2000
  //   }

    

  // }
  

  // shouldPanCamToLeft() {
  //   const cameraBoxRightSide = this.camerabox.position.x + this.camerabox.width

  //   if(cameraBoxRightSide >= 4700 && cameraBoxRightSide <= 9240  ) {
  //     c.translate(-this.velocity.x,0)
  //   }

  //   console.log('camerapos:', this.camerabox.position.x + 1800)
  //   console.log('playerpos:', this.position.x)


  // }


  // checkForHorizontalCanvas() {
  //   if(this.cameraBoxRightSide.position.x >= 9240) {
  //     this.velocity.x = 0
  //   }
  // }

  //   shouldPanCamUp() {
  //   const cameraBoxUpSide = this.camerabox.position.y + this.camerabox.height
  //   console.log(cameraBoxUpSide)
  //   if(cameraBoxUpSide <= 4600 ) {

  //     c.translate(0,-this.velocity.y)
  //   }

  // }

  update() {
  //   c.fillStyle = "rgba(0,255,0,0.0)"
  //   c.fillRect(
  // this.camerabox.position.x,
  // this.camerabox.position.y,
  // this.camerabox.width,
  // this.camerabox.height
  //   )

  // console.log('camerax:', this.camerabox.position.x)
  // console.log('cameray:', this.camerabox.position.y);


  
    this.position.x += this.velocity.x
    this.updateHitBox()
    this.checkForHorizontalCollisions()
    this.applyGravity()
    this.updateHitBox()
    this.checkForVerticalCollisions()
    
    
  }

  switchSprite(name) {
    if(this.image === this.animations[name].image) return
    this.currentFrame = 0
    this.image = this.animations[name].image
    this.frameRate = this.animations[name].frameRate
    this.frameBuffer = this.animations[name].frameBuffer
    this.loop = this.animations[name].loop
    this.currentAnimation = this.animations[name]
  }

   updateHitBox() {
    this.hitbox = {
      position: {
        x: this.position.x + 130,
        y: this.position.y + 10
      },
      width: 70,
      height: 300,

      
      
    }
    c.fillStyle = "rgba(0,0,255,0.0)"
    c.fillRect(this.hitbox.position.x, this.hitbox.position.y, this.hitbox.width, this.hitbox.height)
  }

  checkForHorizontalCollisions() {
    //horizontalne kolizie
    for(let i = 0; i < this.collisionBlocks.length; i++) {
      const collisionBlock = this.collisionBlocks[i]

      if(this.hitbox.position.x <= collisionBlock.position.x + collisionBlock.width &&
        this.hitbox.position.x + this.hitbox.width >= collisionBlock.position.x &&
        this.hitbox.position.y + this.hitbox.height >= collisionBlock.position.y &&
        this.hitbox.position.y <= collisionBlock.position.y + collisionBlock.height
      ) {
        if(this.velocity.x < 0) {
          this.velocity.x = 0
          const offset = this.hitbox.position.x - this.position.x
          this.position.x = collisionBlock.position.x + collisionBlock.width - offset + 0.01
          break
        }

        if(this.velocity.x > 0) {
          this.velocity.x = 0
          const offset = this.hitbox.position.x - this.position.x + this.hitbox.width
          this.position.x = collisionBlock.position.x - offset - 0.01
          break
        }
      }
    }
  }

  applyGravity() {
    this.velocity.y += this.gravity
    this.position.y += this.velocity.y
  }



  checkForVerticalCollisions() {
    //vertikalne kolizie
    for(let i = 0; i < this.collisionBlocks.length; i++) {
      const collisionBlock = this.collisionBlocks[i]

      if(this.hitbox.position.x <= collisionBlock.position.x + collisionBlock.width &&
        this.hitbox.position.x + this.hitbox.width >= collisionBlock.position.x &&
        this.hitbox.position.y + this.hitbox.height >= collisionBlock.position.y &&
        this.hitbox.position.y <= collisionBlock.position.y + collisionBlock.height
      ) {
        if(this.velocity.y < 0) {
          this.velocity.y = 0
          const offset = this.hitbox.position.y - this.position.y
          this.position.y = collisionBlock.position.y + collisionBlock.height - offset + 0.01
          break
        }

        if(this.velocity.y > 0) {
          this.velocity.y = 0
          const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
          this.position.y = collisionBlock.position.y - offset - 0.01
          break
        }
      }
    }
  }

playerMovement() {
  if (!keys.s.pressed) {
    if(currentDifficulty === 'normal') {
      if (keys.d.pressed) {
      this.movePlayer(15, 'runRight', 'right');
      if(keys.o.pressed) {
        this.dash()
          if(!player.velocity.x == 0) {
          player.switchSprite(player.lastDirection === 'right' ? 'dash' : 'dashLeft')
        }
      }
    } else if (keys.a.pressed) {
      this.movePlayer(-15, 'runLeft', 'left');
      if(keys.o.pressed) {
        this.dash()
        if(!player.velocity.x == 0) {
        player.switchSprite(player.lastDirection === 'right' ? 'dash' : 'dashLeft')
        }
      }
    } else if(keys.o.pressed) {
      this.dash()
      
    } 
    } else {
      if (keys.d.pressed) {
      this.movePlayer(4.5, 'runRight', 'right');
    } else if (keys.a.pressed) {
      this.movePlayer(-4.5, 'runLeft', 'left');
    } else if (keys.p.pressed && !keys.d.pressed && !keys.a.pressed) {
      this.chargePlayer();
    } 
    }
  } else if(keys.s.pressed) {
    this.crouchPlayer();
    if(keys.o.pressed) {
      player.dash()
      player.switchSprite(player.lastDirection === 'right' ? 'idleRight' : 'idleLeft')
    }
  } 

  
}

movePlayer(velocity, sprite, direction) {
  player.velocity.x = velocity;
  player.switchSprite(sprite);
  player.lastDirection = direction;
}
/*
chargePlayer() {
  if (kolagen.kolagenbar > -70) {
    kolagen.kolagenbar--;
    player.switchSprite(player.lastDirection === 'right' ? 'charge' : 'chargeLeft');
  } else {
    player.switchSprite(player.lastDirection === 'right' ? 'idleRight' : 'idleLeft');
  }
}
*/
crouchPlayer() {
  player.switchSprite(player.lastDirection === 'right' ? 'crouch' : 'crouchLeft');
}


dash() {
  player.velocity.x = player.lastDirection === 'right' ? 50 : -50
  
  setTimeout(() => {
    player.velocity.x = 0;
    keys.o.pressed = false;
  }, 100);
}

detectRisk() {
    for(let i = 0; i < risks.length; i++) {
      const risk = risks[i]
      if(player.hitbox.position.x <= risk.position.x + risk.width &&
        player.hitbox.position.x + player.hitbox.width >= risk.position.x &&
        player.hitbox.position.y + player.hitbox.height >= risk.position.y &&
        player.hitbox.position.y <= risk.position.y + risk.height) {
          player.position.x = player.levelSpawnPosition.x
          player.position.y = player.levelSpawnPosition.y
          kolagen.kolagenbar = -70          
        }
  }
}

detectCloud() {
    //vertikalne kolizie
    for(let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i]

      if(this.hitbox.position.x <= cloud.position.x + cloud.width &&
        this.hitbox.position.x + this.hitbox.width >= cloud.position.x &&
        this.hitbox.position.y + this.hitbox.height >= cloud.position.y &&
        this.hitbox.position.y <= cloud.position.y 
      ) {
        

        if(this.velocity.y > 0) {
          player.velocity.y = -20

          break
        }
      }
    }
  }

  textAppear() {
    for(let i = 0; i < portals.length; i++) {
      const portal = portals[i]
      if(player.hitbox.position.x <= portal.position.x + portal.width &&
        player.hitbox.position.x + player.hitbox.width >= portal.position.x &&
        player.hitbox.position.y + player.hitbox.height >= portal.position.y &&
        player.hitbox.position.y <= portal.position.y + portal.height) {
          if(level == 1) {
          c.fillStyle = 'black'
          c.fillRect(portal.position.x - 30,portal.position.y - 60,120,40)
          c.fillStyle = 'white';
          document.fonts.ready.then(() => {
            c.font = "18px Arial";
          });
          c.fillText("Press E",portal.position.x ,portal.position.y - 31);
          }
          
        } 
    }
  }
}



