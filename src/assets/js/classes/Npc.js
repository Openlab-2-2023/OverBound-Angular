class NPC extends Sprite {
    constructor({
        position,
        imageSrc,
        frameRate = 1,
        animations,
        frameBuffer = 10,
        loop = true,
        collisionBlocks = [],
        id = 'npc',
        name = 'Guide',
        role = 'game_guide',
        dialogText = 'Ask me anything about OverBound.',
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

        this.id = id
        this.name = name
        this.role = role
        this.dialogText = dialogText
        
     
    }
}
