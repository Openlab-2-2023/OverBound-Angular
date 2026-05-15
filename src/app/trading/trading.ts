import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TradingService, TradeOffer } from '../services/trading.service';
import { AuthService } from '../services/auth.service';
import { SendTradeComponent } from './send-trade';
import { ReceivedTradesComponent } from './received-trades';
import { getStoreItemById } from '../store/store-catalog';

@Component({
  selector: 'app-trading',
  standalone: true,
  imports: [CommonModule, RouterLink, SendTradeComponent, ReceivedTradesComponent],
  templateUrl: './trading.html',
  styleUrl: './trading.css',
})
export class TradingComponent implements OnInit, OnDestroy {
  tab: 'send' | 'received' | 'sent' = 'received';
  receivedOffers: TradeOffer[] = [];
  sentOffers: TradeOffer[] = [];
  loading = false;
  receivedUnsubscribe: (() => void) | null = null;
  sentUnsubscribe: (() => void) | null = null;

  constructor(
    private tradingService: TradingService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.initializeTrading();
  }

  ngOnDestroy(): void {
    if (this.receivedUnsubscribe) {
      this.receivedUnsubscribe();
    }

    if (this.sentUnsubscribe) {
      this.sentUnsubscribe();
    }
  }

  private async initializeTrading(): Promise<void> {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    await this.authService.waitForFirebaseAuthReady(5000);

    if (!this.authService.isLoggedIn()) {
      return;
    }

    this.tab = 'received';
    await this.loadOffers();
    this.subscribeToUpdates();
  }

  async loadOffers(): Promise<void> {
    this.loading = true;
    try {
      const [receivedResult, sentResult] = await Promise.allSettled([
        this.tradingService.getReceivedOffers(),
        this.tradingService.getSentOffers(),
      ]);

      if (receivedResult.status === 'fulfilled') {
        this.receivedOffers = receivedResult.value;
      } else {
        this.receivedOffers = [];
        console.error('Error loading received offers:', receivedResult.reason);
      }

      if (sentResult.status === 'fulfilled') {
        this.sentOffers = sentResult.value;
      } else {
        this.sentOffers = [];
        console.error('Error loading sent offers:', sentResult.reason);
      }
    } catch (error) {
      console.error('Error loading offers:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  subscribeToUpdates(): void {
    this.receivedUnsubscribe = this.tradingService.subscribeToReceivedOffers((offers) => {
      this.receivedOffers = offers;
      this.cdr.detectChanges();
    });

    this.sentUnsubscribe = this.tradingService.subscribeToSentOffers((offers) => {
      this.sentOffers = offers;
      this.cdr.detectChanges();
    });
  }

  selectTab(tab: 'send' | 'received' | 'sent'): void {
    this.tab = tab;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  async onTradeCompleted(): Promise<void> {
    await this.loadOffers();
  }

  getItemName(item: { id?: string; name?: string } | null | undefined): string {
    const directName = String(item?.name || '').trim();
    if (directName) {
      return directName;
    }

    const itemId = String(item?.id || '').trim().toLowerCase();
    const catalogItem = itemId ? getStoreItemById(itemId) : null;
    if (catalogItem?.name) {
      return catalogItem.name;
    }

    return itemId
      ? itemId
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : 'Unknown Item';
  }

  getItemIcon(item: { id?: string; icon?: string } | null | undefined): string {
    const directIcon = String(item?.icon || '').trim();
    if (directIcon) {
      return directIcon;
    }

    const itemId = String(item?.id || '').trim().toLowerCase();
    const catalogItem = itemId ? getStoreItemById(itemId) : null;
    if (catalogItem?.icon) {
      return catalogItem.icon;
    }

    return 'ITM';
  }
}
