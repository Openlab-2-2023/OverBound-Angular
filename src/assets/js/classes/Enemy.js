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
        patrolSpeed = 5

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

    this.gravity = 2

    this.collisionBlocks = collisionBlocks

    this.isTransitioningLevel = false
    }
    update() {  

    this.move()

    this.position.x += this.velocity.x
    this.updateHitBox()
    this.checkForHorizontalCollisions()
    this.applyGravity()
    this.updateHitBox()
    this.checkForVerticalCollisions()
  }


  move() {

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
}





































































































