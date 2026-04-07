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
        health = 3

    }) {
        super({
            position,
            imageSrc,
            frameRate,
            animations,
            frameBuffer,
            loop,
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

    // simple health: enemy dies after `health` successful hits
    this.maxHits = health
    this.hitsTaken = 0
    this.isDead = false
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


  move() {
    // while in knockback, skip AI so we just slide
    if (this.knockbackFrames && this.knockbackFrames > 0) {
      this.knockbackFrames--
      return
    }

    // If player is inside patrol box, chase him instead of patrolling
    if (this.isAggro && typeof player !== 'undefined') {
      const targetX = player.position.x

      if (Math.abs(targetX - this.position.x) > 10) {
        if (targetX > this.position.x) {
          this.patrolDirection = 1
          this.switchSprite('runRight')
        } else {
          this.patrolDirection = -1
          this.switchSprite('runLeft')
        }

        // slightly faster when chasing
        this.velocity.x = this.patrolSpeed * 1.5 * this.patrolDirection
      } else {
        this.velocity.x = 0
      }

      return
    }

    if (this.position.x > this.patrolCenterX + this.patrolRange) {
      this.patrolDirection = -1
      this.switchSprite('runLeft')
    } else if (this.position.x < this.patrolCenterX - this.patrolRange) {
      this.patrolDirection = 1
      this.switchSprite('runRight')
    }

    this.velocity.x = this.patrolSpeed * this.patrolDirection
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

  updatePatrolBox() {
    this.patrolBox = {
      position: {
        x: this.position.x - 1100,
        y: this.position.y - 300
      },
      width: 2600,
      height: 1000,

      
      
    }
    c.fillStyle = "rgba(150,0,255,0.0)"
    c.fillRect(this.patrolBox.position.x, this.patrolBox.position.y, this.patrolBox.width, this.patrolBox.height)
  }

  // Separate hitbox for damaging the player
  updateDamageHitBox() {
    this.damageHitbox = {
      position: {
        // roughly match player hitbox offset/size
        x: this.position.x + 130,
        y: this.position.y + 10
      },
      width: 70,
      height: 300,
    }

    // visible debug box so you can see it
    c.fillStyle = "rgba(255,255,0,0.0)" // yellow, semi‑transparent
    c.fillRect(
      this.damageHitbox.position.x,
      this.damageHitbox.position.y,
      this.damageHitbox.width,
      this.damageHitbox.height
    )
  }

  // Called when the player successfully hits this enemy
  takeHit() {
    if (this.isDead) return
    this.hitsTaken++
    if (this.hitsTaken >= this.maxHits) {
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
}


























































































