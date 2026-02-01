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
        gsap.to(overlay, {
          opacity: 1,
          onComplete: () => {
            level++
            levels[level].init()
            gsap.to(overlay, {
              opacity: 0
            })
            player.switchSprite('idleRight')

          }
        })
      }
    },
  }
});