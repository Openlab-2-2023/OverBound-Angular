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
  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  message = '';

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {
    this.route.queryParams.subscribe(q => {
      if (q['mode'] === 'register') this.mode = 'register';
      else this.mode = 'login';
    });
  }

  submit() {
    this.message = '';
    if (this.mode === 'login') {
      const res = this.auth.login(this.email, this.password);
      if (!res.ok) { this.message = res.message || 'Login failed.'; return; }
      this.router.navigate(['/']);
    } else {
      const res = this.auth.register(this.email, this.password);
      if (!res.ok) { this.message = res.message || 'Register failed.'; return; }
      this.router.navigate(['/']);
    }
  }

  switchMode(m: 'login'|'register') { this.mode = m; this.message = ''; }
  goBack() { this.router.navigate(['/']); }
}
