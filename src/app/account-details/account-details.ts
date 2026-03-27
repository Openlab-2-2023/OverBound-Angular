import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-details.html',
  styleUrls: ['./account-details.css'],
})
export class AccountDetails implements OnInit, OnDestroy {
  editingName = false;
  nameValue = '';
  profilePreview: string | null = null;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  inventory: Array<{ id: string; name: string; icon: string; equipped?: boolean }> = [];
  isProcessingProfileImage = false;
  showCropper = false;
  cropSourceDataUrl: string | null = null;
  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;
  private readonly maxUploadBytes = 8 * 1024 * 1024;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const u: any = this.user;
    this.nameValue = u?.displayName || '';
    this.profilePreview = u?.photoURL || null;
    this.inventory = (u?.inventory && Array.isArray(u.inventory)) ? u.inventory.slice() : [];
    // listen for profile updates so we can update preview without full reload
    window.addEventListener('ob:user-updated', this.onUserUpdated as EventListener);
  }

  onUserUpdated = (ev: Event) => {
    try {
      const detail: any = (ev as any).detail;
      if (detail && detail.photoURL) this.profilePreview = detail.photoURL;
      if (detail && detail.displayName) this.nameValue = detail.displayName;
    } catch { }
  }

  ngOnDestroy(): void {
    this.releaseCropSource();
    window.removeEventListener('ob:user-updated', this.onUserUpdated as EventListener);
  }

  get user(): any { return this.auth.getCurrent(); }

  async logout() { await this.auth.logout(); this.router.navigate(['/']); }
  goBack() { this.router.navigate(['/']); }

  startEditName() { this.editingName = true; }
  cancelEditName() { this.editingName = false; this.nameValue = this.user?.displayName || ''; }
  async saveName() {
    const res = await this.auth.updateProfile({ displayName: this.nameValue });
    if (!res.ok) { alert(res.message || 'Failed to save name'); return; }
    this.editingName = false;
    console.log('Name saved:', this.nameValue);
  }

  async onFileSelected(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    if (!inp.files || inp.files.length === 0) return;
    const file = inp.files[0];
    inp.value = '';

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > this.maxUploadBytes) {
      alert('Image is too large. Please pick an image up to 8 MB.');
      return;
    }

    try {
      this.releaseCropSource();
      this.cropSourceDataUrl = URL.createObjectURL(file);
      this.cropZoom = 1;
      this.cropOffsetX = 0;
      this.cropOffsetY = 0;
      this.showCropper = true;
    } catch {
      alert('Failed to load image.');
    }
  }

  cancelCropper() {
    this.showCropper = false;
    this.releaseCropSource();
    this.cropZoom = 1;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
  }

  async applyCroppedImage() {
    if (!this.cropSourceDataUrl) return;
    this.isProcessingProfileImage = true;
    try {
      // let Angular paint the "processing" state before running canvas work
      await this.nextFrame();
      const dataUrl = await this.cropAndCompress(this.cropSourceDataUrl, 180, 0.62);
      const base64 = dataUrl.split(',')[1] || '';
      const approxBytes = Math.ceil((base64.length * 3) / 4);
      if (approxBytes > 95 * 1024) {
        alert('Image is still too large after processing. Please choose a smaller image.');
        return;
      }
      const finalPhotoUrl = dataUrl;
      this.profilePreview = finalPhotoUrl;
      const res = await this.auth.updateProfile(
        { photoURL: finalPhotoUrl },
        { waitForCloud: true, cloudTimeoutMs: 12000 },
      );
      if (!res.ok) {
        alert(res.message || 'Failed to save profile picture');
        return;
      }
      if (res.message) {
        alert(res.message);
        return;
      }
      this.cancelCropper();
      window.location.reload();
    } catch (e: any) {
      const msg = e?.message ? `Failed to save profile picture: ${e.message}` : 'Failed to save profile picture.';
      alert(msg);
    } finally {
      this.isProcessingProfileImage = false;
    }
  }

  private cropAndCompress(source: string, canvasSize = 180, quality = 0.62) {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn();
      };
      const timeoutId = window.setTimeout(() => {
        finish(() => reject(new Error('Image load timed out')));
      }, 12000);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        const baseScale = Math.max(canvasSize / img.width, canvasSize / img.height);
        const scaledW = img.width * baseScale * this.cropZoom;
        const scaledH = img.height * baseScale * this.cropZoom;
        const maxOffsetX = Math.max(0, (scaledW - canvasSize) / 2);
        const maxOffsetY = Math.max(0, (scaledH - canvasSize) / 2);
        const offsetX = (this.cropOffsetX / 100) * maxOffsetX;
        const offsetY = (this.cropOffsetY / 100) * maxOffsetY;
        const drawX = (canvasSize - scaledW) / 2 + offsetX;
        const drawY = (canvasSize - scaledH) / 2 + offsetY;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
        try {
          // Fast path: single encode for snappy UX, tiny avatar payload.
          let out = canvas.toDataURL('image/jpeg', quality);
          let b64 = out.split(',')[1] || '';
          let bytes = Math.ceil((b64.length * 3) / 4);
          if (bytes > 95 * 1024) {
            out = canvas.toDataURL('image/jpeg', 0.5);
            b64 = out.split(',')[1] || '';
            bytes = Math.ceil((b64.length * 3) / 4);
            if (bytes > 95 * 1024) {
              const tiny = 160;
              canvas.width = tiny;
              canvas.height = tiny;
              const tinyScale = Math.max(tiny / img.width, tiny / img.height);
              const tinyW = img.width * tinyScale * this.cropZoom;
              const tinyH = img.height * tinyScale * this.cropZoom;
              const tinyMaxX = Math.max(0, (tinyW - tiny) / 2);
              const tinyMaxY = Math.max(0, (tinyH - tiny) / 2);
              const tinyOffX = (this.cropOffsetX / 100) * tinyMaxX;
              const tinyOffY = (this.cropOffsetY / 100) * tinyMaxY;
              const tinyX = (tiny - tinyW) / 2 + tinyOffX;
              const tinyY = (tiny - tinyH) / 2 + tinyOffY;
              ctx.clearRect(0, 0, tiny, tiny);
              ctx.drawImage(img, tinyX, tinyY, tinyW, tinyH);
              out = canvas.toDataURL('image/jpeg', 0.45);
            }
          }
          finish(() => resolve(out));
        } catch (err) {
          finish(() => reject(err));
        }
      };
      img.onerror = (err) => finish(() => reject(err));
      img.src = source;
    });
  }

  private nextFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  private releaseCropSource() {
    if (this.cropSourceDataUrl && this.cropSourceDataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.cropSourceDataUrl);
    }
    this.cropSourceDataUrl = null;
  }

  async changePassword() {
    if (!this.currentPassword || !this.newPassword) { alert('Please fill passwords'); return; }
    if (this.newPassword !== this.confirmPassword) { alert('Passwords do not match'); return; }
    const res = await this.auth.changePassword(this.currentPassword, this.newPassword as string);
    if (!res.ok) { alert(res.message || 'Failed to change password'); return; }
    alert('Password changed successfully.');
    this.currentPassword = this.newPassword = this.confirmPassword = '';
  }

  async toggleEquip(item: any) {
    item.equipped = !item.equipped;
    // persist inventory change
    const updatedInv = this.inventory.map(i => ({ ...i }));
    const res = await this.auth.updateProfile({ inventory: updatedInv });
    if (!res.ok) {
      item.equipped = !item.equipped;
      alert(res.message || 'Failed to update inventory');
    }
  }
}
