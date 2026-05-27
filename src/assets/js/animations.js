const player = new Player({
  imageSrc: '/assets/sprites/character/idle.png',
  frameRate: 4,
  loop: true,
  animations: {
    idleRight: {
      frameRate: 4,
      frameBuffer: 14,
      loop: true,
      imageSrc: '/assets/sprites/character/idle.png'
    },

    idleLeft: {
      frameRate: 4,
      frameBuffer: 14,
      loop: true,
      imageSrc: '/assets/sprites/character/idleleft.png'
    },

    runRight: {
      frameRate: 8,
      frameBuffer: 4,
      loop: true,
      imageSrc: '/assets/sprites/character/runright.png'

    },

    runLeft: {
      frameRate: 8,
      frameBuffer: 4,
      loop: true,
      imageSrc: '/assets/sprites/character/runleft.png'
    },

    attackRight: {
      frameRate: 3,
      frameBuffer: 3,
      loop: false,
      imageSrc: '/assets/sprites/character/attack.png'
    },

    attackLeft: {
      frameRate: 3,
      frameBuffer: 3,
      loop: false,
      imageSrc: '/assets/sprites/character/attack.png',
      flipX: true
    },

    dash: {
      frameRate: 1,
      frameBuffer: 1,
      loop: true,
      imageSrc: '/assets/sprites/character/dash.png'
    },

    dashLeft: {
      frameRate: 1,
      frameBuffer: 1,
      loop: true,
      imageSrc: '/assets/sprites/character/dashleft.png'
    },

    crouch: {
      frameRate: 4,
      frameBuffer: 4,
      loop: false,
      imageSrc: '/assets/sprites/character/crouch.png'
    },
    crouchLeft: {
      frameRate: 4,
      frameBuffer: 4,
      loop: false,
      imageSrc: '/assets/sprites/character/crouchleft.png'
    },
    charge: {
      frameRate: 4,
      frameBuffer: 1,
      loop: true,
      imageSrc: '/assets/sprites/character/dash.png'
    },
    chargeLeft: {
      frameRate: 4,
      frameBuffer: 6,
      loop: true,
      imageSrc: '/assets/sprites/character/dashleft.png'
    },
    perish: {
      frameRate: 3,
      frameBuffer: 10,
      loop: false,
      imageSrc: '/assets/sprites/character/perish.png',
      onComplete: () => {
        const restartLevel = () => {
          if (typeof player.resetHealth === 'function') {
            player.resetHealth()
          }
          if (levels[level] && typeof levels[level].init === 'function') {
            levels[level].init()
          }
          player.switchSprite('idleRight')
        }

        if (typeof gsap !== 'undefined') {
          gsap.to(overlay, {
            opacity: 1,
            duration: 0.5,
            onComplete: () => {
              restartLevel()
              gsap.to(overlay, {
                opacity: 0,
                duration: 0.5
              })
            }
          })
        } else {
          overlay.opacity = 1
          setTimeout(() => {
            restartLevel()
            overlay.opacity = 0
          }, 500)
        }
      }
    },
  }
});


const enemySpriteConfigs = {
  mushroom: {
    run: '/assets/sprites/enemy/Mushroom-Run.png',
    hit: '/assets/sprites/enemy/Mushroom-Hit.png',
    die: '/assets/sprites/enemy/Mushroom-Die.png',
    frameRate: 8,
    frameBuffer: 8,
    hitFrameRate: 5,
    hitFrameBuffer: 6,
    dieFrameRate: 15,
    dieFrameBuffer: 6,
    loop: true,
    drawScale: 1,
    drawOffsetX: 30,
    drawOffsetY: 0,
    flipOffsetX: 50,
    bodySourceOffsetX: 200,
    bodySourceOffsetY: 0,
    bodyWidth: 240,
    bodyHeight: 272,
    hitboxBodyOffsetX: 85,
    hitboxBodyOffsetY: 200,
    damageHitboxBodyOffsetX: 85,
    damageHitboxBodyOffsetY: 200,
    hitboxWidth: 70,
    hitboxHeight: 300,
    debug: false,
  },
}

