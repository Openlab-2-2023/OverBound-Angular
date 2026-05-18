import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingService, TradeOffer } from '../../services/trading.service';
import { getStoreItemById } from '../../store/store-catalog';

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

  isPending(offer: TradeOffer): boolean {
    return offer.status === 'pending';
  }

  async acceptTrade(offer: TradeOffer): Promise<void> {
    if (!offer.id || !this.isPending(offer)) return;

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
    if (!offer.id || !this.isPending(offer)) return;

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

  getOfferStatusLabel(offer: TradeOffer): string {
    switch (offer.status) {
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      default:
        return 'Pending';
    }
  }

  getOfferStatusMessage(offer: TradeOffer): string {
    const directMessage = String(offer.statusMessage || '').trim();
    if (directMessage) {
      return directMessage;
    }

    switch (offer.status) {
      case 'accepted':
        return `You accepted ${offer.senderName}'s trade offer.`;
      case 'declined':
        return `You declined ${offer.senderName}'s trade offer.`;
      case 'cancelled':
        return `${offer.senderName} cancelled this trade offer.`;
      case 'completed':
        return 'This trade was completed.';
      default:
        return 'Waiting for your response.';
    }
  }

  getOfferTimestamp(offer: TradeOffer): number | undefined {
    return offer.resolvedAt || offer.createdAt;
  }
}
