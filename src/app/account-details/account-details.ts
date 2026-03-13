import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-details.html',
  styleUrl: './account-details.css',
})
export class AccountDetails {
  editingName = false;
  nameValue = '';
  profilePreview: string | null = null;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  inventory: Array<{ id: string; name: string; icon: string; equipped?: boolean }> = [];

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const u: any = this.user;
    this.nameValue = u?.displayName || '';
    // inventory will be populated by the Store later; keep empty for now
    this.inventory = [];
  }

  get user(): any { return this.auth.getCurrent(); }

  logout() { this.auth.logout(); this.router.navigate(['/']); }
  goBack() { this.router.navigate(['/']); }

  startEditName() { this.editingName = true; }
  cancelEditName() { this.editingName = false; this.nameValue = this.user?.displayName || ''; }
  saveName() {
    // update locally; integrate with backend/auth service later
    const u: any = this.user;
    if (u) { u.displayName = this.nameValue; }
    this.editingName = false;
    console.log('Name saved:', this.nameValue);
  }

  onFileSelected(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    if (!inp.files || inp.files.length === 0) return;
    const file = inp.files[0];
    const reader = new FileReader();
    reader.onload = () => { this.profilePreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  changePassword() {
    if (!this.currentPassword || !this.newPassword) { alert('Please fill passwords'); return; }
    if (this.newPassword !== this.confirmPassword) { alert('Passwords do not match'); return; }
    const res = this.auth.changePassword(this.currentPassword, this.newPassword as string);
    if (!res.ok) { alert(res.message || 'Failed to change password'); return; }
    alert('Password changed successfully.');
    this.currentPassword = this.newPassword = this.confirmPassword = '';
  }

  toggleEquip(item: any) {
    item.equipped = !item.equipped;
  }
}
