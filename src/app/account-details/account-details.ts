import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-details.html',
  styleUrls: ['./account-details.css'],
})
export class AccountDetails implements OnInit, OnDestroy {
  editingName = false;
  editingBio = false;
  nameValue = '';
  bioValue = '';
  profilePreview: string | null = null;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  inventory: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> = [];
  isProcessingProfileImage = false;
  showCropper = false;
  cropSourceDataUrl: string | null = null;
  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;
  private readonly maxUploadBytes = 8 * 1024 * 1024;
  viewOnlyMode = false;
  viewedUser: any = null;
  loadingViewedUser = false;
  viewedUserError = '';
  private routeSub: Subscription | null = null;

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const u: any = this.user;
    this.nameValue = u?.displayName || '';
    this.bioValue = u?.bio || '';
    this.profilePreview = u?.photoURL || null;
    this.inventory = (u?.inventory && Array.isArray(u.inventory)) ? u.inventory.slice() : [];
    this.routeSub = this.route.queryParamMap.subscribe(async (params) => {
      const viewedEmail = (params.get('view') || '').trim().toLowerCase();
      const currentEmail = (this.user?.email || '').toLowerCase();
      if (viewedEmail && viewedEmail !== currentEmail) {
        this.viewOnlyMode = true;
        const stateUser = this.getStateViewedUser();
        if (stateUser && stateUser.email === viewedEmail) {
          this.viewedUser = {
            email: stateUser.email,
            displayName: stateUser.displayName || viewedEmail.split('@')[0] || 'Player',
            role: stateUser.role || 'Player',
            photoURL: stateUser.photoURL || '',
            bio: stateUser.bio || '',
            gold: Number.isFinite(Number(stateUser.gold)) ? Number(stateUser.gold) : 0,
            inventory: Array.isArray(stateUser.inventory) ? stateUser.inventory.slice() : [],
          };
          this.nameValue = this.viewedUser.displayName || '';
          this.bioValue = this.viewedUser.bio || '';
          this.profilePreview = this.viewedUser.photoURL || null;
          this.inventory = this.viewedUser.inventory || [];
        }
        await this.loadViewedUser(viewedEmail);
      } else {
        this.viewOnlyMode = false;
        this.viewedUser = null;
        this.viewedUserError = '';
        const current: any = this.user;
        this.nameValue = current?.displayName || '';
        this.bioValue = current?.bio || '';
        this.profilePreview = current?.photoURL || null;
        this.inventory = (current?.inventory && Array.isArray(current.inventory)) ? current.inventory.slice() : [];
      }
    });
    // listen for profile updates so we can update preview without full reload (own profile only)
    window.addEventListener('ob:user-updated', this.onUserUpdated as EventListener);
  }

  onUserUpdated = (ev: Event) => {
    if (this.viewOnlyMode) return;
    try {
      const detail: any = (ev as any).detail;
      if (detail && detail.photoURL) this.profilePreview = detail.photoURL;
      if (detail && detail.displayName) this.nameValue = detail.displayName;
      if (detail && typeof detail.bio === 'string') this.bioValue = detail.bio;
      if (detail && Array.isArray(detail.inventory)) this.inventory = detail.inventory.slice();
    } catch { }
  }

  ngOnDestroy(): void {
    this.releaseCropSource();
    window.removeEventListener('ob:user-updated', this.onUserUpdated as EventListener);
    if (this.routeSub) {
      this.routeSub.unsubscribe();
      this.routeSub = null;
    }
  }

  get user(): any { return this.auth.getCurrent(); }
  get activeUser(): any { return this.viewOnlyMode ? this.viewedUser : this.user; }

  async logout() { await this.auth.logout(); this.router.navigate(['/']); }
  goBack() { this.router.navigate(['/']); }

  startEditName() { if (this.viewOnlyMode) return; this.editingName = true; }
  cancelEditName() { if (this.viewOnlyMode) return; this.editingName = false; this.nameValue = this.user?.displayName || ''; }
  async saveName() {
    if (this.viewOnlyMode) return;
    const res = await this.auth.updateProfile({ displayName: this.nameValue });
    if (!res.ok) { alert(res.message || 'Failed to save name'); return; }
    this.editingName = false;
    console.log('Name saved:', this.nameValue);
  }

  startEditBio() { if (this.viewOnlyMode) return; this.editingBio = true; }
  cancelEditBio() { if (this.viewOnlyMode) return; this.editingBio = false; this.bioValue = this.user?.bio || ''; }
  async saveBio() {
    if (this.viewOnlyMode) return;
    const bio = String(this.bioValue || '').trim().slice(0, 180);
    const res = await this.auth.updateProfile({ bio });
    if (!res.ok) { alert(res.message || 'Failed to save bio'); return; }
    this.bioValue = bio;
    this.editingBio = false;
  }

  async onFileSelected(ev: Event) {
    if (this.viewOnlyMode) return;
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
    if (this.viewOnlyMode) return;
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
    if (this.viewOnlyMode) return;
    if (!this.currentPassword || !this.newPassword) { alert('Please fill passwords'); return; }
    if (this.newPassword !== this.confirmPassword) { alert('Passwords do not match'); return; }
    const res = await this.auth.changePassword(this.currentPassword, this.newPassword as string);
    if (!res.ok) { alert(res.message || 'Failed to change password'); return; }
    alert('Password changed successfully.');
    this.currentPassword = this.newPassword = this.confirmPassword = '';
  }

  async toggleEquip(item: any) {
    if (this.viewOnlyMode) return;
    const shouldEquip = !item.equipped;
    const category = this.getCosmeticCategory(item);
    if (shouldEquip && category !== 'other') {
      for (const invItem of this.inventory) {
        if (invItem === item) continue;
        if (this.getCosmeticCategory(invItem) === category) {
          invItem.equipped = false;
        }
      }
    }
    item.equipped = shouldEquip;
    // persist inventory change
    const updatedInv = this.inventory.map(i => ({ ...i }));
    const res = await this.auth.updateProfile({ inventory: updatedInv });
    if (!res.ok) {
      item.equipped = !item.equipped;
      alert(res.message || 'Failed to update inventory');
    }
  }

  getSellPrice(item: any): number {
    return this.auth.getInventorySellValue(
      String(item?.id || ''),
      String(item?.name || ''),
      Number(item?.cost || 0),
    );
  }

  async sellItem(item: any) {
    if (this.viewOnlyMode) return;
    const sellPrice = this.getSellPrice(item);
    if (sellPrice <= 0) {
      alert('This item cannot be sold yet.');
      return;
    }
    const res = await this.auth.sellInventoryItem(String(item?.id || ''));
    if (!res.ok) {
      alert(res.message || 'Failed to sell item');
      return;
    }
    this.inventory = (this.user?.inventory && Array.isArray(this.user.inventory))
      ? this.user.inventory.slice()
      : [];
  }

  getEquippedFrameClass(): string | null {
    const frameId = this.getEquippedCosmeticId('frame');
    return frameId ? `profile-frame-${frameId}` : null;
  }

  getEquippedBannerClass(): string | null {
    const bannerId = this.getEquippedCosmeticId('banner');
    return bannerId ? `profile-banner-${bannerId}` : null;
  }

  getEquippedCosmeticId(category: 'frame' | 'banner'): string {
    const inventory = Array.isArray(this.inventory) ? this.inventory : [];
    const prefix = `${category}_`;
    const equipped = inventory.find((item) => item?.equipped && String(item.id || '').toLowerCase().startsWith(prefix));
    return String(equipped?.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }

  getCosmeticCategory(item: any): 'frame' | 'banner' | 'other' {
    const id = String(item?.id || '').trim().toLowerCase();
    if (id.startsWith('frame_')) return 'frame';
    if (id.startsWith('banner_')) return 'banner';
    return 'other';
  }

  private async loadViewedUser(email: string) {
    this.loadingViewedUser = true;
    const hadStateUser = !!this.viewedUser;
    this.viewedUserError = '';
    try {
      let remote = await this.auth.getUserProfileByEmail(email);
      if (!remote) {
        const lbUser = await this.auth.getLeaderboardUserByEmailFromDatabase(email);
        if (lbUser) {
          remote = {
            email: lbUser.email,
            displayName: lbUser.displayName,
            role: lbUser.role,
            gold: lbUser.gold,
            photoURL: lbUser.photoURL || '',
            inventory: Array.isArray(lbUser.inventory) ? lbUser.inventory.slice() : [],
          } as any;
        }
      }
      if (!remote) {
        if (!hadStateUser) {
          this.viewedUser = null;
          this.viewedUserError = 'Player profile not found.';
        }
        return;
      }
      this.viewedUser = {
        email,
        displayName: (remote as any).displayName || email.split('@')[0] || 'Player',
        role: (remote as any).role || 'Player',
        photoURL: (remote as any).photoURL || '',
        bio: (remote as any).bio || '',
        gold: Number.isFinite(Number((remote as any).gold)) ? Number((remote as any).gold) : 0,
        inventory: Array.isArray((remote as any).inventory) ? (remote as any).inventory.slice() : [],
      };
      this.nameValue = this.viewedUser.displayName || '';
      this.bioValue = this.viewedUser.bio || '';
      this.profilePreview = this.viewedUser.photoURL || null;
      this.inventory = this.viewedUser.inventory || [];
    } catch (e: any) {
      if (!hadStateUser) {
        this.viewedUser = null;
        this.viewedUserError = e?.message || 'Failed to load player profile.';
      } else {
        this.viewedUserError = '';
      }
    } finally {
      this.loadingViewedUser = false;
    }
  }

  private getStateViewedUser(): any | null {
    try {
      const st: any = history.state;
      if (st && st.leaderboardUser && st.leaderboardUser.email) {
        return st.leaderboardUser;
      }
      return null;
    } catch {
      return null;
    }
  }
}
