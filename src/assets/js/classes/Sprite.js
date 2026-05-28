const spriteImageCache = {};

function getSpriteImage(imageSrc) {
  if (!imageSrc) return null;
  if (!spriteImageCache[imageSrc]) {
    const image = new Image();
    image.src = imageSrc;
    spriteImageCache[imageSrc] = image;
  }
  return spriteImageCache[imageSrc];
}

class Sprite {
  constructor ({position,frameRate = 1,width,height, imageSrc, animations, loop, lastDirection, frameBuffer = 14, flipX = false, drawScale = 1, drawOffsetX = 0, drawOffsetY = 0,
    levelSpawnPosition = {
    x:0,
    y:0
  }}) {
    this.position = position
    this.frameRate = Math.max(1, frameRate || 1)
    this.currentFrame = 0
    this.elapsedFrames = 0
    this.frameBuffer = frameBuffer 
    this.animations = animations
    this.loop = loop
    this.lastDirection = lastDirection
    this.flipX = flipX
    this.drawScale = drawScale
    this.drawOffsetX = drawOffsetX
    this.drawOffsetY = drawOffsetY
    this.currentAnimation
    this.levelSpawnPosition = levelSpawnPosition
    this.image = getSpriteImage(imageSrc)
    this.loaded = false
    const setLoaded = () => {
      this.loaded = true
      this.width = this.image.width / this.frameRate
      this.height = this.image.height
    }
    if (this.image) {
      if (this.image.complete && this.image.naturalWidth > 0) {
        setLoaded()
      } else {
        this.image.addEventListener('load', setLoaded, { once: true })
      }
    } else {
      this.width = width || 0
      this.height = height || 0
    }
    
    

    if(this.animations) {
      for( let key in animations) {
        const image = getSpriteImage(this.animations[key].imageSrc)
        this.animations[key].image = image
      }
    }
  }

  draw() {
    if(!this.loaded || !this.image) return
    const cropbox = {
      position: {
        x: this.width * this.currentFrame,
        y:0
      },
      width: this.width,
            height: this.height

    }
    const drawWidth = this.width * this.drawScale
    const drawHeight = this.height * this.drawScale
    const drawX = this.position.x + this.drawOffsetX
    const drawY = this.position.y + this.drawOffsetY

    if (this.flipX) {
      c.save()
      c.translate(drawX + drawWidth, drawY)
      c.scale(-1, 1)
      c.drawImage(
        this.image,
        cropbox.position.x,
        cropbox.position.y,
        cropbox.width,
        cropbox.height,
        0,
        0,
        drawWidth,
        drawHeight,
      )
      c.restore()
    } else {
      c.drawImage(this.image,
        cropbox.position.x,
        cropbox.position.y,
        cropbox.width,
        cropbox.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      )
    }

    this.updateFramerate()
  }

  drawVisible(viewX, viewY, viewWidth, viewHeight) {
    if(!this.loaded || !this.image) return

    if (this.flipX) {
      this.draw()
      return
    }

    const frameWidth = this.width
    const frameHeight = this.height
    const drawWidth = frameWidth * this.drawScale
    const drawHeight = frameHeight * this.drawScale
    const drawX = this.position.x + this.drawOffsetX
    const drawY = this.position.y + this.drawOffsetY
    const visibleX = Math.max(drawX, viewX)
    const visibleY = Math.max(drawY, viewY)
    const visibleRight = Math.min(drawX + drawWidth, viewX + viewWidth)
    const visibleBottom = Math.min(drawY + drawHeight, viewY + viewHeight)
    const visibleWidth = visibleRight - visibleX
    const visibleHeight = visibleBottom - visibleY

    if (visibleWidth <= 0 || visibleHeight <= 0) return

    const sourceX = this.width * this.currentFrame + (visibleX - drawX) / this.drawScale
    const sourceY = (visibleY - drawY) / this.drawScale
    const sourceWidth = visibleWidth / this.drawScale
    const sourceHeight = visibleHeight / this.drawScale

    c.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      visibleX,
      visibleY,
      visibleWidth,
      visibleHeight,
    )

    this.updateFramerate()
  }

  getDrawBox() {
    return {
      position: {
        x: this.position.x + this.drawOffsetX,
        y: this.position.y + this.drawOffsetY
      },
      width: this.width * this.drawScale,
      height: this.height * this.drawScale,
    }
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
