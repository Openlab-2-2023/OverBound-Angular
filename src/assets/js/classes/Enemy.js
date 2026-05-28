class Enemy extends Sprite {
    constructor({
        position = {
            x:0,
            y:0
        },
        imageSrc = this.animations[name].image,
        frameRate = 1,
        animations,
        frameBuffer = 10,
        loop = true,
        collisionBlocks = [],
        patrolCenterX = null,
        patrolRange = 200,
        patrolDirection = 1,
        patrolSpeed = 5,
        // how many successful hits from the player this enemy can take
        health = 3,
        drawScale = 1,
        drawOffsetX = 0,
        drawOffsetY = 0,
        hitboxOffsetX = 130,
        hitboxOffsetY = 10,
        hitboxWidth = 70,
        hitboxHeight = 300,
        damageHitboxOffsetX = hitboxOffsetX,
        damageHitboxOffsetY = hitboxOffsetY,
        damageHitboxWidth = hitboxWidth,
        damageHitboxHeight = hitboxHeight,
        hitboxOffsetXLeft = hitboxOffsetX,
        hitboxOffsetXRight = hitboxOffsetX,
        damageHitboxOffsetXLeft = damageHitboxOffsetX,
        damageHitboxOffsetXRight = damageHitboxOffsetX,
        bodySourceOffsetX = 0,
        bodySourceOffsetY = 0,
        bodyWidth = 240,
        bodyHeight = 272,
        hitboxBodyOffsetX = 85,
        hitboxBodyOffsetY = 200,
        damageHitboxBodyOffsetX = hitboxBodyOffsetX,
        damageHitboxBodyOffsetY = hitboxBodyOffsetY,
        debug = false

    }) {
        super({
            position,
            imageSrc,
            frameRate,
            animations,
            frameBuffer,
            loop,
            drawScale,
            drawOffsetX,
            drawOffsetY,
            collisionBlocks
        })
    this.position = position

    this.sides = {
      bottom: this.position.y + this.height
    }

    this.velocity = {
      x:0,
      y:0
    }

    


    this.patrolCenterX = patrolCenterX !== null ? patrolCenterX : this.position.x
    this.patrolRange = patrolRange // how far left/right from center
    this.patrolDirection = patrolDirection // 1 = right, -1 = left
    this.patrolSpeed = patrolSpeed
    this.isAggro = false

    this.gravity = 2

    this.collisionBlocks = collisionBlocks

    this.isTransitioningLevel = false
    // frames remaining where this enemy is being knocked back by the player
    this.knockbackFrames = 0
    this.hitAnimationFrames = 0
    this.deathAnimationFrames = 0
    this.isDying = false

    // simple health: enemy dies after `health` successful hits
    this.maxHits = health
    this.hitsTaken = 0
    this.isDead = false

    this.baseDrawScale = drawScale
    this.baseDrawOffsetX = drawOffsetX
    this.baseDrawOffsetY = drawOffsetY
    this.hitboxOffsetX = hitboxOffsetX
    this.hitboxOffsetY = hitboxOffsetY
    this.hitboxWidth = hitboxWidth
    this.hitboxHeight = hitboxHeight
    this.damageHitboxOffsetX = damageHitboxOffsetX
    this.damageHitboxOffsetY = damageHitboxOffsetY
    this.damageHitboxWidth = damageHitboxWidth
    this.damageHitboxHeight = damageHitboxHeight
    this.hitboxOffsetXLeft = hitboxOffsetXLeft
    this.hitboxOffsetXRight = hitboxOffsetXRight
    this.damageHitboxOffsetXLeft = damageHitboxOffsetXLeft
    this.damageHitboxOffsetXRight = damageHitboxOffsetXRight
    this.bodySourceOffsetX = bodySourceOffsetX
    this.bodySourceOffsetY = bodySourceOffsetY
    this.bodyWidth = bodyWidth
    this.bodyHeight = bodyHeight
    this.hitboxBodyOffsetX = hitboxBodyOffsetX
    this.hitboxBodyOffsetY = hitboxBodyOffsetY
    this.damageHitboxBodyOffsetX = damageHitboxBodyOffsetX
    this.damageHitboxBodyOffsetY = damageHitboxBodyOffsetY
    this.debug = debug
    this.turnReason = 'spawn'
    }
    update() {  

    this.move()

    this.position.x += this.velocity.x
    this.updatePatrolBox();
    this.updateAggro()
    this.updateHitBox()
    this.checkForHorizontalCollisions()
    this.applyGravity()
    this.updateHitBox()
    this.checkForVerticalCollisions()
    this.updateDamageHitBox()
  }

  updateAggro() {
    // make sure everything we need exists
    if (typeof player === 'undefined' || !player.hitbox || !this.patrolBox || player.invulnerableFrames > 0) {
      this.isAggro = false
      return
    }

    const playerBox = player.hitbox
    const patrolBox = this.patrolBox

    const overlaps =
      playerBox.position.x <= patrolBox.position.x + patrolBox.width &&
      playerBox.position.x + playerBox.width >= patrolBox.position.x &&
      playerBox.position.y + playerBox.height >= patrolBox.position.y &&
      playerBox.position.y <= patrolBox.position.y + patrolBox.height

    this.isAggro = overlaps
  }


  getHitboxOffsetX() {
    return this.patrolDirection === 1
      ? this.hitboxOffsetXRight
      : this.hitboxOffsetXLeft
  }

  getDamageHitboxOffsetX() {
    return this.patrolDirection === 1
      ? this.damageHitboxOffsetXRight
      : this.damageHitboxOffsetXLeft
  }

  getHitboxCenterX() {
    const bodyBox = this.getBodyBox()
    return bodyBox.position.x + this.hitboxBodyOffsetX + this.hitboxWidth / 2
  }

  getDamageHitboxBox() {
    const bodyBox = this.getBodyBox()

    return {
      position: {
        x: bodyBox.position.x + this.damageHitboxBodyOffsetX,
        y: bodyBox.position.y + this.damageHitboxBodyOffsetY
      },
      width: this.damageHitboxWidth,
      height: this.damageHitboxHeight,
    }
  }

  getBodyBox() {
    const frameWidth = this.width || 640
    const sourceBodyX = this.bodySourceOffsetX * this.drawScale
    const sourceBodyY = this.bodySourceOffsetY * this.drawScale
    const bodyWidth = this.bodyWidth * this.drawScale
    const bodyHeight = this.bodyHeight * this.drawScale
    const drawX = this.position.x + this.drawOffsetX
    const drawY = this.position.y + this.drawOffsetY
    const bodyX = this.flipX
      ? drawX + frameWidth * this.drawScale - sourceBodyX - bodyWidth
      : drawX + sourceBodyX

    return {
      position: {
        x: bodyX,
        y: drawY + sourceBodyY
      },
      width: bodyWidth,
      height: bodyHeight,
    }
  }

  boxesOverlap(boxA, boxB) {
    return boxA.position.x <= boxB.position.x + boxB.width &&
      boxA.position.x + boxA.width >= boxB.position.x &&
      boxA.position.y + boxA.height >= boxB.position.y &&
      boxA.position.y <= boxB.position.y + boxB.height
  }

  move() {
    if (this.deathAnimationFrames > 0) {
      this.deathAnimationFrames--
      this.velocity.x = 0
      if (this.deathAnimationFrames === 0) {
        this.kill()
      }
      return
    }

    if (this.hitAnimationFrames > 0) {
      this.hitAnimationFrames--
      if (this.knockbackFrames && this.knockbackFrames > 0) {
        this.knockbackFrames--
      } else {
        this.velocity.x = 0
      }
      if (this.hitAnimationFrames === 0 && this.isDying) {
        if (!this.playDeathAnimation()) {
          this.kill()
        }
      }
      return
    }

    // while in knockback, skip AI so we just slide
    if (this.knockbackFrames && this.knockbackFrames > 0) {
      this.knockbackFrames--
      return
    }

    // If player is inside patrol box, chase him instead of patrolling
    if (this.isAggro && typeof player !== 'undefined') {
      const playerBox = player.hitbox || {
        position: player.position,
        width: player.width || 0,
        height: player.height || 0
      }
      const targetX = playerBox.position.x + playerBox.width / 2
      const enemyCenterX = this.getHitboxCenterX()

      if (targetX > enemyCenterX) {
        this.patrolDirection = 1
        this.turnReason = 'chase-right'
        this.switchSprite('runRight')
      } else {
        this.patrolDirection = -1
        this.turnReason = 'chase-left'
        this.switchSprite('runLeft')
      }

      if (!this.boxesOverlap(playerBox, this.getDamageHitboxBox())) {
        // slightly faster when chasing
        this.velocity.x = this.patrolSpeed * 1.5 * this.patrolDirection
      } else {
        this.velocity.x = 0
      }

      return
    }

    const patrolX = this.getHitboxCenterX()

    if (patrolX > this.patrolCenterX + this.patrolRange) {
      this.patrolDirection = -1
      this.turnReason = 'patrol-right-edge'
    } else if (patrolX < this.patrolCenterX - this.patrolRange) {
      this.patrolDirection = 1
      this.turnReason = 'patrol-left-edge'
    }

    this.switchSprite(this.patrolDirection === 1 ? 'runRight' : 'runLeft')
    this.velocity.x = this.patrolSpeed * this.patrolDirection
  }

  switchSprite(name) {
    const animation = this.animations[name]
    if (!animation) return
    if(this.currentAnimation === animation) return
    if (this.image !== animation.image) {
      this.currentFrame = 0
    }
    this.image = animation.image
    this.frameRate = animation.frameRate
    this.frameBuffer = animation.frameBuffer
    this.loop = animation.loop
    this.flipX = animation.flipX || false
    this.drawScale = this.baseDrawScale * (animation.drawScale || 1)
    this.drawOffsetX = this.baseDrawOffsetX + (animation.drawOffsetX || 0)
    this.drawOffsetY = this.baseDrawOffsetY + (animation.drawOffsetY || 0)
    this.currentAnimation = animation
  }

  updatePatrolBox() {
    this.patrolBox = {
      position: {
        x: this.position.x - 1100,
        y: this.position.y - 300
      },
      width: 2600,
      height: 1000,

      
      
    }
    if (this.debug) {
      c.fillStyle = "rgba(150,0,255,0.08)"
      c.fillRect(this.patrolBox.position.x, this.patrolBox.position.y, this.patrolBox.width, this.patrolBox.height)
    }
  }

  // Separate hitbox for damaging the player
  updateDamageHitBox() {
    this.damageHitbox = this.getDamageHitboxBox()

    if (this.debug) {
      c.fillStyle = "rgba(255,255,0,0.35)"
      c.fillRect(
        this.damageHitbox.position.x,
        this.damageHitbox.position.y,
        this.damageHitbox.width,
        this.damageHitbox.height
      )
    }
  }

  // Called when the player successfully hits this enemy
  takeHit() {
    if (this.isDead || this.isDying) return
    this.hitsTaken++
    const playedHitAnimation = this.playHitAnimation()
    if (this.hitsTaken >= this.maxHits) {
      if (playedHitAnimation) {
        this.isDying = true
        return
      }

      if (!this.playDeathAnimation()) {
        this.kill()
      }
    }
  }

  playHitAnimation() {
    const animationName = this.patrolDirection === 1 ? 'hitRight' : 'hitLeft'
    const animation = this.animations[animationName]

    if (!animation) return false

    this.switchSprite(animationName)
    this.hitAnimationFrames = animation.frameRate * animation.frameBuffer
    return true
  }

  playDeathAnimation() {
    const animationName = this.patrolDirection === 1 ? 'dieRight' : 'dieLeft'
    const animation = this.animations[animationName]

    if (!animation) return false

    this.isDying = true
    this.knockbackFrames = 0
    this.switchSprite(animationName)
    this.deathAnimationFrames = animation.frameRate * animation.frameBuffer
    return true
  }

  kill() {
    if (this.isDead) return

    this.isDead = true

    // notify Angular app (if hooked) that an enemy was killed
    try {
      if (typeof window !== 'undefined' && typeof window.onEnemyKilled === 'function') {
        window.onEnemyKilled()
      }
    } catch (e) {
      // ignore errors from reward handler
    }
  }

   updateHitBox() {
    const bodyBox = this.getBodyBox()

    this.hitbox = {
      position: {
        x: bodyBox.position.x + this.hitboxBodyOffsetX,
        y: bodyBox.position.y + this.hitboxBodyOffsetY
      },
      width: this.hitboxWidth,
      height: this.hitboxHeight,

      
      
    }
    if (this.debug) {
      c.fillStyle = "rgba(0,0,255,0.35)"
      c.fillRect(this.hitbox.position.x, this.hitbox.position.y, this.hitbox.width, this.hitbox.height)
      this.drawDebugInfo()
    }
  }

  drawDebugInfo() {
    const bodyBox = this.getBodyBox()
    const centerX = this.getHitboxCenterX()

    c.strokeStyle = "rgba(0,255,0,0.8)"
    c.lineWidth = 4
    c.strokeRect(bodyBox.position.x, bodyBox.position.y, bodyBox.width, bodyBox.height)

    c.fillStyle = "rgba(255,0,0,0.9)"
    c.fillRect(this.position.x - 6, this.position.y - 6, 12, 12)

    c.fillStyle = "rgba(255,255,255,0.9)"
    c.fillRect(centerX - 3, this.hitbox.position.y, 6, this.hitbox.height)

    c.font = "28px Arial"
    c.fillText(
      `${this.patrolDirection === 1 ? 'right' : 'left'} ${this.turnReason}`,
      this.position.x,
      this.position.y - 20
    )
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
          // jump when colliding on the left
          this.velocity.y = -30
          const offset = this.hitbox.position.x - this.position.x
          this.position.x = collisionBlock.position.x + collisionBlock.width - offset + 0.01
          break
        }

        if(this.velocity.x > 0) {
          this.velocity.x = 0
          // jump when colliding on the right
          this.velocity.y = -30
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
}







































































