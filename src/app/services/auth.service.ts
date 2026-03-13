import { Injectable } from '@angular/core';

export type Role = 'Admin' | 'Player';
export interface User { email: string; password: string; role: Role }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageUsersKey = 'ob_users_v1';
  private storageCurrentKey = 'ob_current_user_v1';
  private users: User[] = [];
  private current: User | null = null;
  private adminEmails: string[] = ['sebokubinec7@gmail.com', 'admin2@example.com'];

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
  }

  private saveUsers() { localStorage.setItem(this.storageUsersKey, JSON.stringify(this.users)); }
  private saveCurrent() {
    if (this.current) localStorage.setItem(this.storageCurrentKey, JSON.stringify(this.current));
    else localStorage.removeItem(this.storageCurrentKey);
  }
//register
  register(email: string, password: string): { ok: boolean; message?: string } {
    email = email.trim().toLowerCase();
    if (!email || !password) return { ok: false, message: 'Email and password are required.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Invalid email.' };
    if (this.users.find(u => u.email === email)) return { ok: false, message: 'Email already registered.' };
    // if email matches admin defaults, promote to admin
    const role: Role = this.adminEmails.includes(email) ? 'Admin' : 'Player';
    const user: User = { email, password, role };
    this.users.push(user);
    this.saveUsers();
    this.current = { ...user };
    this.saveCurrent();
    return { ok: true };
  }
//login ked uz si bol raz prihlaseny a chces sa prihlasit znova, tak sa ti to podari len ak zadavas spravne heslo, inak ti to napise ze neplatne udaje
  login(email: string, password: string): { ok: boolean; message?: string } {
    email = email.trim().toLowerCase();
    const u = this.users.find(x => x.email === email && x.password === password);
    if (!u) return { ok: false, message: 'Invalid credentials.' };
    // ensure role reflects admin list
    const role: Role = this.adminEmails.includes(u.email) ? 'Admin' : (u.role || 'Player');
    this.current = { ...u, role };
    this.saveCurrent();
    return { ok: true };
  }

  changePassword(currentPassword: string, newPassword: string): { ok: boolean; message?: string } {
    if (!this.current) return { ok: false, message: 'Not logged in' };
    if (this.current.password !== currentPassword) return { ok: false, message: 'Current password is incorrect' };
    // update stored user
    const idx = this.users.findIndex(u => u.email === this.current!.email);
    if (idx >= 0) this.users[idx].password = newPassword;
    this.current.password = newPassword;
    this.saveUsers();
    this.saveCurrent();
    return { ok: true };
  }

  logout() { this.current = null; this.saveCurrent(); }
  isLoggedIn(): boolean { return this.current !== null; }
  getCurrent(): User | null { return this.current ? { ...this.current } : null; }
  isAdmin(): boolean { return this.current?.role === 'Admin'; }
}
