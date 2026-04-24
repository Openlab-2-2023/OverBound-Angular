import { Injectable } from '@angular/core';
import { isFirebaseEnabled, initFirebaseIfNeeded, getAuthInstance, saveUserToFirestore, fetchUserFromFirestore, fetchAllUsersFromFirestore, subscribeAllUsersFromFirestore, authCreateUser, authSignIn, authSignOut, authUpdatePassword, authUpdateUserProfile, diagnoseFirestoreUserCollections, authSendPasswordResetEmail, authVerifyPasswordResetCode, authConfirmPasswordReset, authFetchSignInMethodsForEmail } from './firebase.init';
import { getStoreItemById } from '../store/store-catalog';

export type Role = 'Admin' | 'Player';
export interface User {
  username?: string;
  email: string;
  password: string;
  role: Role;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  gold?: number;
  totalGoldCollected?: number;
  inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }>;
}
export interface StoreItemInput {
  id: string;
  name: string;
  icon: string;
  cost: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageUsersKey = 'ob_users_v1';
  private storageCurrentKey = 'ob_current_user_v1';
  private users: User[] = [];
  private current: User | null = null;
  private adminEmails: string[] = ['sebokubinec7@gmail.com', 'bojkosam@gmail.com'];
  private readonly authRequestTimeoutMs = 9000;

  constructor() {
    const raw = localStorage.getItem(this.storageUsersKey);
    if (raw) {
      try { this.users = JSON.parse(raw); } catch { this.users = []; }
    }

    
    this.users = this.users.map((u: any) => {
      if (!u.email && u.username) { return { email: u.username, password: u.password, role: u.role || 'Player' }; }
      return u as User;
    });

    // ensure default admin accounts exist (use email addresses)
    const ensureAdmin = (email: string) => {
      if (!this.users.find(u => u.email === email)) {
        this.users.push({ email, password: 'Admin', role: 'Admin' });
      }
    };
    ensureAdmin(this.adminEmails[0]);
    ensureAdmin(this.adminEmails[1]);

    // normalize roles: if a user email is in adminEmails, mark role 'admin'
    this.users = this.users.map(u => ({ ...u, role: this.adminEmails.includes(u.email) ? 'Admin' : (u.role || 'Player') }));

    this.saveUsers();

    const cur = localStorage.getItem(this.storageCurrentKey);
    if (cur) {
      try { this.current = JSON.parse(cur); } catch { this.current = null; }
    }

    // If Firebase Auth is enabled, initialize SDK and listen for auth state changes
    (async () => {
      if (!isFirebaseEnabled()) return;  
      try {
        await initFirebaseIfNeeded();
        const auth = getAuthInstance();
        if (!auth) return;
        const { onAuthStateChanged } = await import('firebase/auth');
        onAuthStateChanged(auth, async (fbUser: any) => {
          if (fbUser && fbUser.email) {
            const email = (fbUser.email || '').toLowerCase();
            try {
              const remote = await fetchUserFromFirestore(email);
              const local = this.users.find(u => u.email === email) || { email } as User;
              const merged = { ...local, email, displayName: fbUser.displayName || local.displayName || '', photoURL: fbUser.photoURL || local.photoURL || '', role: this.adminEmails.includes(email) ? 'Admin' : (local.role || 'Player'), ...(remote || {}) } as User;
              const idx = this.users.findIndex(u => u.email === email);
              if (idx >= 0) this.users[idx] = merged; else this.users.push(merged);
              this.current = merged;
              this.saveUsers();
              this.saveCurrent();
            } catch (e) {
              // ignore fetch errors
            }
          } else {
            this.current = null;
            this.saveCurrent();
          }
        });
      } catch (e) {
        // ignore init errors
      }
    })();
  }

  private saveUsers() { localStorage.setItem(this.storageUsersKey, JSON.stringify(this.users)); }
  private saveCurrent() {
    if (this.current) localStorage.setItem(this.storageCurrentKey, JSON.stringify(this.current));
    else localStorage.removeItem(this.storageCurrentKey);
  }

