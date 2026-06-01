class CollisionBlock {
  constructor( {position} ) {
    this.position = position
    this.width = 119 ,
    this.height = 119 
  }

  draw() {
    if (!window.DEBUG_COLLISIONS) return
    c.fillStyle = 'rgba(255,0,0,0.5)'
    c.fillRect(this.position.x, this.position.y, this.width, this.height)
  }
}

Array.prototype.Parse2D = function(tileCount) {
  const rows = [];
  for (let i = 0; i < this.length; i += tileCount) {
    rows.push(this.slice(i, i + tileCount));
  }
  return rows;
};

Array.prototype.createObjectsFrom2D = function() {
  const objects = []
  this.forEach((row, y) => {
    row.forEach((symbol, x) => {
      if(symbol === 1167 ) {
        objects.push(
          new CollisionBlock({
            position: {
              x: x * 120 ,
              y: y * 120
            }
        }))
      }
    })
})
objects.cellSize = 120
objects.grid = {}
objects.forEach((object) => {
  const cellX = Math.floor(object.position.x / objects.cellSize)
  const cellY = Math.floor(object.position.y / objects.cellSize)
  const key = `${cellX},${cellY}`
  if (!objects.grid[key]) objects.grid[key] = []
  objects.grid[key].push(object)
})
objects.getNearby = function(box, padding = 180) {
  if (!box || !box.position) return this

  const minX = Math.floor((box.position.x - padding) / this.cellSize)
  const maxX = Math.floor((box.position.x + box.width + padding) / this.cellSize)
  const minY = Math.floor((box.position.y - padding) / this.cellSize)
  const maxY = Math.floor((box.position.y + box.height + padding) / this.cellSize)
  const nearby = []

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = this.grid[`${x},${y}`]
      if (!cell) continue
      for (let i = 0; i < cell.length; i++) {
        nearby.push(cell[i])
      }
    }
  }

  return nearby
}
return objects
}
