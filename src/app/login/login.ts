import { ChangeDetectorRef, Component, OnDestroy, NgZone } from '@angular/core';
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
export class Login implements OnDestroy {
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
  submitting = false;
  verifyingCode = false;
  resetEmail = '';
  resetCodeVerified = false;
  toastMessage = '';
  toastVisible = false;
  toastType: 'error' | 'success' | 'info' = 'error';
  
  private requestVersion = 0;
  private readonly authTimeoutMs = 8000;
  private requestTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private toastTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
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
    if (this.submitting) return;
    this.clearToast();

    // Basic field validation
    if (this.mode === 'login') {
      const email = this.email.trim();
      if (!email || !this.password) {
        this.setMessage('Email and password are required.', 'error');
        return;
      }
      if (!this.isValidEmail(email)) {
        this.setMessage('Please enter a valid email address.', 'error');
        return;
      }
    } else if (this.mode === 'register') {
      if (!this.username.trim() || !this.email.trim() || !this.password) {
        this.setMessage('Username, email, and password are required.', 'error');
        return;
      }
      if (!this.isValidEmail(this.email.trim())) {
        this.setMessage('Please enter a valid email address.', 'error');
        return;
      }
      const pwdValidation = this.validatePassword(this.password);
      if (!pwdValidation.ok) {
        this.setMessage(pwdValidation.message!, 'error');
        return;
      }
    } else if (this.mode === 'forgot') {
      if (!this.email.trim()) {
        this.setMessage('Email is required.', 'error');
        return;
      }
      if (!this.isValidEmail(this.email.trim())) {
        this.setMessage('Please enter a valid email address.', 'error');
        return;
      }
    } else if (!this.resetCode.trim() || !this.newPassword || !this.confirmPassword) {
      this.setMessage('Reset code and both password fields are required.', 'error');
      return;
    }

    const requestId = ++this.requestVersion;
    this.setMessage('', 'error');
    this.submitting = true;
    this.loading = true;
    this.detectUi();
    this.startRequestGuard(
      requestId,
      this.mode === 'login'
        ? 'Login request timed out. Please try again.'
        : this.mode === 'register'
          ? 'Registration request timed out. Please try again.'
          : this.mode === 'forgot'
            ? 'Password reset request timed out. Please try again.'
            : 'Password reset request timed out. Please try again.',
    );
    