function buildEnemyConfig(spriteConfig = enemySpriteConfigs.mushroom) {
  return {
    imageSrc: spriteConfig.run,
    frameRate: spriteConfig.frameRate,
    frameBuffer: spriteConfig.frameBuffer,
    loop: spriteConfig.loop,
    drawScale: spriteConfig.drawScale,
    drawOffsetX: spriteConfig.drawOffsetX,
    drawOffsetY: spriteConfig.drawOffsetY,
    hitboxOffsetX: spriteConfig.hitboxOffsetX,
    hitboxOffsetY: spriteConfig.hitboxOffsetY,
    hitboxWidth: spriteConfig.hitboxWidth,
    hitboxHeight: spriteConfig.hitboxHeight,
    damageHitboxOffsetX: spriteConfig.damageHitboxOffsetX,
    damageHitboxOffsetY: spriteConfig.damageHitboxOffsetY,
    damageHitboxWidth: spriteConfig.damageHitboxWidth,
    damageHitboxHeight: spriteConfig.damageHitboxHeight,
    hitboxOffsetXLeft: spriteConfig.hitboxOffsetXLeft,
    hitboxOffsetXRight: spriteConfig.hitboxOffsetXRight,
    damageHitboxOffsetXLeft: spriteConfig.damageHitboxOffsetXLeft,
    damageHitboxOffsetXRight: spriteConfig.damageHitboxOffsetXRight,
    bodySourceOffsetX: spriteConfig.bodySourceOffsetX,
    bodySourceOffsetY: spriteConfig.bodySourceOffsetY,
    bodyWidth: spriteConfig.bodyWidth,
    bodyHeight: spriteConfig.bodyHeight,
    hitboxBodyOffsetX: spriteConfig.hitboxBodyOffsetX,
    hitboxBodyOffsetY: spriteConfig.hitboxBodyOffsetY,
    damageHitboxBodyOffsetX: spriteConfig.damageHitboxBodyOffsetX,
    damageHitboxBodyOffsetY: spriteConfig.damageHitboxBodyOffsetY,
    debug: spriteConfig.debug,
    animations: {
      runRight: {
        frameRate: spriteConfig.frameRate,
        frameBuffer: spriteConfig.frameBuffer,
        loop: spriteConfig.loop,
        imageSrc: spriteConfig.run,
        flipX: true,
        drawOffsetX: spriteConfig.flipOffsetX,
      },
      runLeft: {
        frameRate: spriteConfig.frameRate,
        frameBuffer: spriteConfig.frameBuffer,
        loop: spriteConfig.loop,
        imageSrc: spriteConfig.run,
        flipX: false,
      },
      hitRight: {
        frameRate: spriteConfig.hitFrameRate,
        frameBuffer: spriteConfig.hitFrameBuffer,
        loop: false,
        imageSrc: spriteConfig.hit,
        flipX: true,
        drawOffsetX: spriteConfig.flipOffsetX,
      },
      hitLeft: {
        frameRate: spriteConfig.hitFrameRate,
        frameBuffer: spriteConfig.hitFrameBuffer,
        loop: false,
        imageSrc: spriteConfig.hit,
        flipX: false,
      },
      dieRight: {
        frameRate: spriteConfig.dieFrameRate,
        frameBuffer: spriteConfig.dieFrameBuffer,
        loop: false,
        imageSrc: spriteConfig.die,
        flipX: true,
        drawOffsetX: spriteConfig.flipOffsetX,
      },
      dieLeft: {
        frameRate: spriteConfig.dieFrameRate,
        frameBuffer: spriteConfig.dieFrameBuffer,
        loop: false,
        imageSrc: spriteConfig.die,
        flipX: false,
      },
    },
  }
}

const enemyConfig = buildEnemyConfig()

function createEnemy({ sprite = enemySpriteConfigs.mushroom, ...options }) {
  const config = buildEnemyConfig(sprite)

  return new Enemy({
    imageSrc: config.imageSrc,
    frameRate: config.frameRate,
    frameBuffer: config.frameBuffer,
    loop: config.loop,
    drawScale: config.drawScale,
    drawOffsetX: config.drawOffsetX,
    drawOffsetY: config.drawOffsetY,
    hitboxOffsetX: config.hitboxOffsetX,
    hitboxOffsetY: config.hitboxOffsetY,
    hitboxWidth: config.hitboxWidth,
    hitboxHeight: config.hitboxHeight,
    damageHitboxOffsetX: config.damageHitboxOffsetX,
    damageHitboxOffsetY: config.damageHitboxOffsetY,
    damageHitboxWidth: config.damageHitboxWidth,
    damageHitboxHeight: config.damageHitboxHeight,
    hitboxOffsetXLeft: config.hitboxOffsetXLeft,
    hitboxOffsetXRight: config.hitboxOffsetXRight,
    damageHitboxOffsetXLeft: config.damageHitboxOffsetXLeft,
    damageHitboxOffsetXRight: config.damageHitboxOffsetXRight,
    bodySourceOffsetX: config.bodySourceOffsetX,
    bodySourceOffsetY: config.bodySourceOffsetY,
    bodyWidth: config.bodyWidth,
    bodyHeight: config.bodyHeight,
    hitboxBodyOffsetX: config.hitboxBodyOffsetX,
    hitboxBodyOffsetY: config.hitboxBodyOffsetY,
    damageHitboxBodyOffsetX: config.damageHitboxBodyOffsetX,
    damageHitboxBodyOffsetY: config.damageHitboxBodyOffsetY,
    debug: config.debug,
    animations: config.animations,
    ...options,
  })
}
