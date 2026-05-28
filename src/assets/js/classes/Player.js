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
    this.maxHealth = 4
    this.health = this.maxHealth
    this.isDead = false

    this.collisionBlocks = collisionBlocks

    this.isTransitioningLevel = false
    this.nearNpc = false

    // simple melee attack state
    this.isAttacking = false
    this.attackFramesRemaining = 0
    this.attackAnimationFrames = 0
    this.attackCooldownFrames = 0

  }
  update() {  
    if (this.isDead) {
      this.velocity.x = 0
      this.velocity.y = 0
      return
    }

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
    if (this.attackFramesRemaining > 0) {
      this.attackFramesRemaining--
      if (this.attackFramesRemaining === 0) {
        this.isAttacking = false
      }
    }
    if (this.attackAnimationFrames > 0) {
      this.attackAnimationFrames--
      if (this.attackAnimationFrames === 0) {
        this.switchSprite(this.lastDirection === 'right' ? 'idleRight' : 'idleLeft')
      }
    }
    if (this.attackCooldownFrames > 0) {
      this.attackCooldownFrames--
    }
    
  }

  switchSprite(name) {
    const animation = this.animations[name]
    if (!animation) return
    if (name === 'perish') {
      this.isAttacking = false
      this.attackFramesRemaining = 0
      this.attackAnimationFrames = 0
    }
    if (this.attackAnimationFrames > 0 && !name.startsWith('attack') && name !== 'perish') return
    if(this.currentAnimation === animation) return
    this.currentFrame = 0
    this.elapsedFrames = 0
    this.image = animation.image
    this.frameRate = animation.frameRate
    this.frameBuffer = animation.frameBuffer
    this.loop = animation.loop
    this.flipX = animation.flipX || false
    this.drawScale = animation.drawScale || 1
    this.drawOffsetX = animation.drawOffsetX || 0
    this.drawOffsetY = animation.drawOffsetY || 0
    this.currentAnimation = animation
  }

  resetHealth() {
    this.health = this.maxHealth
    this.isDead = false
    this.invulnerableFrames = 0
    this.knockbackFrames = 0
    this.velocity.x = 0
    this.velocity.y = 0
  }

  takeDamage(amount = 1) {
    if (this.isDead || this.invulnerableFrames > 0) return false

    this.health = Math.max(0, this.health - amount)

    if (this.health === 0) {
      this.die()
      return 'dead'
    }

    this.invulnerableFrames = 60
    return true
  }

  die() {
    if (this.isDead) return

    this.isDead = true
    this.isAttacking = false
    this.attackFramesRemaining = 0
    this.attackAnimationFrames = 0
    this.attackCooldownFrames = 0
    this.knockbackFrames = 0
    this.invulnerableFrames = 0
    this.velocity.x = 0
    this.velocity.y = 0

    const respawn = () => {
      level = 1
      window.level = level
      this.resetHealth()

      if (levels[level] && typeof levels[level].init === 'function') {
        levels[level].init()
      }

      if (typeof resetMovementGuide === 'function') {
        resetMovementGuide()
      }

      this.switchSprite('idleRight')
    }

    if (typeof playDeathRespawnTransition === 'function') {
      playDeathRespawnTransition(respawn)
    } else {
      respawn()

      if (typeof overlay !== 'undefined') {
        overlay.opacity = 0
      }
    }
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
    
    if (window.DEBUG_HITBOXES) {
      c.fillStyle = "rgba(0,0,255,0.35)"
      c.fillRect(this.hitbox.position.x, this.hitbox.position.y, this.hitbox.width, this.hitbox.height)
    }
  }

  checkForHorizontalCollisions() {
    //horizontalne kolizie
    const collisionBlocks = typeof this.collisionBlocks.getNearby === 'function'
      ? this.collisionBlocks.getNearby(this.hitbox)
      : this.collisionBlocks

    for(let i = 0; i < collisionBlocks.length; i++) {
      const collisionBlock = collisionBlocks[i]

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
    const collisionBlocks = typeof this.collisionBlocks.getNearby === 'function'
      ? this.collisionBlocks.getNearby(this.hitbox)
      : this.collisionBlocks

    for(let i = 0; i < collisionBlocks.length; i++) {
      const collisionBlock = collisionBlocks[i]

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
  if (this.isDead) return

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
        }
  }
}

  // Triggered from inputs when the player presses I
  performAttack() {
    // don't start a new attack if we're still attacking or on cooldown
    if (this.attackAnimationFrames > 0 || this.attackCooldownFrames > 0) return

    const animationName = this.lastDirection === 'left' ? 'attackLeft' : 'attackRight'
    const animation = this.animations[animationName]
    const animationFrames = animation
      ? animation.frameRate * animation.frameBuffer
      : 10

    this.isAttacking = true
    this.attackFramesRemaining = Math.min(10, animationFrames)   // how many frames the hitbox is active
    this.attackAnimationFrames = animationFrames
    this.attackCooldownFrames = animationFrames + 4              // short delay before next attack
    this.switchSprite(animationName)

    // basic melee hitbox in front of the player
    const attackWidth = 140
    const attackHeight = this.hitbox.height
    const facingLeft = this.lastDirection === 'left'

    const attackBox = {
      position: {
        x: facingLeft
          ? this.hitbox.position.x - attackWidth
          : this.hitbox.position.x + this.hitbox.width,
        y: this.hitbox.position.y
      },
      width: attackWidth,
      height: attackHeight
    }

    if (window.DEBUG_HITBOXES) {
      c.fillStyle = "rgba(255,0,0,0.35)"
      c.fillRect(
        attackBox.position.x,
        attackBox.position.y,
        attackBox.width,
        attackBox.height
      )
    }

    if (typeof enemies === 'undefined') return

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy || enemy.isDead || enemy.isDying || !enemy.hitbox) continue

      const eBox = enemy.hitbox

      const overlaps =
        attackBox.position.x <= eBox.position.x + eBox.width &&
        attackBox.position.x + attackBox.width >= eBox.position.x &&
        attackBox.position.y + attackBox.height >= eBox.position.y &&
        attackBox.position.y <= eBox.position.y + eBox.height

      if (!overlaps) continue

      // knock enemy away from the player
      const playerCenterX = this.hitbox.position.x + this.hitbox.width / 2
      const enemyCenterX = eBox.position.x + eBox.width / 2
      const knockDir = enemyCenterX >= playerCenterX ? 1 : -1

      enemy.knockbackFrames = 15
      enemy.velocity.x = 25 * knockDir
      enemy.velocity.y = -20

      // track damage: enemy dies after enough hits
      if (typeof enemy.takeHit === 'function') {
        enemy.takeHit()
      }
    }
  }

