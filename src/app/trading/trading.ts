import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TradingService, TradeOffer } from '../services/trading.service';
import { AuthService } from '../services/auth.service';
import { SendTradeComponent } from './send-trade';
import { ReceivedTradesComponent } from './received-trades';

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
  unsubscribe: (() => void) | null = null;

  constructor(
    private tradingService: TradingService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    void this.initializeTrading();
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
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
    }
  }

  subscribeToUpdates(): void {
    this.unsubscribe = this.tradingService.subscribeToReceivedOffers((offers) => {
      this.receivedOffers = offers;
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
}
