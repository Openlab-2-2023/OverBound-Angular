import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initFirebaseIfNeeded } from './services/firebase.init';
import { getFirestore, doc, setDoc } from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";



import { routes } from './app.routes';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: APP_INITIALIZER, useFactory: () => () => initFirebaseIfNeeded(), multi: true }
  ]
};
