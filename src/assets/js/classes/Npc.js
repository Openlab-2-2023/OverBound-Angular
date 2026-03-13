class NPC extends Sprite {
    constructor({
        position,
        imageSrc,
        frameRate = 1,
        animations,
        frameBuffer = 10,
        loop = true,
        collisionBlocks = [],
        levelSpawnPosition = {
            x:0,
            y:0
        }

    }) {
        super({
            position,
            imageSrc,
            frameRate,
            animations,
            frameBuffer,
            loop,
            collisionBlocks,
            levelSpawnPosition

        })

        
     
    }
}
