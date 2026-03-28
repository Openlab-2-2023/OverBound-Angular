import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  mode: 'login' | 'register' | 'forgot' | 'reset' = 'login';
  username = '';
  email = '';
  password = '';
  resetCode = '';
  newPassword = '';
  confirmPassword = '';
  message = '';
  messageType: 'error' | 'success' | 'info' = 'error';
  loading = false;
  verifyingCode = false;
  resetEmail = '';
  resetCodeVerified = false;
  private requestVersion = 0;

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {
    this.route.queryParams.subscribe(q => {
      this.cancelPendingOperations();
      if (q['mode'] === 'resetPassword' || q['oobCode']) {
        this.mode = 'reset';
        this.resetCode = String(q['oobCode'] || '');
        this.message = '';
        void this.prefillResetEmail();
        return;
      }
      if (q['mode'] === 'register') this.mode = 'register';
      else if (q['mode'] === 'forgot') this.mode = 'forgot';
      else if (q['mode'] === 'reset') this.mode = 'reset';
      else this.mode = 'login';
    });
  }

  async submit() {
    if (this.loading) return;
    if (this.mode === 'login') {
      const email = this.email.trim();
      if (!email || !this.password) {
        this.setMessage('Email and password are required.', 'error');
        return;
      }
    } else if (this.mode === 'register') {
      if (!this.username.trim() || !this.email.trim() || !this.password) {
        this.setMessage('Username, email, and password are required.', 'error');
        return;
      }
    } else if (this.mode === 'forgot') {
      if (!this.email.trim()) {
        this.setMessage('Email is required.', 'error');
        return;
      }
    } else if (!this.resetCode.trim() || !this.newPassword || !this.confirmPassword) {
      this.setMessage('Reset code and both password fields are required.', 'error');
      return;
    }
    const requestId = ++this.requestVersion;
    this.setMessage('', 'error');
    this.loading = true;
    try {
      if (this.mode === 'login') {
        const res = await this.auth.login(this.email, this.password);
        if (!this.isRequestActive(requestId)) return;
        if (!res.ok) { this.setMessage(res.message || 'Login failed.', 'error'); return; }
        this.router.navigate(['/']);
      } else if (this.mode === 'register') {
        const res = await this.auth.register(this.email, this.password, this.username);
        if (!this.isRequestActive(requestId)) return;
        if (!res.ok) { this.setMessage(res.message || 'Register failed.', 'error'); return; }
        this.router.navigate(['/']);
      } else if (this.mode === 'forgot') {
        const res = await this.auth.forgotPassword(this.email);
        if (!this.isRequestActive(requestId)) return;
        this.setMessage(
          res.message || (res.ok ? 'Password reset email sent.' : 'Reset failed.'),
          res.ok ? 'success' : 'error',
        );
        if (res.ok) this.resetEmail = this.email.trim().toLowerCase();
      } else {
        if (!this.resetCode.trim()) { this.setMessage('Reset code is required.', 'error'); return; }
        if (!this.newPassword) { this.setMessage('New password is required.', 'error'); return; }
        if (this.newPassword !== this.confirmPassword) { this.setMessage('Passwords do not match.', 'error'); return; }
        const res = await this.auth.resetPassword(this.resetCode, this.newPassword);
        if (!this.isRequestActive(requestId)) return;
        if (!res.ok) { this.setMessage(res.message || 'Password reset failed.', 'error'); return; }
        this.setMessage(res.message || 'Password reset successful.', 'success');
        this.password = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.mode = 'login';
      }
    } finally {
      if (this.isRequestActive(requestId)) this.loading = false;
    }
  }

  switchMode(m: 'login'|'register'|'forgot'|'reset') {
    this.cancelPendingOperations();
    this.mode = m;
    this.setMessage('', 'error');
    if (m === 'login') {
      this.username = '';
      this.password = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
    if (m !== 'reset') {
      this.resetCode = '';
      this.resetCodeVerified = false;
      this.resetEmail = '';
    } else {
      void this.prefillResetEmail();
    }
  }
  goBack() {
    this.cancelPendingOperations();
    this.router.navigate(['/']);
  }

  async verifyResetCode() {
    const code = this.resetCode.trim();
    if (!code) {
      this.setMessage('Reset code is required.', 'error');
      return;
    }
    const requestId = ++this.requestVersion;
    this.verifyingCode = true;
    this.setMessage('', 'error');
    try {
      const res = await this.auth.verifyResetCode(code);
      if (!this.isRequestActive(requestId)) return;
      if (!res.ok) {
        this.resetCodeVerified = false;
        this.resetEmail = '';
        this.setMessage(res.message || 'Reset code is invalid.', 'error');
        return;
      }
      this.resetCodeVerified = true;
      this.resetEmail = res.email || '';
      this.setMessage('', 'success');
    } finally {
      if (this.isRequestActive(requestId)) this.verifyingCode = false;
    }
  }

  private async prefillResetEmail() {
    if (!this.resetCode.trim()) return;
    const requestId = ++this.requestVersion;
    this.setMessage('', 'error');
    const res = await this.auth.verifyResetCode(this.resetCode);
    if (!this.isRequestActive(requestId)) return;
    if (!res.ok) {
      this.resetCodeVerified = false;
      this.resetEmail = '';
      this.setMessage('', 'error');
      return;
    }
    this.resetCodeVerified = true;
    this.resetEmail = res.email || '';
  }

  onResetCodeChange(value: string) {
    this.resetCode = value;
    this.resetCodeVerified = false;
    this.resetEmail = '';
    if (this.verifyingCode) {
      this.cancelPendingOperations();
    } else {
      this.setMessage('', 'error');
    }
  }

  private cancelPendingOperations() {
    this.requestVersion++;
    this.loading = false;
    this.verifyingCode = false;
  }

  private isRequestActive(requestId: number) {
    return this.requestVersion === requestId;
  }

  private setMessage(message: string, type: 'error' | 'success' | 'info') {
    this.message = message;
    this.messageType = type;
  }
}
