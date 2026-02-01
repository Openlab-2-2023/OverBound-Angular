class CollisionBlock {
  constructor( {position} ) {
    this.position = position
    this.width = 32,
    this.height = 32  
  }

  draw() {
    c.fillStyle = 'rgba(255,0,0,0.0)'
    c.fillRect(this.position.x, this.position.y, this.width, this.height)
  }
}

Array.prototype.Parse2D = function() {
  let rows = []
  for(let i = 0; i < this.length; i+= 32 ) {
    rows.push(this.slice(i, i + 32))
    
  }
  return rows
}

Array.prototype.createObjectsFrom2D = function() {
  const objects = []
  this.forEach((row, y) => {
    row.forEach((symbol, x) => {
      if(symbol === 1167 ) {
        objects.push(
          new CollisionBlock({
            position: {
              x: x * 32,
              y: y * 32
            }
        }))
      }
    })
})
return objects
}