import { Routes } from '@angular/router';
import { Start } from './start/start';
import { GameComponent } from './game/game';

export const routes: Routes = [

    { path: '', component: Start },
  { path: 'game', component: GameComponent },
  {path: 'end',
  loadComponent: () =>
    import('./endscreen/endscreen').then(m => m.Endscreen),
  }
];
