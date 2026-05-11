import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingService, TradeOffer } from '../../services/trading.service';

@Component({
  selector: 'received-trades',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './received-trades.html',
  styleUrl: './received-trades.css',
})
export class ReceivedTradesComponent implements OnInit {
  @Input() offers: TradeOffer[] = [];
  @Output() tradeCompleted = new EventEmitter<void>();

  processingId: string | null = null;
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private tradingService: TradingService) {}

  ngOnInit(): void {}

  async acceptTrade(offer: TradeOffer): Promise<void> {
    if (!offer.id) return;

    this.processingId = offer.id;
    this.error = null;
    this.successMessage = null;

    try {
      await this.tradingService.acceptTradeOffer(offer.id);
      this.successMessage = `Trade accepted with ${offer.senderName}!`;
      this.tradeCompleted.emit();
      // Clear message after 3 seconds
      setTimeout(() => {
        this.successMessage = null;
      }, 3000);
    } catch (err) {
      this.error = 'Failed to accept trade. Please try again.';
      console.error('Error accepting trade:', err);
    } finally {
      this.processingId = null;
    }
  }

  async declineTrade(offer: TradeOffer): Promise<void> {
    if (!offer.id) return;

    this.processingId = offer.id;
    this.error = null;

    try {
      await this.tradingService.declineTradeOffer(offer.id);
      this.successMessage = `Trade declined from ${offer.senderName}.`;
      this.tradeCompleted.emit();
      // Clear message after 3 seconds
      setTimeout(() => {
        this.successMessage = null;
      }, 3000);
    } catch (err) {
      this.error = 'Failed to decline trade. Please try again.';
      console.error('Error declining trade:', err);
    } finally {
      this.processingId = null;
    }
  }
}
