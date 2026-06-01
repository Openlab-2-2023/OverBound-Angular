import { ChangeDetectorRef, Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingService, InventoryItem, TradeOffer } from '../../services/trading.service';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'send-trade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './send-trade.html',
  styleUrl: './send-trade.css',
})
export class SendTradeComponent implements OnInit {
  @Output() tradeCompleted = new EventEmitter<void>();

  availableUsers: User[] = [];
  selectedUser: User | null = null;
  currentUserInventory: InventoryItem[] = [];
  selectedUserInventory: InventoryItem[] = [];

  itemsToOffer: InventoryItem[] = [];
  itemsToRequest: InventoryItem[] = [];

  loading = false;
  refreshingUsers = false;
  error: string | null = null;
  successMessage: string | null = null;
  sending = false;

  step: 'selectUser' | 'selectItems' | 'review' = 'selectUser';

  constructor(
    private tradingService: TradingService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.authService.refreshCurrentUserFromDatabase();
    const cachedUsers = this.tradingService.getCachedAvailableUsers();
    if (cachedUsers.length > 0) {
      this.availableUsers = cachedUsers;
    }
    void this.loadUsers();
    this.loadCurrentUserInventory();
  }

  get availablePlayersLabel(): string {
    const count = this.availableUsers.length;
    if (count === 0) return 'No players available right now';
    if (count === 1) return '1 player available for trading';
    return `${count} players available for trading`;
  }

  getPlayerLabel(user: User | null | undefined): string {
    const displayName = String(user?.displayName || '').trim();
    if (displayName) return displayName;

    const emailName = String(user?.email || '').trim().split('@')[0];
    if (emailName) return emailName;

    return 'Player';
  }

  async loadUsers(): Promise<void> {
    this.loading = this.availableUsers.length === 0;
    this.refreshingUsers = this.availableUsers.length > 0;
    this.error = null;
    try {
      this.availableUsers = await this.tradingService.getAvailableUsers();
      if (this.availableUsers.length === 0) {
        this.error = 'No other player accounts were found yet.';
      }
    } catch (err) {
      this.error = 'Failed to load available users.';
      console.error('Error loading users:', err);
    } finally {
      this.loading = false;
      this.refreshingUsers = false;
      this.cdr.detectChanges();
    }
  }

  loadCurrentUserInventory(): void {
    const current = this.authService.getCurrent();
    this.currentUserInventory = Array.isArray(current?.inventory) ? [...current!.inventory!] : [];
    this.cdr.detectChanges();
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.selectedUserInventory = Array.isArray(user.inventory) ? [...user.inventory!] : [];
    this.step = 'selectItems';
    this.error = null;
  }

  toggleOfferItem(item: InventoryItem): void {
    const idx = this.itemsToOffer.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      this.itemsToOffer.splice(idx, 1);
    } else {
      this.itemsToOffer.push(item);
    }
  }

  toggleRequestItem(item: InventoryItem): void {
    const idx = this.itemsToRequest.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      this.itemsToRequest.splice(idx, 1);
    } else {
      this.itemsToRequest.push(item);
    }
  }

  isItemOffered(itemId: string): boolean {
    return this.itemsToOffer.some((i) => i.id === itemId);
  }

  isItemRequested(itemId: string): boolean {
    return this.itemsToRequest.some((i) => i.id === itemId);
  }

  proceedToReview(): void {
    if (this.itemsToOffer.length === 0 && this.itemsToRequest.length === 0) {
      this.error = 'Please select at least one item to offer or request.';
      return;
    }
    this.step = 'review';
    this.error = null;
  }

  async sendTrade(): Promise<void> {
    if (!this.selectedUser || !this.selectedUser.email) {
      this.error = 'No user selected.';
      return;
    }

    const currentUser = this.authService.getCurrent();
    if (!currentUser || !currentUser.email) {
      this.error = 'You must be logged in.';
      return;
    }

    this.sending = true;
    this.error = null;

    try {
      const offer: TradeOffer = {
        senderEmail: currentUser.email,
        senderName: this.getPlayerLabel(currentUser),
        receiverEmail: this.selectedUser.email,
        receiverName: this.getPlayerLabel(this.selectedUser),
        itemsOffered: this.itemsToOffer,
        itemsRequested: this.itemsToRequest,
        status: 'pending',
      };

      await this.tradingService.sendTradeOffer(offer);
      this.successMessage = `Trade offer sent to ${this.getPlayerLabel(this.selectedUser)}!`;

      // Reset form
      setTimeout(() => {
        this.resetForm();
        this.tradeCompleted.emit();
      }, 2000);
    } catch (err) {
      this.error = 'Failed to send trade offer. Please try again.';
      console.error('Error sending trade:', err);
    } finally {
      this.sending = false;
    }
  }

  resetForm(): void {
    this.selectedUser = null;
    this.itemsToOffer = [];
    this.itemsToRequest = [];
    this.step = 'selectUser';
    this.error = null;
    this.successMessage = null;
  }

  backToUsers(): void {
    this.selectedUser = null;
    this.itemsToOffer = [];
    this.itemsToRequest = [];
    this.step = 'selectUser';
  }

  backToSelection(): void {
    this.step = 'selectItems';
  }
}
