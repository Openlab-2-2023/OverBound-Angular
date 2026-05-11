import { Injectable } from '@angular/core';
import { initFirebaseIfNeeded, getFirestoreInstance } from './firebase.init';
import { AuthService, User } from './auth.service';

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

  constructor(private authService: AuthService) {}

  private isAvailableUsersCacheFresh(): boolean {
    return this.availableUsersCache.length > 0 && Date.now() - this.availableUsersCacheAt < this.availableUsersCacheTtlMs;
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
      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);

      const offerData = {
        ...offer,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      const docRef = await addDoc(tradesRef, offerData);
      return docRef.id;
    } catch (error) {
      console.error('Error sending trade offer:', error);
      throw error;
    }
  }

  /**
   * Get pending trade offers for current user (received)
   */
  async getReceivedOffers(): Promise<TradeOffer[]> {
    try {
      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) return [];

      const currentEmail = this.authService.getCurrent()?.email || '';
      if (!currentEmail) return [];

      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);
      const q = query(
        tradesRef,
        where('receiverEmail', '==', currentEmail),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TradeOffer);
    } catch (error) {
      console.error('Error fetching received offers:', error);
      return [];
    }
  }

  /**
   * Get sent trade offers for current user
   */
  async getSentOffers(): Promise<TradeOffer[]> {
    try {
      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) return [];

      const currentEmail = this.authService.getCurrent()?.email || '';
      if (!currentEmail) return [];

      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const tradesRef = collection(firestore, this.tradeCollectionName);
      const q = query(
        tradesRef,
        where('senderEmail', '==', currentEmail),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TradeOffer);
    } catch (error) {
      console.error('Error fetching sent offers:', error);
      return [];
    }
  }

  /**
   * Accept a trade offer and exchange items
   */
  async acceptTradeOffer(tradeId: string): Promise<boolean> {
    try {
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

      const trade = tradeSnap.data() as TradeOffer;

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

      // Remove offered items from sender
      trade.itemsOffered.forEach((item) => {
        const idx = senderInventory.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          senderInventory.splice(idx, 1);
        }
      });

      // Add requested items to sender
      trade.itemsRequested.forEach((item) => {
        receiverInventory.splice(receiverInventory.findIndex((i) => i.id === item.id), 1);
        senderInventory.push(item);
      });

      // Remove requested items from receiver
      trade.itemsRequested.forEach((item) => {
        const idx = receiverInventory.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          receiverInventory.splice(idx, 1);
        }
      });

      // Add offered items to receiver
      trade.itemsOffered.forEach((item) => {
        receiverInventory.push(item);
      });

      // Use batch write for atomicity
      const batch = writeBatch(firestore);
      batch.update(senderRef, { inventory: senderInventory });
      batch.update(receiverRef, { inventory: receiverInventory });
      batch.update(tradeRef, { status: 'completed', completedAt: Date.now() });

      await batch.commit();

      // Update local auth service
      const currentUser = this.authService.getCurrent();
      if (currentUser?.email === trade.receiverEmail) {
        currentUser.inventory = receiverInventory;
      } else if (currentUser?.email === trade.senderEmail) {
        currentUser.inventory = senderInventory;
      }

      return true;
    } catch (error) {
      console.error('Error accepting trade offer:', error);
      throw error;
    }
  }

  /**
   * Decline a trade offer
   */
  async declineTradeOffer(tradeId: string): Promise<boolean> {
    try {
      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { doc, updateDoc } = await import('firebase/firestore');
      const tradeRef = doc(firestore, this.tradeCollectionName, tradeId);
      await updateDoc(tradeRef, { status: 'declined', declinedAt: Date.now() });

      return true;
    } catch (error) {
      console.error('Error declining trade offer:', error);
      throw error;
    }
  }

  /**
   * Cancel a sent trade offer
   */
  async cancelTradeOffer(tradeId: string): Promise<boolean> {
    try {
      await initFirebaseIfNeeded();
      const firestore = getFirestoreInstance();
      if (!firestore) throw new Error('Firestore not initialized');

      const { doc, updateDoc } = await import('firebase/firestore');
      const tradeRef = doc(firestore, this.tradeCollectionName, tradeId);
      await updateDoc(tradeRef, { status: 'declined', cancelledAt: Date.now() });

      return true;
    } catch (error) {
      console.error('Error cancelling trade offer:', error);
      throw error;
    }
  }

  /**
   * Subscribe to received trade offers in real-time
   */
  subscribeToReceivedOffers(callback: (offers: TradeOffer[]) => void): (() => void) | null {
    try {
      const firestore = getFirestoreInstance();
      if (!firestore) return null;

      const currentEmail = this.authService.getCurrent()?.email || '';
      if (!currentEmail) return null;

      // Use async IIFE to handle dynamic imports
      (async () => {
        const { collection, query, where, onSnapshot, orderBy } = await import('firebase/firestore');
        const tradesRef = collection(firestore, this.tradeCollectionName);
        const q = query(
          tradesRef,
          where('receiverEmail', '==', currentEmail),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );

        onSnapshot(q, (snapshot: any) => {
          const offers = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as TradeOffer);
          callback(offers);
        });
      })().catch((error) => {
        console.error('Error subscribing to received offers:', error);
      });

      return () => {
        // Unsubscribe handled by component cleanup
      };
    } catch (error) {
      console.error('Error setting up received offers subscription:', error);
      return null;
    }
  }
}