detectEnemy() {
    // temporary immunity: ignore new hits while invulnerable
    // also ignore enemy hits while near an NPC so talking isn't interrupted
    if (player.isDead || player.invulnerableFrames > 0 || player.nearNpc) return

    for(let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy || enemy.isDead || enemy.isDying) continue

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
          const tookDamage = player.takeDamage(1)
          if (!tookDamage) return

          if (tookDamage === 'dead') {
            return
          }

          // simple knockback + small jump plus short delay before next hit
          const playerCenterX = player.hitbox.position.x + player.hitbox.width / 2
          const enemyCenterX = damageBox.position.x + damageBox.width / 2
          const knockDir = playerCenterX < enemyCenterX ? -1 : 1
          const playerCenterY = player.hitbox.position.y + player.hitbox.height / 2
          const enemyCenterY = damageBox.position.y + damageBox.height / 2

          // knockback duration and invulnerability window
          player.knockbackFrames = 15
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

drawNpcPrompt(npc) {
    const promptWidth = 360
    const promptHeight = 118
    const keySize = 78
    const x = npc.position.x + npc.width / 2 - promptWidth / 2
    const y = npc.position.y - 155

    c.save()
    c.fillStyle = 'rgba(0, 0, 0, 0.72)'
    c.strokeStyle = 'rgba(255, 255, 255, 0.88)'
    c.lineWidth = 6
    c.beginPath()
    c.roundRect(x, y, promptWidth, promptHeight, 8)
    c.fill()
    c.stroke()

    c.fillStyle = 'white'
    c.font = '700 58px "Pixelify Sans", Arial'
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText('TALK', x + 34, y + promptHeight / 2 + 2)

    const keyX = x + promptWidth - keySize - 28
    const keyY = y + (promptHeight - keySize) / 2
    c.fillStyle = 'rgba(255, 255, 255, 0.12)'
    c.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    c.lineWidth = 5
    c.beginPath()
    c.roundRect(keyX, keyY, keySize, keySize, 6)
    c.fill()
    c.stroke()

    c.fillStyle = 'white'
    c.font = '700 54px "Pixelify Sans", Arial'
    c.textAlign = 'center'
    c.fillText('E', keyX + keySize / 2, keyY + keySize / 2 + 2)
    c.restore()
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

        this.drawNpcPrompt(npc);

        // If E was pressed while near NPC, open the Angular chat overlay.
        if (
          typeof keys !== 'undefined' &&
          keys.e &&
          keys.e.pressed &&
          !keys.e.usedForNpc
        ) {
          keys.e.usedForNpc = true;
          npcDialog.active = false;
          npcDialog.text = npc.dialogText || '...';

          const npcChatDetail = {
            id: npc.id || 'npc',
            name: npc.name || 'Guide',
            role: npc.role || 'game_guide',
            intro: npc.dialogText || 'Ask me anything about OverBound.',
          };

          if (typeof window.openNpcChat === 'function') {
            window.openNpcChat(npcChatDetail);
          } else {
            window.dispatchEvent(new CustomEvent('openNpcChat', {
              detail: npcChatDetail
            }));
          }
        }
      }
    }

    if (!npcNearby) {
      npcDialog.active = false;
    }

    // remember for this frame so enemy detection can skip knockback while talking
    player.nearNpc = npcNearby;
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

          const changeLevel = () => {
            const targetLevel = portal.targetLevel || level + 1
            const targetSpawnPosition = portal.targetSpawnPosition

            if (levels[targetLevel] && typeof levels[targetLevel].init === 'function') {
              level = targetLevel
              window.level = level
              levels[level].init()

              if (targetSpawnPosition) {
                player.position.x = targetSpawnPosition.x
                player.position.y = targetSpawnPosition.y
              }
            }
          }

          const finishTransition = () => {
            this.isTransitioningLevel = false
          }

          if (typeof fadeGameOverlayTo === 'function') {
            fadeGameOverlayTo(1, 0.5, () => {
              changeLevel()
              fadeGameOverlayTo(0, 0.5, finishTransition)
            })
          } else {
            overlay.opacity = 1
            setTimeout(() => {
              changeLevel()
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
