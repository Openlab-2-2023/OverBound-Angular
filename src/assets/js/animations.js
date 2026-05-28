function getSelectedCharacterSkinId() {
  const allowedSkins = ['default', 'purple', 'green']
  let selected = 'default'

  if (typeof window !== 'undefined' && typeof window.selectedCharacterSkin === 'string') {
    selected = window.selectedCharacterSkin
  }

  return allowedSkins.includes(selected) ? selected : 'default'
}

function getCharacterSkinConfig(skinId = getSelectedCharacterSkinId()) {
  if (skinId === 'purple' || skinId === 'green') {
    const skinPath = `/assets/sprites/character/${skinId}`
    return {
      id: skinId,
      idleRight: `${skinPath}/idle.png`,
      idleLeft: `${skinPath}/idle.png`,
      runRight: `${skinPath}/runright.png`,
      runLeft: `${skinPath}/runright.png`,
      attackRight: `${skinPath}/attack.png`,
      attackLeft: `${skinPath}/attack.png`,
      dashRight: `${skinPath}/dash.png`,
      dashLeft: `${skinPath}/dash.png`,
      crouchRight: `${skinPath}/crouch.png`,
      crouchLeft: `${skinPath}/crouch.png`,
      flipIdleLeft: true,
      flipRunLeft: true,
      flipAttackLeft: true,
      flipDashLeft: true,
      flipCrouchLeft: true,
    }
  }

  return {
    id: 'default',
    idleRight: '/assets/sprites/character/idle.png',
    idleLeft: '/assets/sprites/character/idleleft.png',
    runRight: '/assets/sprites/character/runright.png',
    runLeft: '/assets/sprites/character/runleft.png',
    attackRight: '/assets/sprites/character/attack.png',
    attackLeft: '/assets/sprites/character/attack.png',
    dashRight: '/assets/sprites/character/dash.png',
    dashLeft: '/assets/sprites/character/dashleft.png',
    crouchRight: '/assets/sprites/character/crouch.png',
    crouchLeft: '/assets/sprites/character/crouchleft.png',
    flipIdleLeft: false,
    flipRunLeft: false,
    flipAttackLeft: true,
    flipDashLeft: false,
    flipCrouchLeft: false,
  }
}

function createPlayerAnimations(skinId = getSelectedCharacterSkinId()) {
  const skin = getCharacterSkinConfig(skinId)

  return {
    idleRight: {
      frameRate: 4,
      frameBuffer: 14,
      loop: true,
      imageSrc: skin.idleRight
    },

    idleLeft: {
      frameRate: 4,
      frameBuffer: 14,
      loop: true,
      imageSrc: skin.idleLeft,
      flipX: skin.flipIdleLeft
    },

    runRight: {
      frameRate: 8,
      frameBuffer: 4,
      loop: true,
      imageSrc: skin.runRight

    },

    runLeft: {
      frameRate: 8,
      frameBuffer: 4,
      loop: true,
      imageSrc: skin.runLeft,
      flipX: skin.flipRunLeft
    },

    attackRight: {
      frameRate: 3,
      frameBuffer: 3,
      loop: false,
      imageSrc: skin.attackRight
    },

    attackLeft: {
      frameRate: 3,
      frameBuffer: 3,
      loop: false,
      imageSrc: skin.attackLeft,
      flipX: skin.flipAttackLeft
    },

    dash: {
      frameRate: 1,
      frameBuffer: 1,
      loop: true,
      imageSrc: skin.dashRight
    },

    dashLeft: {
      frameRate: 1,
      frameBuffer: 1,
      loop: true,
      imageSrc: skin.dashLeft,
      flipX: skin.flipDashLeft
    },

    crouch: {
      frameRate: 4,
      frameBuffer: 4,
      loop: false,
      imageSrc: skin.crouchRight
    },
    crouchLeft: {
      frameRate: 4,
      frameBuffer: 4,
      loop: false,
      imageSrc: skin.crouchLeft,
      flipX: skin.flipCrouchLeft
    },
    charge: {
      frameRate: 4,
      frameBuffer: 1,
      loop: true,
      imageSrc: skin.dashRight
    },
    chargeLeft: {
      frameRate: 4,
      frameBuffer: 6,
      loop: true,
      imageSrc: skin.dashLeft,
      flipX: skin.flipDashLeft
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
}

const initialCharacterSkin = getSelectedCharacterSkinId()
const initialCharacterAnimations = createPlayerAnimations(initialCharacterSkin)

const player = new Player({
  imageSrc: initialCharacterAnimations.idleRight.imageSrc,
  frameRate: 4,
  loop: true,
  animations: initialCharacterAnimations
});

function applyCharacterSkin(skinId = getSelectedCharacterSkinId()) {
  if (typeof player === 'undefined') return

  const currentAnimation = player.currentAnimation
  let currentAnimationName = 'idleRight'

  if (currentAnimation && player.animations) {
    for (const name in player.animations) {
      if (player.animations[name] === currentAnimation) {
        currentAnimationName = name
        break
      }
    }
  }

  const animations = createPlayerAnimations(skinId)
  for (const name in animations) {
    animations[name].image = getSpriteImage(animations[name].imageSrc)
  }

  player.animations = animations
  player.currentAnimation = null
  player.switchSprite(currentAnimationName)

  const image = player.image
  const setPlayerLoaded = () => {
    player.loaded = true
    player.width = image.width / player.frameRate
    player.height = image.height
  }

  player.loaded = false
  if (image && image.complete && image.naturalWidth > 0) {
    setPlayerLoaded()
  } else if (image) {
    image.addEventListener('load', setPlayerLoaded, { once: true })
  }
}

if (typeof window !== 'undefined') {
  window.applyCharacterSkin = applyCharacterSkin
}

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
