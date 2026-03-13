import { Routes } from '@angular/router';
import { Start } from './start/start';
import { GameComponent } from './game/game';
import { Login } from './login/login';
import { AccountDetails } from './account-details/account-details';

export const routes: Routes = [
  { path: '', component: Start },
  { path: 'game', component: GameComponent },
  { path: 'login', component: Login },
  { path: 'account', component: AccountDetails },
  { path: 'end',loadComponent: () => import('./endscreen/endscreen').then((m) => m.Endscreen),},
];
