// Global dialog state for NPC interactions
var npcDialog = {
  active: false,
  text: ''
};

// Responsible only for drawing the top-screen NPC dialog bar
function drawNpcDialogBar() {
  if (typeof npcDialog === 'undefined' || !npcDialog.active) return;
  if (typeof c === 'undefined' || typeof canvas === 'undefined') return;

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);

  const barHeight = 150;
  c.fillStyle = 'rgba(0, 0, 0, 0.75)';
  c.fillRect(0, 0, canvas.width, barHeight);

  c.fillStyle = 'white';
  c.font = '32px Arial';
  const text = npcDialog.text || '';
  c.fillText(text, 40, barHeight / 2 + 10);

  c.restore();
}

class Player extends Sprite  {
  constructor ({
    collisionBlocks = [],
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

    // frames where knockback is active
    this.knockbackFrames = 0
    // frames where player is invulnerable to enemy hits
    this.invulnerableFrames = 0
    // frames remaining where player is being knocked back
    this.knockbackFrames = 0

    this.gravity = 2

    this.collisionBlocks = collisionBlocks

    this.isTransitioningLevel = false

  }
  update() {  
    this.position.x += this.velocity.x
    this.updateHitBox()
    this.checkForHorizontalCollisions()
    this.applyGravity()
    this.updateHitBox()
    this.checkForVerticalCollisions()
    
    if (this.knockbackFrames > 0) {
      this.knockbackFrames--
    }
    if (this.invulnerableFrames > 0) {
      this.invulnerableFrames--
    }
    
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
      c
      
      
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

detectEnemy() {
    // temporary immunity: ignore new hits while invulnerable
    if (player.invulnerableFrames > 0) return

    for(let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      // prefer enemy's damage hitbox if available
      const damageBox = enemy.damageHitbox || {
        position: enemy.position,
        width: enemy.width,
        height: enemy.height
      }

      if(player.hitbox.position.x <= damageBox.position.x + damageBox.width &&
        player.hitbox.position.x + player.hitbox.width >= damageBox.position.x &&
        player.hitbox.position.y + player.hitbox.height >= damageBox.position.y &&
        player.hitbox.position.y <= damageBox.position.y + damageBox.height) {
          // simple knockback + small jump plus short delay before next hit
          const playerCenterX = player.hitbox.position.x + player.hitbox.width / 2
          const enemyCenterX = damageBox.position.x + damageBox.width / 2
          const knockDir = playerCenterX < enemyCenterX ? -1 : 1
          const playerCenterY = player.hitbox.position.y + player.hitbox.height / 2
          const enemyCenterY = damageBox.position.y + damageBox.height / 2

          // knockback duration and invulnerability window
          player.knockbackFrames = 15
          player.invulnerableFrames = 60
          player.velocity.x = 30 * knockDir

          // Only launch upward if we're not already clearly above the enemy
          if (playerCenterY >= enemyCenterY) {
            player.velocity.y = -25
          } else {
            // On top of the enemy: don't add more upward velocity
            if (player.velocity.y < 0) {
              // keep existing upward motion but don't increase it
              player.velocity.y = player.velocity.y
            } else {
              // neutral or downward if needed
              player.velocity.y = 0
            }
          }

          console.log('hit by enemy')
        }
  }
  }

detectNpc() {
    let npcNearby = false;

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];

      if (
        player.hitbox.position.x <= npc.position.x + npc.width &&
        player.hitbox.position.x + player.hitbox.width >= npc.position.x &&
        player.hitbox.position.y + player.hitbox.height >= npc.position.y &&
        player.hitbox.position.y <= npc.position.y + npc.height
      ) {
        npcNearby = true;

        c.fillStyle = 'white';
        document.fonts.ready.then(() => {
          c.font = '100px Times New Roman';
        });
        c.fillText('Talk[E]', npc.position.x + 20, npc.position.y - 100);

        // If E was pressed while near NPC, show dialog bar
        if (typeof keys !== 'undefined' && keys.e && keys.e.pressed) {
          npcDialog.active = true;
          npcDialog.text = npc.dialogText || '...';
        }
      }
    }

    if (!npcNearby) {
      npcDialog.active = false;
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
          

          if (this.isTransitioningLevel) return

          this.isTransitioningLevel = true
          player.velocity.x = 0

          const goToNextLevel = () => {
            level++
            if (levels[level] && typeof levels[level].init === 'function') {
              levels[level].init()
            }
          }

          const finishTransition = () => {
            this.isTransitioningLevel = false
          }

          if (typeof gsap !== 'undefined') {
            gsap.to(overlay, {
              opacity: 1,
              duration: 0.5,
              onComplete: () => {
                goToNextLevel()
                gsap.to(overlay, {
                  opacity: 0,
                  duration: 0.5,
                  onComplete: finishTransition
                })
              }
            })
          } else {
            overlay.opacity = 1
            setTimeout(() => {
              goToNextLevel()
              setTimeout(() => {
                overlay.opacity = 0
                finishTransition()
              }, 300)
            }, 300)
          }

        } 
    }
  }
}
