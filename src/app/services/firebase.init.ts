import { FIREBASE_SDK_CONFIG } from './firebase.sdk.config';

let firebaseInitialized = false;
let _firestore: any = null;
let _auth: any = null;

export function isFirebaseEnabled(): boolean {
  return !!FIREBASE_SDK_CONFIG && !!FIREBASE_SDK_CONFIG.projectId;
}

export async function initFirebaseIfNeeded() {
  if (!isFirebaseEnabled() || firebaseInitialized) return;
  try {
    // dynamic import to avoid adding runtime dependency when not used
    const firebase = await import('firebase/app');
    const { initializeApp } = firebase;
    const app = initializeApp(FIREBASE_SDK_CONFIG as any);
    const firestoreMod = await import('firebase/firestore');
    _firestore = firestoreMod.getFirestore(app);
    try {
      const authMod = await import('firebase/auth');
      _auth = authMod.getAuth(app);
    } catch (e) {
      // auth is optional; continue if it fails
      console.warn('Failed to init Firebase Auth', e);
      _auth = null;
    }
    firebaseInitialized = true;
  } catch (e) {
    console.warn('Failed to initialize Firebase SDK', e);
    firebaseInitialized = false;
    _firestore = null;
  }
}

export function getFirestoreInstance() {
  return _firestore;
}

export function getAuthInstance() {
  return _auth;
}

export async function authCreateUser(email: string, password: string) {
  await initFirebaseIfNeeded();
  if (!_auth) throw new Error('Firebase Auth not initialized');
  try {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    return await createUserWithEmailAndPassword(_auth, email, password);
  } catch (e) {
    console.warn('authCreateUser failed', e);
    throw e;
  }
}

export async function authSignIn(email: string, password: string) {
  await initFirebaseIfNeeded();
  if (!_auth) throw new Error('Firebase Auth not initialized');
  try {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    return await signInWithEmailAndPassword(_auth, email, password);
  } catch (e) {
    console.warn('authSignIn failed', e);
    throw e;
  }
}

export async function authSignOut() {
  await initFirebaseIfNeeded();
  if (!_auth) return;
  try {
    const { signOut } = await import('firebase/auth');
    return await signOut(_auth);
  } catch (e) {
    console.warn('authSignOut failed', e);
  }
}

export async function authUpdatePassword(email: string, currentPassword: string, newPassword: string) {
  await initFirebaseIfNeeded();
  if (!_auth) throw new Error('Firebase Auth not initialized');
  try {
    const { signInWithEmailAndPassword, updatePassword } = await import('firebase/auth');
    // Re-authenticate by signing in with current credentials
    const cred = await signInWithEmailAndPassword(_auth, email, currentPassword);
    const user = cred.user || _auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await updatePassword(user, newPassword);
    // ensure auth session reflects new password: sign in with new password
    try { await signInWithEmailAndPassword(_auth, email, newPassword); } catch (e) { /* ignore */ }
    return true;
  } catch (e) {
    console.warn('authUpdatePassword failed', e);
    throw e;
  }
}

export async function authUpdateUserProfile(updates: { displayName?: string; photoURL?: string }) {
  await initFirebaseIfNeeded();
  if (!_auth) throw new Error('Firebase Auth not initialized');
  try {
    const { updateProfile } = await import('firebase/auth');
    const user = _auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await updateProfile(user, updates as any);
    return true;
  } catch (e) {
    console.warn('authUpdateUserProfile failed', e);
    throw e;
  }
}

export async function saveUserToFirestore(user: any) {
  if (!isFirebaseEnabled()) return;
  await initFirebaseIfNeeded();
  if (!_firestore) throw new Error('Firestore is not initialized');
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const ref = doc(_firestore, 'users', user.email);
    await setDoc(ref, user, { merge: true });
  } catch (e) {
    console.warn('saveUserToFirestore failed', e);
    throw e;
  }
}

export async function fetchUserFromFirestore(email: string) {
  if (!isFirebaseEnabled()) return null;
  await initFirebaseIfNeeded();
  if (!_firestore) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const ref = doc(_firestore, 'users', email);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('fetchUserFromFirestore failed', e);
    return null;
  }
}

export async function uploadFileToStorage(file: File, destPath?: string) {
  if (!isFirebaseEnabled()) throw new Error('Firebase not enabled');
  await initFirebaseIfNeeded();
  try {
    const storageMod = await import('firebase/storage');
    const { getStorage, ref, uploadBytes, getDownloadURL } = storageMod;
    const storage = getStorage();
    const path = destPath || `user_uploads/${encodeURIComponent((file.name || 'upload'))}_${Date.now()}`;
    const storageRef = ref(storage, path);
    const uploadRes = await uploadBytes(storageRef, file as any);
    const url = await getDownloadURL(uploadRes.ref);
    return url;
  } catch (e) {
    console.warn('uploadFileToStorage failed', e);
    throw e;
  }
}
