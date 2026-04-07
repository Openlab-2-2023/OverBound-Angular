import { Injectable } from '@angular/core';
import { isFirebaseEnabled, initFirebaseIfNeeded, getAuthInstance, saveUserToFirestore, fetchUserFromFirestore, fetchAllUsersFromFirestore, subscribeAllUsersFromFirestore, authCreateUser, authSignIn, authSignOut, authUpdatePassword, authUpdateUserProfile, diagnoseFirestoreUserCollections, authSendPasswordResetEmail, authVerifyPasswordResetCode, authConfirmPasswordReset } from './firebase.init';

export type Role = 'Admin' | 'Player';
export interface User {
  username?: string;
  email: string;
  password: string;
  role: Role;
  displayName?: string;
  photoURL?: string;
  gold?: number;
  inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageUsersKey = 'ob_users_v1';
  private storageCurrentKey = 'ob_current_user_v1';
  private users: User[] = [];
  private current: User | null = null;
  private adminEmails: string[] = ['sebokubinec7@gmail.com', 'bojkosam@gmail.com'];

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

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ]);
  }

  private getAuthErrorMessage(error: any, fallback: string): string {
    const code = String(error?.code || '');
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Wrong email or password.';
      case 'auth/invalid-email':
        return 'Invalid email.';
      case 'auth/email-already-in-use':
        return 'Email already registered.';
      case 'auth/weak-password':
        return 'Password is too weak.';
      case 'auth/missing-password':
        return 'Password is required.';
      case 'auth/missing-email':
        return 'Email is required.';
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'Reset code is invalid or expired.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case '':
        if (String(error?.message || '') === 'Reset verification timed out.') {
          return 'Verification took too long. Please try again.';
        }
        if (String(error?.message || '') === 'Password reset timed out.') {
          return 'Password reset took too long. Please try again.';
        }
        return fallback;
      default:
        return fallback;
    }
  }
  
  // SDK-based Firebase helpers are used from firebase.init.ts
//register
  async register(email: string, password: string, username?: string): Promise<{ ok: boolean; message?: string }> {
    email = email.trim().toLowerCase();
    username = String(username || '').trim();
    if (!email || !password) return { ok: false, message: 'Email and password are required.' };
    if (!username) return { ok: false, message: 'Username is required.' };
    if (username.length < 3) return { ok: false, message: 'Username must be at least 3 characters.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Invalid email.' };
    if (this.users.find(u => u.email === email)) return { ok: false, message: 'Email already registered.' };
    // if email matches admin defaults, promote to admin
    const role: Role = this.adminEmails.includes(email) ? 'Admin' : 'Player';
    const safeUsername = username;
    const user: User = { username: safeUsername, email, password, role, displayName: safeUsername, photoURL: '', gold: 0, inventory: [] };
    // If Firebase Auth is enabled, create the auth user first
    if (isFirebaseEnabled()) {
      try {
        await authCreateUser(email, password);
        await authUpdateUserProfile({ displayName: safeUsername });
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
    // If Firebase Auth is enabled, use it for sign in
    if (isFirebaseEnabled()) {
      // sign in once and get credential+user
      let fbUser: any = null;
      try {
        const cred = await authSignIn(email, password);
        fbUser = cred && (cred as any).user ? (cred as any).user : null;
      } catch (e: any) {
        return { ok: false, message: this.getAuthErrorMessage(e, 'Wrong email or password.') };
      }

      try {
        const remote = await fetchUserFromFirestore(email);
        if (remote) {
          const merged = { ...(this.users.find(u => u.email === email) || {} as User), ...remote } as User;
          merged.role = this.adminEmails.includes(merged.email) ? 'Admin' : (merged.role || 'Player');
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
            gold: (local.gold != null) ? local.gold : 0,
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
      } catch { /* ignore fetch errors */ }
      return { ok: true };
    }

    // fallback to local auth when Firebase not enabled
    const u = this.users.find(x => x.email === email && x.password === password);
    if (!u) return { ok: false, message: 'Invalid credentials.' };
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
        url: `${baseUrl}/login`,
        handleCodeInApp: false,
      });
      return { ok: true, message: 'Password reset email sent. Click the link in the email to open the reset page directly.' };
    } catch (e: any) {
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
    this.current = null; 
    this.saveCurrent(); 
    if (isFirebaseEnabled()) {
      try { await authSignOut(); } catch { /* ignore */ }
    }
  }
  isLoggedIn(): boolean { return this.current !== null; }
  getCurrent(): User | null { return this.current ? { ...this.current } : null; }
  isAdmin(): boolean { return this.current?.role === 'Admin'; }


  getLeaderboardUsers(): Array<{ email: string; displayName: string; gold: number; role: Role; photoURL?: string }> {
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
        role: u.role || 'Player',
        photoURL: u.photoURL || '',
      }));
  }

  async getLeaderboardUsersFromDatabase(): Promise<Array<{ email: string; displayName: string; gold: number; role: Role; photoURL?: string }>> {
    if (!isFirebaseEnabled()) return [];
    let remoteUsers: any[] = [];
    remoteUsers = await fetchAllUsersFromFirestore();
    const mapped = this.mapLeaderboardUsers(remoteUsers);
    return mapped;
  }

  async subscribeLeaderboardUsers(
    onUsers: (users: Array<{ email: string; displayName: string; gold: number; role: Role; photoURL?: string }>) => void,
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

  private mapLeaderboardUsers(remoteUsers: any[]): Array<{ email: string; displayName: string; gold: number; role: Role; photoURL?: string }> {
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
          role: (String(u.role || 'Player') === 'Admin' ? 'Admin' : 'Player') as Role,
          photoURL: String(u.photoURL || ''),
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
}
