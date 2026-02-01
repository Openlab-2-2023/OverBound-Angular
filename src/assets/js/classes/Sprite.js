class Sprite {
  constructor ({position,frameRate = 1, imageSrc, animations, loop, lastDirection, frameBuffer = 14,
    levelSpawnPosition = {
    x:0,
    y:0
  }}) {
    this.position = position
    this.image = new Image()
    this.image.onload = () => {
      this.loaded = true
      this.width = this.image.width / this.frameRate
      this.height = this.image.height -1
    }
    this.image.src = imageSrc
    this.loaded = false
    this.frameRate = frameRate
    this.currentFrame = 0
    this.elapsedFrames = 0
    this.frameBuffer = frameBuffer 
    this.animations = animations
    this.loop = loop
    this.lastDirection = lastDirection
    this.currentAnimation
    this.levelSpawnPosition = levelSpawnPosition
    

    if(this.animations) {
      for( let key in animations) {
        const image = new Image()
        image.src = this.animations[key].imageSrc
        this.animations[key].image = image
      }
    }
  }

  draw() {
    if(!this.loaded) return
    const cropbox = {
      position: {
        x: this.width * this.currentFrame,
        y:0
      },
      width: this.width,
      height: this.height

    }
    c.drawImage(this.image,
      cropbox.position.x,
      cropbox.position.y,
      cropbox.width,
      cropbox.height,
      this.position.x,
      this.position.y,
      this.width,
      this.height,
)

    this.updateFramerate()
  }

  updateFramerate() {
    this.elapsedFrames++
  
    if (this.elapsedFrames % this.frameBuffer === 0) {
      if (this.currentFrame < this.frameRate - 1) {
        this.currentFrame++
      } else if (this.loop) {
        this.currentFrame = 0
      } 

    }

    if(this.currentAnimation?.onComplete) {
      if(this.currentFrame === this.frameRate -1 && !this.currentAnimation.isActive) {
        this.currentAnimation.onComplete()
        this.currentAnimation = true
      }
    }
  }
}