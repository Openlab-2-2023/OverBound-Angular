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
  dragging = false;
  modalX = 0;
  modalY = 0;
  offsetX = 0;
  offsetY = 0;
  showCredits = false;
  c_dragging = false;
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
    this.c_modalX = Math.max(24, (w - modalW) / 2 + 40);
    this.c_modalY = Math.max(24, (h - modalH) / 2 + 40);
  }

  openSettings() {
    this.showSettings = true;
  }

  closeSettings() {
    this.showSettings = false;
    this.dragging = false;
  }

  openCredits() {
    this.showCredits = true;
  }

  closeCredits() {
    this.showCredits = false;
    this.c_dragging = false;
  }

  startDrag(event: PointerEvent) {
    this.dragging = true;
    this.offsetX = event.clientX - this.modalX;
    this.offsetY = event.clientY - this.modalY;
    (event.target as Element)?.setPointerCapture?.((event as any).pointerId);
    event.preventDefault();
  }

  startDragCredits(event: PointerEvent) {
    this.c_dragging = true;
    this.c_offsetX = event.clientX - this.c_modalX;
    this.c_offsetY = event.clientY - this.c_modalY;
    (event.target as Element)?.setPointerCapture?.((event as any).pointerId);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent) {
    // settings modal dragging
    if (this.dragging) {
      this.modalX = event.clientX - this.offsetX;
      this.modalY = event.clientY - this.offsetY;
      const pad = 12;
      const maxX = window.innerWidth - 200 - pad;
      const maxY = window.innerHeight - 80 - pad;
      this.modalX = Math.max(pad, Math.min(this.modalX, maxX));
      this.modalY = Math.max(pad, Math.min(this.modalY, maxY));
      return;
    }
    // credits modal dragging
    if (this.c_dragging) {
      this.c_modalX = event.clientX - this.c_offsetX;
      this.c_modalY = event.clientY - this.c_offsetY;
      const pad = 12;
      const maxX = window.innerWidth - 200 - pad;
      const maxY = window.innerHeight - 80 - pad;
      this.c_modalX = Math.max(pad, Math.min(this.c_modalX, maxX));
      this.c_modalY = Math.max(pad, Math.min(this.c_modalY, maxY));
      return;
    }
  }

  endDrag(event: PointerEvent) {
    this.dragging = false;
    this.c_dragging = false;
    try { (event.target as Element)?.releasePointerCapture?.((event as any).pointerId); } catch { }
  }

  get modalStyle() {
    if (this.dragging) {
      return {
        left: this.modalX + 'px',
        top: this.modalY + 'px',
        transform: 'none'
      };
    }
    // centered by default
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)'
    };
  }

  get creditsModalStyle() {
    if (this.c_dragging) {
      return {
        left: this.c_modalX + 'px',
        top: this.c_modalY + 'px',
        transform: 'none'
      };
    }
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)'
    };
  }

}
