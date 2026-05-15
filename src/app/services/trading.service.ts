import { Injectable } from '@angular/core';
import { initFirebaseIfNeeded, getFirestoreInstance, getAuthInstance } from './firebase.init';
import { AuthService, User } from './auth.service';
import { FIREBASE_SDK_CONFIG } from './firebase.sdk.config';
import { getStoreItemById } from '../store/store-catalog';

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  cost?: number;
  equipped?: boolean;
}

export interface TradeOffer {
  id?: string;
  senderEmail: string;
  senderName: string;
  receiverEmail: string;
  receiverName: string;
  itemsOffered: InventoryItem[];
  itemsRequested: InventoryItem[];
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  createdAt?: number;
  expiresAt?: number;
}

@Injectable({ providedIn: 'root' })
export class TradingService {
  private tradeCollectionName = 'trades';
  private availableUsersCache: User[] = [];
  private availableUsersCacheAt = 0;
  private availableUsersRequest: Promise<User[]> | null = null;
  private readonly availableUsersCacheTtlMs = 60_000;
  private tradeDiagnosticsLogged = false;

  constructor(private authService: AuthService) {}

  private normalizeEmail(email: string | undefined | null): string {
    return String(email || '').trim().toLowerCase();
  }

  private sanitizeInventoryItem(item: InventoryItem): InventoryItem {
    const normalizedId = String(item?.id || '').trim().toLowerCase();
    const catalogItem = normalizedId ? getStoreItemById(normalizedId) : null;
    const fallbackName = normalizedId
      ? normalizedId
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : 'Unknown Item';
    const sanitized: InventoryItem = {
      id: normalizedId,
      name: String(item?.name || catalogItem?.name || fallbackName).trim(),
      icon: String(item?.icon || catalogItem?.icon || 'ITM').trim(),
    };

    if (Number.isFinite(Number(item?.cost))) {
      sanitized.cost = Number(item.cost);
    } else if (Number.isFinite(Number(catalogItem?.cost))) {
      sanitized.cost = Number(catalogItem?.cost);
    }

    if (typeof item?.equipped === 'boolean') {
      sanitized.equipped = item.equipped;
    }

    return sanitized;
  }

  private normalizeTimestampValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      const timestamp = value as {
        toMillis?: () => number;
        seconds?: number;
        nanoseconds?: number;
      };

      if (typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
      }

