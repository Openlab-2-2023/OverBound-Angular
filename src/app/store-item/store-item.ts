import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { getStoreItemById, StoreItem } from '../store/store-catalog';

@Component({
  selector: 'app-store-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-item.html',
  styleUrl: './store-item.css',
})
export class StoreItemPage implements OnInit {
  item: StoreItem | null = null;
  buying = false;
  notice = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    const stateItem = history.state?.storeItem as StoreItem | undefined;
    if (stateItem?.id) {
      this.item = stateItem;
    }
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      const byId = getStoreItemById(id);
      if (byId) this.item = byId;
    });
  }

  isLoggedIn() {
    return this.auth.isLoggedIn();
  }

  get currentGold() {
    const cur = this.auth.getCurrent();
    return Number.isFinite(Number(cur?.gold)) ? Number(cur?.gold) : 0;
  }

  isOwned() {
    if (!this.item) return false;
    const cur = this.auth.getCurrent();
    const inv = Array.isArray(cur?.inventory) ? cur!.inventory! : [];
    return inv.some((it: any) => it?.id === this.item!.id);
  }

  canBuy() {
    if (!this.item) return false;
    return this.isLoggedIn() && !this.isOwned() && this.currentGold >= this.item.cost;
  }

  get previewPhoto(): string {
    return String(this.auth.getCurrent()?.photoURL || '').trim();
  }

  get previewInitial(): string {
    const current = this.auth.getCurrent();
    const source = String(current?.displayName || current?.username || current?.email || 'P').trim();
    return (source.charAt(0) || 'P').toUpperCase();
  }

  get previewFrameClass(): string | null {
    const id = String(this.item?.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    return id.startsWith('frame_') ? `preview-frame-${id}` : null;
  }

  isFrameItem() {
    return String(this.item?.id || '').toLowerCase().startsWith('frame_');
  }

  isSkinItem() {
    return String(this.item?.id || '').toLowerCase().startsWith('skin_');
  }

  get skinPreviewSrc(): string {
    const id = String(this.item?.id || '').toLowerCase();
    if (id === 'skin_purple') return 'assets/sprites/character/purple/idle.png';
    if (id === 'skin_green') return 'assets/sprites/character/green/idle.png';
    return 'assets/sprites/character/idle.png';
  }

  async buy() {
    if (!this.item || this.buying) return;
    if (!this.isLoggedIn()) {
      this.notice = 'Log in to buy this item.';
      return;
    }
    this.buying = true;
    this.notice = '';
    try {
      const res = await this.auth.buyStoreItem(this.item);
      this.notice = res.message || (res.ok ? 'Purchased.' : 'Purchase failed.');
      if (res.ok) {
        try {
          const current = this.auth.getCurrent();
          console.log('Store purchase diagnostics:', {
            itemId: this.item.id,
            currentEmail: current?.email || '',
            inventoryCount: Array.isArray(current?.inventory) ? current.inventory.length : 0,
            inventoryIds: Array.isArray(current?.inventory)
              ? current.inventory.map((entry: any) => String(entry?.id || ''))
              : [],
          });
        } catch {}
      }
    } finally {
      this.buying = false;
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
