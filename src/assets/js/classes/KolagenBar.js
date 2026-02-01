class Kolagen {
  constructor() {
    this.kolagenbar = -70
    this.width = 10
    this.position = {
      x:50,
      y:120
    }
  }

  draw() {
    const k = canvas.getContext("2d");

    k.fillStyle = "gray";
    k.fillRect(50, 50, 10, 70);
    //gradient
    const grad = k.createLinearGradient(2, 0, 36, 100);
    grad.addColorStop(0.5, "#ff8d00");
    grad.addColorStop(1, "#020024");
    k.fillStyle = grad;//az po tialto je farbicka 
    k.fillRect(this.position.x, this.position.y, this.width, this.kolagenbar); //pozicia, vyska, sirka kolagen baru
  }

  refill() {
    if(this.kolagenbar > -70) {
      this.kolagenbar -= 0.35
    }
  }
}