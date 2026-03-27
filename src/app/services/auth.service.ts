import { Injectable } from '@angular/core';
import { isFirebaseEnabled, initFirebaseIfNeeded, getAuthInstance, saveUserToFirestore, fetchUserFromFirestore, authCreateUser, authSignIn, authSignOut, authUpdatePassword } from './firebase.init';

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
  
  // SDK-based Firebase helpers are used from firebase.init.ts
//register
  async register(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    email = email.trim().toLowerCase();
    if (!email || !password) return { ok: false, message: 'Email and password are required.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Invalid email.' };
    if (this.users.find(u => u.email === email)) return { ok: false, message: 'Email already registered.' };
    // if email matches admin defaults, promote to admin
    const role: Role = this.adminEmails.includes(email) ? 'Admin' : 'Player';
    const username = email.split('@')[0];
    const user: User = { username, email, password, role, displayName: '', photoURL: '', gold: 0, inventory: [] };
    // If Firebase Auth is enabled, create the auth user first
    if (isFirebaseEnabled()) {
      try {
        await authCreateUser(email, password);
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Firebase auth failed' };
      }
    }
    this.users.push(user);
    this.saveUsers();
    this.current = { ...user };
    this.saveCurrent();
    // persist to Firestore (fire-and-forget)
    if (isFirebaseEnabled()) saveUserToFirestore(user).catch(() => {});
    return { ok: true };
  }
//login ked uz si bol raz prihlaseny a chces sa prihlasit znova, tak sa ti to podari len ak zadavas spravne heslo, inak ti to napise ze neplatne udaje
  async login(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    email = email.trim().toLowerCase();
    // If Firebase Auth is enabled, use it for sign in
    if (isFirebaseEnabled()) {
      try {
        await authSignIn(email, password);
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Invalid credentials.' };
      }
      // fetch profile from Firestore and merge into local storage
      let fbUser: any = null;
      try {
        const cred = await authSignIn(email, password);
        fbUser = cred && (cred as any).user ? (cred as any).user : null;
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Invalid credentials.' };
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

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.current) return { ok: false, message: 'Not logged in' };
    const email = this.current.email;
    if (isFirebaseEnabled()) {
      try {
        await authUpdatePassword(email, currentPassword, newPassword);
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Password update failed' };
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

  updateProfile(updates: Partial<User>): { ok: boolean; message?: string } {
    if (!this.current) return { ok: false, message: 'Not logged in' };
    this.current = { ...this.current, ...updates } as User;
    const idx = this.users.findIndex(u => u.email === this.current!.email);
    if (idx >= 0) this.users[idx] = { ...this.users[idx], ...updates } as User;
    this.saveUsers();
    this.saveCurrent();
    if (isFirebaseEnabled()) saveUserToFirestore(this.current!).catch(() => {});
    return { ok: true };
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
}