    try {
      if (this.mode === 'login') {
        const email = this.email.trim().toLowerCase();
        const res = await this.withTimeout(
          this.auth.login(email, this.password),
          this.authTimeoutMs,
          'Login request timed out. Please try again.',
        );
        if (!this.isRequestActive(requestId)) return;
        if (!res || !res.ok) {
          const errorMsg = this.getLoginFailureMessage(res?.message || 'Incorrect password. Please try again.');
          this.handleLoginFailure(requestId, errorMsg);
          return;
        }
        await this.flushUi();
        await this.delay(250);
        await this.router.navigate(['/']);
      } else if (this.mode === 'register') {
        const res = await this.withTimeout(
          this.auth.register(this.email, this.password, this.username),
          this.authTimeoutMs,
          'Registration request timed out. Please try again.',
        );
        if (!this.isRequestActive(requestId)) return;
        if (!res.ok) { 
          this.ngZone.run(() => {
            this.loading = false;
            this.setMessage(res.message || 'Registration failed. Please try again.', 'error');
          });
          return;
        }
        this.router.navigate(['/']);
      } else if (this.mode === 'forgot') {
        const res = await this.withTimeout(
          this.auth.forgotPassword(this.email),
          this.authTimeoutMs,
          'Password reset request timed out. Please try again.',
        );
        if (!this.isRequestActive(requestId)) return;
        this.ngZone.run(() => {
          this.loading = false;
          this.setMessage(
            res.message || (res.ok ? 'Password reset email sent. Check your inbox.' : 'Failed to send reset email.'),
            res.ok ? 'success' : 'error',
          );
        });
        if (res.ok) this.resetEmail = this.email.trim().toLowerCase();
      } else {
        if (!this.resetCode.trim()) { 
          this.loading = false;
          this.setMessage('Reset code is required.', 'error'); 
          return; 
        }
        if (!this.newPassword) { 
          this.loading = false;
          this.setMessage('New password is required.', 'error'); 
          return; 
        }
        const pwdValidation = this.validatePassword(this.newPassword);
        if (!pwdValidation.ok) {
          this.loading = false;
          this.setMessage(pwdValidation.message!, 'error');
          return;
        }
        if (this.newPassword !== this.confirmPassword) { 
          this.loading = false;
          this.setMessage('Passwords do not match.', 'error'); 
          return; 
        }
        const res = await this.withTimeout(
          this.auth.resetPassword(this.resetCode, this.newPassword),
          this.authTimeoutMs,
          'Password reset request timed out. Please try again.',
        );
        if (!this.isRequestActive(requestId)) return;
        if (!res.ok) { 
          this.ngZone.run(() => {
            this.loading = false;
            this.setMessage(res.message || 'Password reset failed.', 'error'); 
          });
          return; 
        }
        this.setMessage(res.message || 'Password successfully reset. You can now log in.', 'success');
        this.password = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.mode = 'login';
        this.loading = false;
        this.detectUi();
      }
    } catch (e: any) {
      if (!this.isRequestActive(requestId)) return;
      const errorCode = String(e?.code || '');
      const errorMsg = String(e?.message || '');

      if (errorCode.includes('auth/')) {
        const friendlyMessage =
          this.mode === 'login'
            ? this.getLoginFailureMessage(this.getFriendlyFirebaseError(errorCode, errorMsg))
            : this.getFriendlyFirebaseError(errorCode, errorMsg);
        if (this.mode === 'login') this.handleLoginFailure(requestId, friendlyMessage);
        else {
          this.handleSubmitError(requestId, friendlyMessage, {
            clearPassword: false,
            showToast: false,
          });
        }
      } else if (errorMsg.includes('timeout')) {
        const timeoutMessage = 'Request took too long. Please check your connection and try again.';
        if (this.mode === 'login') this.handleLoginFailure(requestId, timeoutMessage);
        else {
          this.handleSubmitError(requestId, timeoutMessage, {
            clearPassword: false,
            showToast: false,
          });
        }
      } else if (errorMsg.includes('Network') || errorMsg.includes('network')) {
        const networkMessage = 'Network error. Please check your internet connection.';
        if (this.mode === 'login') this.handleLoginFailure(requestId, networkMessage);
        else {
          this.handleSubmitError(requestId, networkMessage, {
            clearPassword: false,
            showToast: false,
          });
        }
      } else if (errorMsg) {
        if (this.mode === 'login') this.handleLoginFailure(requestId, errorMsg);
        else {
          this.handleSubmitError(requestId, errorMsg, {
            clearPassword: false,
            showToast: false,
          });
        }
      } else {
        const fallbackMessage = 'An error occurred. Please try again.';
        if (this.mode === 'login') this.handleLoginFailure(requestId, fallbackMessage);
        else {
          this.handleSubmitError(requestId, fallbackMessage, {
            clearPassword: false,
            showToast: false,
          });
        }
      }
    } finally {
      this.clearRequestGuard();
      if (this.isRequestActive(requestId)) {
        this.ngZone.run(() => {
          this.loading = false;
          this.submitting = false;
          this.detectUi();
        });
      }
    }
  }

  switchMode(m: 'login'|'register'|'forgot'|'reset') {
    this.cancelPendingOperations();
    this.clearToast();
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
    this.clearToast();
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
    this.clearRequestGuard();
    this.requestVersion++;
    this.loading = false;
    this.submitting = false;
    this.verifyingCode = false;
    this.detectUi();
  }

  ngOnDestroy() {
    this.cancelPendingOperations();
    this.clearToast();
  }

  private isRequestActive(requestId: number) {
    return this.requestVersion === requestId;
  }

  private setMessage(message: string, type: 'error' | 'success' | 'info') {
    this.ngZone.run(() => {
      this.message = message;
      this.messageType = type;
      this.detectUi();
    });
  }

  private startRequestGuard(requestId: number, timeoutMessage: string) {
    this.clearRequestGuard();
    this.requestTimeoutHandle = setTimeout(() => {
      if (!this.isRequestActive(requestId)) return;
      this.requestVersion++;
      this.ngZone.run(() => {
        this.loading = false;
        this.submitting = false;
        this.verifyingCode = false;
        this.message = timeoutMessage;
        this.messageType = 'error';
        this.detectUi();
      });
    }, this.authTimeoutMs + 250);
  }

  private clearRequestGuard() {
    if (this.requestTimeoutHandle) {
      clearTimeout(this.requestTimeoutHandle);
      this.requestTimeoutHandle = null;
    }
  }

  private handleSubmitError(
    requestId: number,
    message: string,
    options?: { clearPassword?: boolean; showToast?: boolean },
  ) {
    if (!this.isRequestActive(requestId)) return;
    this.cancelPendingOperations();
    this.ngZone.run(() => {
      if (options?.clearPassword) this.password = '';
      this.setMessage(message, 'error');
      if (options?.showToast) this.showToast(message, 'error');
    });
  }

  private handleLoginFailure(requestId: number, message: string) {
    this.handleSubmitError(requestId, message, { clearPassword: true, showToast: true });
  }

  private getLoginFailureMessage(message: string): string {
    const normalized = String(message || '').toLowerCase();
    if (
      normalized.includes('invalid email or password') ||
      normalized.includes('wrong email or password') ||
      normalized.includes('incorrect password') ||
      normalized.includes('invalid credential')
    ) {
      return 'Wrong password. Login canceled. Please try again.';
    }
    return message || 'Login failed. Please try again.';
  }

  private showToast(message: string, type: 'error' | 'success' | 'info') {
    this.clearToast();
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    this.detectUi();
    this.toastTimeoutHandle = setTimeout(() => {
      this.ngZone.run(() => {
        this.toastVisible = false;
        this.toastMessage = '';
        this.detectUi();
      });
      this.toastTimeoutHandle = null;
    }, 3200);
  }

  private clearToast() {
    if (this.toastTimeoutHandle) {
      clearTimeout(this.toastTimeoutHandle);
      this.toastTimeoutHandle = null;
    }
    this.toastVisible = false;
    this.toastMessage = '';
    this.detectUi();
  }

  private async flushUi(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  shouldDisablePrimaryFields(): boolean {
    return this.submitting || this.loading;
  }

  shouldShowPrimarySpinner(): boolean {
    return this.loading;
  }

  private detectUi() {
    try {
      this.cdr.detectChanges();
    } catch {
      // ignore if called during teardown or before the first render pass completes
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
    ]);
  }

  private isValidEmail(email: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

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

  private getFriendlyFirebaseError(code: string, message: string): string {
    switch (code) {
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check and try again.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please register first or check the email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again or use "Forgot Password" to reset it.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try logging in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters with letters and numbers.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet connection and try again.';
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'Reset code is invalid or has expired. Please request a new password reset.';
      default:
        return message || 'Authentication failed. Please try again.';
    }
  }
}