  private clearCurrentSession() {
    this.current = null;
    this.saveCurrent();
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ]);
  }

  private getAuthErrorMessage(error: any, fallback: string): string {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    
    // Handle Firebase error codes
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please check and try again.';
      case 'auth/invalid-email':
      case 'auth/invalid-email-verified':
        return 'Invalid email format. Please enter a valid email address.';
      case 'auth/email-already-in-use':
        return 'Email already registered. Try logging in or use a different email.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters with a mix of letters and numbers.';
      case 'auth/missing-password':
        return 'Password is required.';
      case 'auth/missing-email':
        return 'Email is required.';
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'Reset code is invalid or expired. Please request a new password reset.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please wait a few minutes before trying again.';
      case 'auth/account-exists-with-different-credential':
        return 'This email is already registered. Try logging in instead.';
      case 'auth/operation-not-allowed':
        return 'This operation is not allowed. Please contact support.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/network-request-failed':
      case 'NETWORK_ERROR':
        return 'Network connection error. Please check your internet and try again.';
      default:
        // Handle timeout messages
        if (message.includes('timed out') || message.includes('timeout')) {
          return 'Request took too long. Please check your connection and try again.';
        }
        // Handle network-related messages
        if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
          return 'Network connection error. Please check your internet and try again.';
        }
        return fallback;
    }
  }

  /**
   * Validates email format
   */
  private isValidEmail(email: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  /**
   * Validates password strength
   * @returns {ok: boolean, message?: string}
   */
  private validatePassword(password: string): { ok: boolean; message?: string } {
    if (!password) return { ok: false, message: 'Password is required.' };
    if (password.length < 6) return { ok: false, message: 'Password must be at least 6 characters.' };
    if (!/[a-z]/.test(password) && !/[A-Z]/.test(password)) {
      return { ok: false, message: 'Password must contain at least one letter.' };
    }
    if (!/[0-9]/.test(password) && !/[!@#$%^&*]/.test(password)) {
      return { ok: false, message: 'Password must contain at least one number or special character.' };
    }
    return { ok: true };
  }
  
  // SDK-based Firebase helpers are used from firebase.init.ts
  //register
  async register(email: string, password: string, username?: string): Promise<{ ok: boolean; message?: string }> {
    email = email.trim().toLowerCase();
    username = String(username || '').trim();
    
    // Validation
    if (!email || !password) return { ok: false, message: 'Email and password are required.' };
    if (!this.isValidEmail(email)) return { ok: false, message: 'Invalid email format.' };
    if (!username) return { ok: false, message: 'Username is required.' };
    if (username.length < 3) return { ok: false, message: 'Username must be at least 3 characters.' };
    
    // Validate password strength
    const pwdValidation = this.validatePassword(password);
    if (!pwdValidation.ok) return pwdValidation;
    
    if (this.users.find(u => u.email === email)) return { ok: false, message: 'Email already registered. Try logging in or use a different email.' };
    
    // if email matches admin defaults, promote to admin
    const role: Role = this.adminEmails.includes(email) ? 'Admin' : 'Player';
    const safeUsername = username;
    const user: User = {
      username: safeUsername,
      email,
      password,
      role,
      displayName: safeUsername,
      photoURL: '',
      bio: 'New adventurer in OverBound.',
      gold: 0,
      totalGoldCollected: 0,
      inventory: [],
    };
    
    // If Firebase Auth is enabled, create the auth user first
    if (isFirebaseEnabled()) {
      try {
        const methods = await this.withTimeout(
          authFetchSignInMethodsForEmail(email),
          this.authRequestTimeoutMs,
          'Registration check timed out.',
        );
        if (Array.isArray(methods) && methods.length > 0) {
          return { ok: false, message: 'This email is already registered. Try logging in instead.' };
        }
        await this.withTimeout(
          authCreateUser(email, password),
          this.authRequestTimeoutMs,
          'Registration request timed out.',
        );
        await this.withTimeout(
          authUpdateUserProfile({ displayName: safeUsername }),
          this.authRequestTimeoutMs,
          'Profile setup timed out.',
        );
      } catch (e: any) {
        return { ok: false, message: this.getAuthErrorMessage(e, 'Registration failed.') };
      }
    }
    
    this.users.push(user);
    this.saveUsers();
    this.current = { ...user };
    this.saveCurrent();
    
    if (isFirebaseEnabled()) {
      try {
        await saveUserToFirestore(user);
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Failed to create Firestore user profile.' };
      }
    }
    return { ok: true };
  }
//login ked uz si bol raz prihlaseny a chces sa prihlasit znova, tak sa ti to podari len ak zadavas spravne heslo, inak ti to napise ze neplatne udaje
  async login(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    email = email.trim().toLowerCase();
    password = String(password || '');
    if (!email) return { ok: false, message: 'Email is required.' };
    if (!this.isValidEmail(email)) return { ok: false, message: 'Please enter a valid email address.' };
    if (!password) return { ok: false, message: 'Password is required.' };

    // If Firebase Auth is enabled, use it for sign in
    if (isFirebaseEnabled()) {
      // Reset any stale Firebase session first so a previous user cannot remain logged in
      // after a failed login attempt with new credentials.
      try { await authSignOut(); } catch { /* ignore */ }
      this.clearCurrentSession();

      // sign in once and get credential+user
      let fbUser: any = null;
      try {
        const cred = await this.withTimeout(
          authSignIn(email, password),
          this.authRequestTimeoutMs,
          'Login request timed out.',
        );
        fbUser = cred && (cred as any).user ? (cred as any).user : null;
      } catch (e: any) {
        const code = String(e?.code || '');
        const message = String(e?.message || '');

        // Never keep an existing session alive after a failed login attempt.
        try { await authSignOut(); } catch { /* ignore */ }
        this.clearCurrentSession();

        // Only allow local fallback for transient connectivity issues. Invalid credentials
        // must never succeed via a secondary path.
        const isTransientFailure =
          code === 'auth/network-request-failed' ||
          code === 'NETWORK_ERROR' ||
          message.includes('timed out') ||
          message.includes('timeout') ||
          message.includes('NetworkError') ||
          message.includes('Failed to fetch');

        if (isTransientFailure) {
          const localUser = this.users.find(x => x.email === email && x.password === password);
          if (localUser) {
            const localRole: Role = this.adminEmails.includes(localUser.email) ? 'Admin' : (localUser.role || 'Player');
            this.current = { ...localUser, role: localRole };
            this.saveCurrent();
            return { ok: true };
          }
        }

        return { ok: false, message: this.getAuthErrorMessage(e, 'Invalid email or password.') };
      }

      try {
        const remote = await this.withTimeout(
          fetchUserFromFirestore(email),
          this.authRequestTimeoutMs,
          'Profile load timed out.',
        );
        if (remote) {
          const merged = { ...(this.users.find(u => u.email === email) || {} as User), ...remote } as User;
          merged.role = this.adminEmails.includes(merged.email) ? 'Admin' : (merged.role || 'Player');
          if (merged.totalGoldCollected === undefined) merged.totalGoldCollected = 0;
          const idx = this.users.findIndex(x => x.email === merged.email);
          if (idx >= 0) this.users[idx] = merged; else this.users.push(merged);
          this.saveUsers();
          this.current = merged;
          this.saveCurrent();
        } else {
          const local = this.users.find(u => u.email === email) || {} as User;
          const username = local.username || email.split('@')[0];
          const merged: User = {
            username,
            email,
            password: local.password || '',
            role: this.adminEmails.includes(email) ? 'Admin' : (local.role || 'Player'),
            displayName: fbUser?.displayName || local.displayName || '',
            photoURL: fbUser?.photoURL || local.photoURL || '',
            bio: local.bio || '',
            gold: (local.gold != null) ? local.gold : 0,
            totalGoldCollected: (local.totalGoldCollected != null) ? local.totalGoldCollected : 0,
            inventory: Array.isArray(local.inventory) ? local.inventory.slice() : [],
          } as User;
          const idx = this.users.findIndex(x => x.email === merged.email);
          if (idx >= 0) this.users[idx] = merged; else this.users.push(merged);
          this.saveUsers();
          this.current = merged;
          this.saveCurrent();
          // persist initial profile to Firestore
          try { await saveUserToFirestore(merged); } catch { /* ignore */ }
        }
      } catch { /* ignore fetch errors after successful auth */ }
      return { ok: true };
    }

    // fallback to local auth when Firebase not enabled
    const u = this.users.find(x => x.email === email && x.password === password);
    if (!u) {
      this.clearCurrentSession();
      const emailExists = this.users.some(x => x.email === email);
      if (emailExists) {
        return { ok: false, message: 'Incorrect password. Please try again or use "Forgot Password" to reset it.' };
      } else {
        return { ok: false, message: 'No account found with this email. Please register first or check the email address.' };
      }
    }
    const role: Role = this.adminEmails.includes(u.email) ? 'Admin' : (u.role || 'Player');
    this.current = { ...u, role };
    this.saveCurrent();
    if (isFirebaseEnabled()) {
      fetchUserFromFirestore(email).then(remote => {
        if (remote) {
          const merged = { ...this.current!, ...remote } as User;
          this.current = merged;
          const idx = this.users.findIndex(x => x.email === merged.email);
          if (idx >= 0) this.users[idx] = merged;
          this.saveUsers();
          this.saveCurrent();
        }
      }).catch(() => {});
    }
    return { ok: true };
  }

  async forgotPassword(email: string): Promise<{ ok: boolean; message?: string }> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return { ok: false, message: 'Email is required.' };
    if (!isFirebaseEnabled()) return { ok: false, message: 'Password reset is only available with Firebase Auth enabled.' };
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://overbound-angular.web.app';
      await authSendPasswordResetEmail(normalized, {
        url: `${baseUrl}/login?mode=resetPassword`,
        handleCodeInApp: false,
      });
      return { ok: true, message: 'Password reset email sent. Click the link in the email to open the reset page directly.' };
    } catch (e: any) {
      const code = String(e?.code || '');
      if (code === 'auth/user-not-found') {
        let existsInFirestore = false;
        try {
          const remote = await fetchUserFromFirestore(normalized);
          existsInFirestore = !!remote;
        } catch {
          existsInFirestore = false;
        }
        if (existsInFirestore) {
          return {
            ok: false,
            message:
              'This email exists in Firestore, but not in Firebase Authentication. Password reset emails can only be sent to Firebase Auth accounts.',
          };
        }
      }
      return { ok: false, message: this.getAuthErrorMessage(e, 'Failed to send password reset email.') };
    }
  }

  async verifyResetCode(code: string): Promise<{ ok: boolean; email?: string; message?: string }> {
    const normalized = String(code || '').trim();
    if (!normalized) return { ok: false, message: 'Reset code is required.' };
    if (!isFirebaseEnabled()) return { ok: false, message: 'Password reset is only available with Firebase Auth enabled.' };
    try {
      const email = await this.withTimeout(
        authVerifyPasswordResetCode(normalized),
        8000,
        'Reset verification timed out.',
      );
      return { ok: true, email };
    } catch (e: any) {
      return { ok: false, message: this.getAuthErrorMessage(e, 'Reset code is invalid or expired.') };
    }
  }

  async resetPassword(code: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return { ok: false, message: 'Reset code is required.' };
    if (!newPassword) return { ok: false, message: 'New password is required.' };
    if (!isFirebaseEnabled()) return { ok: false, message: 'Password reset is only available with Firebase Auth enabled.' };
    try {
      const email = await this.withTimeout(
        authVerifyPasswordResetCode(normalizedCode),
        8000,
        'Reset verification timed out.',
      );
      await this.withTimeout(
        authConfirmPasswordReset(normalizedCode, newPassword),
        10000,
        'Password reset timed out.',
      );
      const localIdx = this.users.findIndex(u => u.email === email.toLowerCase());
      if (localIdx >= 0) {
        this.users[localIdx].password = newPassword;
        this.saveUsers();
      }
      if (this.current?.email === email.toLowerCase()) {
        this.current = { ...this.current, password: newPassword };
        this.saveCurrent();
      }
      return { ok: true, message: 'Password reset successful. You can log in with your new password now.' };
    } catch (e: any) {
      return { ok: false, message: this.getAuthErrorMessage(e, 'Failed to reset password.') };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.current) return { ok: false, message: 'Not logged in' };
    const email = this.current.email;
    if (isFirebaseEnabled()) {
      try {
        await authUpdatePassword(email, currentPassword, newPassword);
      } catch (e: any) {
        return { ok: false, message: this.getAuthErrorMessage(e, 'Password update failed') };
      }
      // update local store and Firestore
      const idx = this.users.findIndex(u => u.email === email);
      if (idx >= 0) this.users[idx].password = newPassword;
      this.current.password = newPassword;
      this.saveUsers();
      this.saveCurrent();
      if (isFirebaseEnabled()) saveUserToFirestore(this.current!).catch(() => {});
      return { ok: true };
    }

    // fallback to local-only behavior
    if (this.current.password !== currentPassword) return { ok: false, message: 'Current password is incorrect' };
    const idx = this.users.findIndex(u => u.email === this.current!.email);
    if (idx >= 0) this.users[idx].password = newPassword;
    this.current.password = newPassword;
    this.saveUsers();
    this.saveCurrent();
    if (isFirebaseEnabled()) saveUserToFirestore(this.current!).catch(() => {});
    return { ok: true };
  }

  async updateProfile(
    updates: Partial<User>,
    options?: { waitForCloud?: boolean; cloudTimeoutMs?: number },
  ): Promise<{ ok: boolean; message?: string }> {
    if (!this.current) return { ok: false, message: 'Not logged in' };
    const email = this.current.email;
    this.current = { ...this.current, ...updates } as User;
    const idx = this.users.findIndex(u => u.email === this.current!.email);
    if (idx >= 0) this.users[idx] = { ...this.users[idx], ...updates } as User;
    this.saveUsers();
    this.saveCurrent();
    // dispatch a DOM event so UI components can react to updated profile
    try { window.dispatchEvent(new CustomEvent('ob:user-updated', { detail: this.getCurrent() })); } catch {}
    // Keep UI snappy: sync to Firebase in background instead of blocking user flow.
    if (isFirebaseEnabled()) {
      if (options?.waitForCloud) {
        const timeoutMs = Math.max(1000, options.cloudTimeoutMs ?? 4500);
        const syncPromise = this.syncProfileToFirebase(email, updates);
        try {
          await Promise.race([
            syncPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Cloud sync timeout')), timeoutMs),
            ),
          ]);
        } catch (e: any) {
          // If cloud is just slow, keep syncing in background and don't block UX.
          if (String(e?.message || '').includes('Cloud sync timeout')) {
            syncPromise.catch((err) => console.warn('Background profile sync failed', err));
            return { ok: true, message: 'Saved locally. Cloud sync is still running.' };
          }
          return { ok: false, message: e?.message || 'Failed to sync profile to Firebase' };
        }
      } else {
        this.syncProfileToFirebase(email, updates).catch((e) => {
          console.warn('Background profile sync failed', e);
        });
      }
    }
    return { ok: true };
  }

  async buyStoreItem(item: StoreItemInput): Promise<{ ok: boolean; message?: string }> {
    if (!this.current) return { ok: false, message: 'Please log in first.' };
    const cost = Number.isFinite(Number(item?.cost)) ? Number(item.cost) : 0;
    if (!item?.id || !item?.name || !item?.icon || cost <= 0) {
      return { ok: false, message: 'Invalid store item.' };
    }

    const inventory = Array.isArray(this.current.inventory) ? this.current.inventory.slice() : [];
    if (inventory.some((it) => it.id === item.id)) {
      return { ok: false, message: 'You already own this item.' };
    }

    const currentGold = Number.isFinite(Number(this.current.gold)) ? Number(this.current.gold) : 0;
    if (currentGold < cost) {
      return { ok: false, message: 'Not enough gold.' };
    }

    const updatedInventory = [
      ...inventory,
      { id: item.id, name: item.name, icon: item.icon, equipped: false, cost: item.cost },
    ];
    const updatedGold = currentGold - cost;
    const res = await this.updateProfile(
      { inventory: updatedInventory, gold: updatedGold },
      { waitForCloud: true, cloudTimeoutMs: 10000 },
    );
    if (!res.ok) return res;
    return { ok: true, message: `${item.name} purchased.` };
  }

  getInventorySellValue(itemId: string, fallbackName?: string, fallbackCost?: number): number {
    const directCost = Number.isFinite(Number(fallbackCost)) ? Number(fallbackCost) : 0;
    if (directCost > 0) return Math.floor(directCost * 0.8);
    const storeItem = getStoreItemById(itemId);
    if (storeItem) return Math.floor(Number(storeItem.cost) * 0.8);
    if (fallbackName) {
      const byName = [
        'hat_wanderer',
        'cloak_ember',
        'blade_pixel',
        'pet_slime',
      ]
        .map((id) => getStoreItemById(id))
        .find((it) => String(it?.name || '').toLowerCase() === String(fallbackName).toLowerCase());
      if (byName) return Math.floor(Number(byName.cost) * 0.8);
    }
    return 0;
  }

  async sellInventoryItem(itemId: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.current) return { ok: false, message: 'Please log in first.' };
    const id = String(itemId || '').trim();
    if (!id) return { ok: false, message: 'Invalid item.' };

    const inventory = Array.isArray(this.current.inventory) ? this.current.inventory.slice() : [];
    const itemIndex = inventory.findIndex((it) => it?.id === id);
    if (itemIndex < 0) return { ok: false, message: 'Item not found in inventory.' };

    const invItem = inventory[itemIndex];
    const sellValue = this.getInventorySellValue(id, invItem?.name, invItem?.cost);
    if (sellValue <= 0) return { ok: false, message: 'This item cannot be sold yet.' };

    const soldItemName = invItem?.name || 'Item';
    inventory.splice(itemIndex, 1);

    const currentGold = Number.isFinite(Number(this.current.gold)) ? Number(this.current.gold) : 0;
    const updatedGold = currentGold + sellValue;

    const res = await this.updateProfile({ inventory, gold: updatedGold });
    if (!res.ok) return res;
    return { ok: true, message: `${soldItemName} sold for ${sellValue} gold.` };
  }

  private async syncProfileToFirebase(email: string, updates: Partial<User>) {
    await saveUserToFirestore({ email, ...updates });
    const authUpdates: any = {};
    if (updates.displayName) authUpdates.displayName = updates.displayName;
    // Firebase Auth profile photoURL has strict limits; skip long/data URLs.
    if (
      updates.photoURL &&
      !updates.photoURL.startsWith('data:') &&
      updates.photoURL.length < 900
    ) {
      authUpdates.photoURL = updates.photoURL;
    }
    if (Object.keys(authUpdates).length > 0) {
      await authUpdateUserProfile(authUpdates);
    }
  }

  async logout() { 
    this.clearCurrentSession();
    if (isFirebaseEnabled()) {
      try { await authSignOut(); } catch { /* ignore */ }
    }
  }
  isLoggedIn(): boolean { return this.current !== null; }
  getCurrent(): User | null { return this.current ? { ...this.current } : null; }
  isAdmin(): boolean { return this.current?.role === 'Admin'; }


  getLeaderboardUsers(): Array<{ email: string; displayName: string; gold: number; totalGoldCollected: number; role: Role; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }> {
    const seen = new Set<string>();
    return this.users
      .filter((u) =>
        !!u.email &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email) &&
        (u.role || 'Player') === 'Player' &&
        !!u.password,
      )
      .filter((u) => {
        const key = u.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((u) => ({
        email: u.email,
        displayName: u.displayName || u.username || u.email.split('@')[0],
        gold: typeof u.gold === 'number' ? u.gold : 0,
        totalGoldCollected: typeof u.totalGoldCollected === 'number' ? u.totalGoldCollected : 0,
        role: u.role || 'Player',
        photoURL: u.photoURL || '',
        inventory: Array.isArray(u.inventory) ? u.inventory.slice() : [],
      }));
  }

  async getLeaderboardUsersFromDatabase(): Promise<Array<{ email: string; displayName: string; gold: number; totalGoldCollected: number; role: Role; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }>> {
    if (!isFirebaseEnabled()) return [];
    let remoteUsers: any[] = [];
    remoteUsers = await fetchAllUsersFromFirestore();
    const mapped = this.mapLeaderboardUsers(remoteUsers);
    return mapped;
  }

  async subscribeLeaderboardUsers(
    onUsers: (users: Array<{ email: string; displayName: string; gold: number; totalGoldCollected: number; role: Role; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }>) => void,
    onError?: (error: any) => void,
  ) {
    if (!isFirebaseEnabled()) {
      onUsers([]);
      return () => {};
    }
    const unsubscribe = await subscribeAllUsersFromFirestore(
      (remoteUsers: any[]) => {
        const mapped = this.mapLeaderboardUsers(remoteUsers);
        onUsers(mapped);
      },
      (err: any) => {
        if (onError) onError(err);
      },
    );
    return unsubscribe;
  }

  async waitForFirebaseAuthReady(timeoutMs: number = 5000): Promise<void> {
    if (!isFirebaseEnabled()) return;
    try {
      await initFirebaseIfNeeded();
      const auth = getAuthInstance();
      if (!auth) return;
      const { onAuthStateChanged } = await import('firebase/auth');
      await Promise.race([
        new Promise<void>((resolve) => {
          const unsub = onAuthStateChanged(auth, () => {
            try { unsub(); } catch { /* ignore */ }
            resolve();
          });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch {
      // non-blocking: if auth readiness fails, caller can still attempt reads
    }
  }

  async getLeaderboardDiagnostics(): Promise<string> {
    if (!isFirebaseEnabled()) return 'Firebase disabled';
    try {
      return await diagnoseFirestoreUserCollections();
    } catch (e: any) {
      return `Diagnostics failed: ${e?.message || 'unknown error'}`;
    }
  }

  private mapLeaderboardUsers(remoteUsers: any[]): Array<{ email: string; displayName: string; gold: number; totalGoldCollected: number; role: Role; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }> {
    const seen = new Set<string>();
    return remoteUsers
      .filter((u: any) => !!u && typeof u === 'object')
      .map((u: any) => {
        const rawDocId = String(u.__docId || '').trim();
        const rawEmail = String(u.email || '').trim();
        let id = rawEmail || rawDocId;
        if (!id) id = `user-${Math.random().toString(36).slice(2, 10)}`;
        try {
          id = decodeURIComponent(id);
        } catch { /* keep raw id */ }
        const emailLike = id.includes('@') ? id.toLowerCase() : id;
        const nameFromId = emailLike.includes('@') ? emailLike.split('@')[0] : emailLike;
        return {
          _id: emailLike,
          email: emailLike,
          displayName: String(u.displayName || u.username || nameFromId || 'Player'),
          gold: Number.isFinite(Number(u.gold)) ? Number(u.gold) : 0,
          totalGoldCollected: Number.isFinite(Number(u.totalGoldCollected)) ? Number(u.totalGoldCollected) : 0,
          role: (String(u.role || 'Player') === 'Admin' ? 'Admin' : 'Player') as Role,
          photoURL: String(u.photoURL || ''),
          inventory: Array.isArray(u.inventory) ? u.inventory.slice() : [],
        };
      })
      .filter((u) => {
        if (seen.has(u._id)) return false;
        seen.add(u._id);
        return true;
      })
      .map(({ _id, ...rest }) => rest);
  }

  async getUserProfileByEmail(email: string): Promise<Partial<User> | null> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !isFirebaseEnabled()) return null;
    const remote = await fetchUserFromFirestore(normalized);
    if (!remote) return null;
    return { email: normalized, ...(remote as any) };
  }

  async getLeaderboardUserByEmailFromDatabase(
    email: string,
  ): Promise<{
    email: string;
    displayName: string;
    gold: number;
    totalGoldCollected: number;
    role: Role;
    photoURL?: string;
    inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }>;
  } | null> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !isFirebaseEnabled()) return null;
    const users = await this.getLeaderboardUsersFromDatabase();
    return users.find((u) => String(u.email || '').toLowerCase() === normalized) || null;
  }
}
