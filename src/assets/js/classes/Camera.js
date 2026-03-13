class Camera {
  constructor() {
    this.position = {
        x:0,
        y:0
    }
}

  updateCamera() {
  if (player.position.x >= 2200 && player.position.x <= 6650) {
    this.position.x = player.position.x - canvas.width - 240;
  }
   else if(player.position.x >= 6650) {
    this.position.x = 4500
  }
   else {
    this.position.x = 0;
  }

  
  const followStartY = 3650;

  if (player.position.y < followStartY && player.position.y > 980) {
    
    this.position.y = player.position.y - canvas.height;
  } 
   else if(player.position.y < 980 ) {
    this.position.y = -50
   }
   else {
    
    this.position.y = followStartY - canvas.height;
  }
}
}