      if (typeof timestamp.seconds === 'number') {
        const nanoseconds = typeof timestamp.nanoseconds === 'number' ? timestamp.nanoseconds : 0;
        return (timestamp.seconds * 1000) + Math.floor(nanoseconds / 1_000_000);
      }
    }

    return undefined;
  }

  private normalizeTradeOffer(offer: TradeOffer): TradeOffer {
    return {
      ...offer,
      senderEmail: this.normalizeEmail(offer.senderEmail),
      senderName: String(offer.senderName || '').trim() || 'Unknown',
      receiverEmail: this.normalizeEmail(offer.receiverEmail),
      receiverName: String(offer.receiverName || '').trim() || 'Unknown',
      itemsOffered: Array.isArray(offer.itemsOffered)
        ? offer.itemsOffered.map((item) => this.sanitizeInventoryItem(item))
        : [],
      itemsRequested: Array.isArray(offer.itemsRequested)
        ? offer.itemsRequested.map((item) => this.sanitizeInventoryItem(item))
        : [],
      status: offer.status || 'pending',
      createdAt: this.normalizeTimestampValue(offer.createdAt),
      expiresAt: this.normalizeTimestampValue(offer.expiresAt),
    };
  }

  private async hasFirestoreTradeAccess(): Promise<boolean> {
    await this.authService.waitForFirebaseAuthReady(5000);
    await initFirebaseIfNeeded();

    const firestore = getFirestoreInstance();
    const auth = getAuthInstance();
    const currentUser = this.authService.getCurrent();
    const currentEmail = this.normalizeEmail(currentUser?.email);
    const firebaseEmail = this.normalizeEmail(auth?.currentUser?.email);

    return !!firestore && !!currentEmail && !!firebaseEmail && currentEmail === firebaseEmail;
  }

  private getTradeAccessDiagnostics() {
    const auth = getAuthInstance();
    const firestore = getFirestoreInstance();
    const currentUser = this.authService.getCurrent();

    return {
      firebaseProjectId: String(FIREBASE_SDK_CONFIG?.projectId || ''),
      localEmail: this.normalizeEmail(currentUser?.email),
      firebaseEmail: this.normalizeEmail(auth?.currentUser?.email),
      firebaseUid: String(auth?.currentUser?.uid || ''),
      firebaseAuthenticated: !!auth?.currentUser,
      firestoreReady: !!firestore,
    };
  }

  private logTradeAccessDiagnostics(reason: string): void {
    if (this.tradeDiagnosticsLogged) {
      return;
    }

    this.tradeDiagnosticsLogged = true;
    console.warn(`Trading diagnostics (${reason}):`, this.getTradeAccessDiagnostics());
  }

  private getTradingAuthError(): Error {
    return new Error('Trading requires a Firebase-authenticated session. Please log in again with your account.');
  }

  private isPermissionDeniedError(error: unknown): boolean {
    const code = String((error as { code?: string } | null)?.code || '');
    const message = String((error as { message?: string } | null)?.message || '');

    return code.includes('permission-denied') || message.toLowerCase().includes('insufficient permissions');
  }

  private getTradingPermissionError(): Error {
    return new Error(
      'Trading is blocked by Firestore permissions. Make sure the live Firestore rules are deployed and that you are signed in with Firebase Auth.',
    );
  }

  private isAvailableUsersCacheFresh(): boolean {
    return this.availableUsersCache.length > 0 && Date.now() - this.availableUsersCacheAt < this.availableUsersCacheTtlMs;
  }

  private getTradeCreatedAtValue(offer: Partial<TradeOffer> & { createdAt?: unknown }): number {
    return this.normalizeTimestampValue(offer?.createdAt) ?? 0;
  }

  private sortTradesByCreatedAtDesc(offers: TradeOffer[]): TradeOffer[] {
    return [...offers].sort((a, b) => this.getTradeCreatedAtValue(b) - this.getTradeCreatedAtValue(a));
  }

  private removeInventoryItemById(items: InventoryItem[], itemId: string): boolean {
    const normalizedId = String(itemId || '').trim().toLowerCase();
    if (!normalizedId) {
      return false;
    }

    const idx = items.findIndex((item) => String(item?.id || '').trim().toLowerCase() === normalizedId);
    if (idx < 0) {
      return false;
    }

    items.splice(idx, 1);
    return true;
  }

  private takeInventoryItemById(items: InventoryItem[], itemId: string): InventoryItem | null {
    const normalizedId = String(itemId || '').trim().toLowerCase();
    if (!normalizedId) {
      return null;
    }

    const idx = items.findIndex((item) => String(item?.id || '').trim().toLowerCase() === normalizedId);
    if (idx < 0) {
      return null;
    }

    const [removed] = items.splice(idx, 1);
    return removed ? this.sanitizeInventoryItem({ ...removed, equipped: false }) : null;
  }

  private storeAvailableUsersCache(users: User[]): User[] {
    this.availableUsersCache = users.map((user) => ({
      ...user,
      inventory: Array.isArray(user.inventory) ? user.inventory.slice() : [],
    }));
    this.availableUsersCacheAt = Date.now();
    return this.availableUsersCache.map((user) => ({
      ...user,
      inventory: Array.isArray(user.inventory) ? user.inventory.slice() : [],
    }));
  }

  /**
   * Get all users except current user
   */
  async getAvailableUsers(): Promise<User[]> {
    if (this.isAvailableUsersCacheFresh()) {
      return this.storeAvailableUsersCache(this.availableUsersCache);
    }

    if (this.availableUsersRequest) {
      return this.availableUsersRequest;
    }

    this.availableUsersRequest = this.fetchAvailableUsers();
    try {
      return await this.availableUsersRequest;
    } finally {
      this.availableUsersRequest = null;
    }
  }

  private async fetchAvailableUsers(): Promise<User[]> {
    try {
      const currentEmail = this.authService.getCurrent()?.email || '';
      const currentEmailLower = currentEmail.toLowerCase();

      const normalizeUsers = (users: User[]): User[] => {
        const seen = new Set<string>();
        return users
          .filter((user) => !!user?.email)
          .filter((user) => String(user.role || 'Player') === 'Player')
          .map((user) => ({
            ...user,
            email: String(user.email || '').trim().toLowerCase(),
            displayName:
              String(user.displayName || user.username || user.email.split('@')[0] || 'Player').trim(),
            inventory: Array.isArray(user.inventory) ? user.inventory.slice() : [],
          }))
          .filter((user) => user.email && user.email !== currentEmailLower)
          .filter((user) => {
            if (seen.has(user.email)) return false;
            seen.add(user.email);
            return true;
          })
          .sort((a, b) => a.displayName!.localeCompare(b.displayName || '', undefined, { sensitivity: 'base' }));
      };

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();

      if (firestore) {
        try {
          const { collection, getDocs, query, where } = await import('firebase/firestore');
          const usersRef = collection(firestore, 'users');
          const playersQuery = query(usersRef, where('role', '==', 'Player'));
          const snapshot = await getDocs(playersQuery);

          const remoteUsers = snapshot.docs.map((doc) => {
            const data = doc.data() as Partial<User>;
            const email = String(data.email || doc.id || '').trim().toLowerCase();

            return {
              email,
              password: '',
              role: 'Player' as const,
              username: String(data.username || '').trim(),
              displayName: String(data.displayName || data.username || email.split('@')[0] || 'Player').trim(),
              photoURL: String(data.photoURL || ''),
              bio: String(data.bio || ''),
              gold: Number.isFinite(Number(data.gold)) ? Number(data.gold) : 0,
              totalGoldCollected: Number.isFinite(Number(data.totalGoldCollected))
                ? Number(data.totalGoldCollected)
                : 0,
              inventory: Array.isArray(data.inventory) ? data.inventory.slice() : [],
            } satisfies User;
          });

          return this.storeAvailableUsersCache(normalizeUsers(remoteUsers));
        } catch (queryError) {
          console.warn('Falling back to cached player list for trading users', queryError);
        }
      }

      const remoteUsers = this.authService.getLeaderboardUsers();
      return this.storeAvailableUsersCache(normalizeUsers(
        remoteUsers.map((user) => ({
          email: user.email,
          password: '',
          role: (user.role === 'Admin' ? 'Admin' : 'Player'),
          displayName: user.displayName,
          photoURL: user.photoURL || '',
          inventory: Array.isArray(user.inventory) ? user.inventory.slice() : [],
          gold: Number.isFinite(Number(user.gold)) ? Number(user.gold) : 0,
          totalGoldCollected: Number.isFinite(Number(user.totalGoldCollected))
            ? Number(user.totalGoldCollected)
            : 0,
        })),
      ));
    } catch (error) {
      console.error('Error fetching available users:', error);
      return [];
    }
  }

  getCachedAvailableUsers(): User[] {
    if (this.availableUsersCache.length > 0) {
      return this.storeAvailableUsersCache(this.availableUsersCache);
    }

    const currentEmail = String(this.authService.getCurrent()?.email || '').trim().toLowerCase();
    return this.authService
      .getLeaderboardUsers()
      .filter((user) => String(user.email || '').trim().toLowerCase() !== currentEmail)
      .map((user) => ({
        email: String(user.email || '').trim().toLowerCase(),
        password: '',
        role: (user.role === 'Admin' ? 'Admin' : 'Player'),
        displayName: String(user.displayName || user.email.split('@')[0] || 'Player').trim(),
        photoURL: String(user.photoURL || ''),
        gold: Number.isFinite(Number(user.gold)) ? Number(user.gold) : 0,
        totalGoldCollected: Number.isFinite(Number(user.totalGoldCollected))
          ? Number(user.totalGoldCollected)
          : 0,
        inventory: Array.isArray(user.inventory) ? user.inventory.slice() : [],
      }));
  }

  primeAvailableUsers(): void {
    if (this.isAvailableUsersCacheFresh() || this.availableUsersRequest) {
      return;
    }

    this.getAvailableUsers().catch((error) => {
      console.warn('Trading player prefetch failed', error);
    });
  }

  /**
   * Send a trade offer
   */
  async sendTradeOffer(offer: TradeOffer): Promise<string> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('send-auth-check-failed');
        throw this.getTradingAuthError();
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);
      const normalizedOffer = this.normalizeTradeOffer(offer);

      const offerData = {
        ...normalizedOffer,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      const docRef = await addDoc(tradesRef, offerData);
      return docRef.id;
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('send-permission-denied');
        const permissionError = this.getTradingPermissionError();
        console.error('Error sending trade offer:', permissionError);
        throw permissionError;
      }

      console.error('Error sending trade offer:', error);
      throw error;
    }
  }

  /**
   * Get pending trade offers for current user (received)
   */
  async getReceivedOffers(): Promise<TradeOffer[]> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('received-auth-check-failed');
        return [];
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) return [];

      const currentEmail = this.normalizeEmail(this.authService.getCurrent()?.email);
      if (!currentEmail) return [];

      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);
      const q = query(
        tradesRef,
        where('receiverEmail', '==', currentEmail),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return this.sortTradesByCreatedAtDesc(
        snapshot.docs.map((doc) => this.normalizeTradeOffer({ id: doc.id, ...doc.data() } as TradeOffer)),
      );
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('received-permission-denied');
        console.error('Error fetching received offers:', this.getTradingPermissionError());
        return [];
      }

      console.error('Error fetching received offers:', error);
      return [];
    }
  }

  /**
   * Get sent trade offers for current user
   */
  async getSentOffers(): Promise<TradeOffer[]> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('sent-auth-check-failed');
        return [];
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) return [];

      const currentEmail = this.normalizeEmail(this.authService.getCurrent()?.email);
      if (!currentEmail) return [];

      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);
      const q = query(
        tradesRef,
        where('senderEmail', '==', currentEmail)
      );

      const snapshot = await getDocs(q);
      return this.sortTradesByCreatedAtDesc(
        snapshot.docs
          .map((doc) => this.normalizeTradeOffer({ id: doc.id, ...doc.data() } as TradeOffer))
          .filter((offer) => offer.status === 'pending'),
      );
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('sent-permission-denied');
        console.error('Error fetching sent offers:', this.getTradingPermissionError());
        return [];
      }

      console.error('Error fetching sent offers:', error);
      return [];
    }
  }

  /**
   * Accept a trade offer and exchange items
   */
  async acceptTradeOffer(tradeId: string): Promise<boolean> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('accept-auth-check-failed');
        throw this.getTradingAuthError();
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { doc, getDoc, updateDoc, writeBatch } = await import('firebase/firestore');

      // Get the trade offer
      const tradeRef = doc(firestore, this.tradeCollectionName, tradeId);
      const tradeSnap = await getDoc(tradeRef);

      if (!tradeSnap.exists()) {
        throw new Error('Trade offer not found');
      }

      const trade = this.normalizeTradeOffer(tradeSnap.data() as TradeOffer);

      // Get both users
      const senderRef = doc(firestore, 'users', trade.senderEmail);
      const receiverRef = doc(firestore, 'users', trade.receiverEmail);

      const senderSnap = await getDoc(senderRef);
      const receiverSnap = await getDoc(receiverRef);

      if (!senderSnap.exists() || !receiverSnap.exists()) {
        throw new Error('One or both users not found');
      }

      const senderData = senderSnap.data() as any;
      const receiverData = receiverSnap.data() as any;

      // Update inventories
      const senderInventory = Array.isArray(senderData.inventory) ? [...senderData.inventory] : [];
      const receiverInventory = Array.isArray(receiverData.inventory) ? [...receiverData.inventory] : [];

      // Move offered items from sender to receiver
      trade.itemsOffered.forEach((item) => {
        const transferredItem = this.takeInventoryItemById(senderInventory, item.id);
        if (transferredItem) {
          receiverInventory.push(transferredItem);
        }
      });

      // Move requested items from receiver to sender
      trade.itemsRequested.forEach((item) => {
        const transferredItem = this.takeInventoryItemById(receiverInventory, item.id);
        if (transferredItem) {
          senderInventory.push(transferredItem);
        }
      });

      // Use batch write for atomicity
      const batch = writeBatch(firestore);
      batch.update(senderRef, { inventory: senderInventory });
      batch.update(receiverRef, { inventory: receiverInventory });
      batch.update(tradeRef, { status: 'completed', completedAt: Date.now() });

      await batch.commit();

      this.authService.applyInventorySnapshot(trade.senderEmail, senderInventory);
      this.authService.applyInventorySnapshot(trade.receiverEmail, receiverInventory);

      return true;
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('accept-permission-denied');
        const permissionError = this.getTradingPermissionError();
        console.error('Error accepting trade offer:', permissionError);
        throw permissionError;
      }

      console.error('Error accepting trade offer:', error);
      throw error;
    }
  }

  /**
   * Decline a trade offer
   */
  async declineTradeOffer(tradeId: string): Promise<boolean> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('decline-auth-check-failed');
        throw this.getTradingAuthError();
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { doc, updateDoc } = await import('firebase/firestore');
      const tradeRef = doc(firestore, this.tradeCollectionName, tradeId);
      await updateDoc(tradeRef, { status: 'declined', declinedAt: Date.now() });

      return true;
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('decline-permission-denied');
        const permissionError = this.getTradingPermissionError();
        console.error('Error declining trade offer:', permissionError);
        throw permissionError;
      }

      console.error('Error declining trade offer:', error);
      throw error;
    }
  }

  /**
   * Cancel a sent trade offer
   */
  async cancelTradeOffer(tradeId: string): Promise<boolean> {
    try {
      if (!(await this.hasFirestoreTradeAccess())) {
        this.logTradeAccessDiagnostics('cancel-auth-check-failed');
        throw this.getTradingAuthError();
      }

      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { doc, updateDoc } = await import('firebase/firestore');
      const tradeRef = doc(firestore, this.tradeCollectionName, tradeId);
      await updateDoc(tradeRef, { status: 'declined', cancelledAt: Date.now() });

      return true;
    } catch (error) {
      if (this.isPermissionDeniedError(error)) {
        this.logTradeAccessDiagnostics('cancel-permission-denied');
        const permissionError = this.getTradingPermissionError();
        console.error('Error cancelling trade offer:', permissionError);
        throw permissionError;
      }

      console.error('Error cancelling trade offer:', error);
      throw error;
    }
  }

  /**
   * Subscribe to received trade offers in real-time
   */
  subscribeToReceivedOffers(callback: (offers: TradeOffer[]) => void): (() => void) | null {
    try {
      let unsubscribeSnapshot: (() => void) | null = null;

      // Use async IIFE to handle dynamic imports
      (async () => {
        const hasAccess = await this.hasFirestoreTradeAccess();
        if (!hasAccess) {
          this.logTradeAccessDiagnostics('subscription-auth-check-failed');
          callback([]);
          return;
        }

        const firestore = getFirestoreInstance();
        if (!firestore) {
          callback([]);
          return;
        }

        const currentEmail = this.normalizeEmail(this.authService.getCurrent()?.email);
        if (!currentEmail) {
          callback([]);
          return;
        }

        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        const tradesRef = collection(firestore, this.tradeCollectionName);
        const q = query(
          tradesRef,
          where('receiverEmail', '==', currentEmail),
          where('status', '==', 'pending')
        );

        unsubscribeSnapshot = onSnapshot(
          q,
          (snapshot: any) => {
            const offers = this.sortTradesByCreatedAtDesc(
              snapshot.docs.map((doc: any) =>
                this.normalizeTradeOffer({ id: doc.id, ...doc.data() } as TradeOffer),
              ),
            );
            callback(offers);
          },
          (error: unknown) => {
            if (this.isPermissionDeniedError(error)) {
              this.logTradeAccessDiagnostics('subscription-permission-denied');
              console.error('Error subscribing to received offers:', this.getTradingPermissionError());
              callback([]);
              return;
            }

            console.error('Error subscribing to received offers:', error);
            callback([]);
          },
        );
      })().catch((error) => {
        if (this.isPermissionDeniedError(error)) {
          this.logTradeAccessDiagnostics('subscription-setup-permission-denied');
          console.error('Error subscribing to received offers:', this.getTradingPermissionError());
          callback([]);
          return;
        }

        console.error('Error subscribing to received offers:', error);
        callback([]);
      });

      return () => {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      };
    } catch (error) {
      console.error('Error setting up received offers subscription:', error);
      return null;
    }
  }

  subscribeToSentOffers(callback: (offers: TradeOffer[]) => void): (() => void) | null {
    try {
      let unsubscribeSnapshot: (() => void) | null = null;

      (async () => {
        const hasAccess = await this.hasFirestoreTradeAccess();
        if (!hasAccess) {
          callback([]);
          return;
        }

        const firestore = getFirestoreInstance();
        if (!firestore) {
          callback([]);
          return;
        }

        const currentEmail = this.normalizeEmail(this.authService.getCurrent()?.email);
        if (!currentEmail) {
          callback([]);
          return;
        }

        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        const tradesRef = collection(firestore, this.tradeCollectionName);
        const q = query(
          tradesRef,
          where('senderEmail', '==', currentEmail),
        );

        unsubscribeSnapshot = onSnapshot(
          q,
          (snapshot: any) => {
            const offers = this.sortTradesByCreatedAtDesc(
              snapshot.docs
                .map((doc: any) => this.normalizeTradeOffer({ id: doc.id, ...doc.data() } as TradeOffer))
                .filter((offer: TradeOffer) => offer.status === 'pending'),
            );
            callback(offers);
          },
          (error: unknown) => {
            if (this.isPermissionDeniedError(error)) {
              console.error('Error subscribing to sent offers:', this.getTradingPermissionError());
              callback([]);
              return;
            }

            console.error('Error subscribing to sent offers:', error);
            callback([]);
          },
        );
      })().catch((error) => {
        if (this.isPermissionDeniedError(error)) {
          console.error('Error subscribing to sent offers:', this.getTradingPermissionError());
          callback([]);
          return;
        }

        console.error('Error subscribing to sent offers:', error);
        callback([]);
      });

      return () => {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      };
    } catch (error) {
      console.error('Error setting up sent offers subscription:', error);
      return null;
    }
  }
}
