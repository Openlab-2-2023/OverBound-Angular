class CollisionBlock {
  constructor( {position} ) {
    this.position = position
    this.width = 120 ,
    this.height = 120 
  }

  draw() {
    c.fillStyle = 'rgba(255,0,0,0.0)'
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
return objects
}