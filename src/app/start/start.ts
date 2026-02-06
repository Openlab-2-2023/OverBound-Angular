import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-start',
  imports: [RouterLink, CommonModule],
  standalone: true,
  templateUrl: './start.html',
  styleUrl: './start.css',
})
export class Start implements OnInit {
  showSettings = false;
 // dragging = false;
  modalX = 0;
  modalY = 0;
  offsetX = 0;
  offsetY = 0;
  showCredits = false;
 // c_dragging = false;
  c_modalX = 0;
  c_modalY = 0;
  c_offsetX = 0;
  c_offsetY = 0;

  ngOnInit(): void {
    // initialize modal centered
    const w = window.innerWidth;
    const h = window.innerHeight;
    const modalW = 420;
    const modalH = 300;
    this.modalX = Math.max(24, (w - modalW) / 2);
    this.modalY = Math.max(24, (h - modalH) / 2);
    // credits modal slightly lower/right by default
    //this.c_modalX = Math.max(24, (w - modalW) / 2 + 40);
    //this.c_modalY = Math.max(24, (h - modalH) / 2 + 40);
  }

  openSettings() {
    this.showSettings = true;
  }

  closeSettings() {
    this.showSettings = false;
   // this.dragging = false;
  }

  openCredits() {
    this.showCredits = true;
  }

  closeCredits() {
    this.showCredits = false;
   // this.c_dragging = false;
  }
  get modalStyle() {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)'
    };
  }

  get creditsModalStyle() {
    return {
        left: "50%",
        top: "50%",
        transform: 'translate(-50%,-50%)',
        position: 'fixed'
      };
  }

}
