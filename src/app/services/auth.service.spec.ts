import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebase.init', () => ({
  isFirebaseEnabled: vi.fn(),
  initFirebaseIfNeeded: vi.fn().mockResolvedValue(undefined),
  getAuthInstance: vi.fn().mockReturnValue(null),
  saveUserToFirestore: vi.fn().mockResolvedValue(undefined),
  fetchUserFromFirestore: vi.fn().mockResolvedValue(null),
  fetchAllUsersFromFirestore: vi.fn().mockResolvedValue([]),
  subscribeAllUsersFromFirestore: vi.fn().mockResolvedValue(() => {}),
  authCreateUser: vi.fn().mockResolvedValue({}),
  authSignIn: vi.fn(),
  authSignOut: vi.fn().mockResolvedValue(undefined),
  authUpdatePassword: vi.fn().mockResolvedValue(true),
  authUpdateUserProfile: vi.fn().mockResolvedValue(true),
  diagnoseFirestoreUserCollections: vi.fn().mockResolvedValue(''),
  authSendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  authVerifyPasswordResetCode: vi.fn().mockResolvedValue(''),
  authConfirmPasswordReset: vi.fn().mockResolvedValue(true),
  authFetchSignInMethodsForEmail: vi.fn().mockResolvedValue([]),
}));

import { AuthService } from './auth.service';
import * as firebaseInit from './firebase.init';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

describe('AuthService login', () => {
  const mockedIsFirebaseEnabled = firebaseInit.isFirebaseEnabled as ReturnType<typeof vi.fn>;
  const mockedAuthSignIn = firebaseInit.authSignIn as ReturnType<typeof vi.fn>;
  const mockedAuthSignOut = firebaseInit.authSignOut as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not keep a user logged in when Firebase login fails with wrong password', async () => {
    mockedIsFirebaseEnabled.mockReturnValue(true);
    mockedAuthSignIn.mockRejectedValue({ code: 'auth/wrong-password' });

    localStorage.setItem(
      'ob_current_user_v1',
      JSON.stringify({
        email: 'player@example.com',
        password: 'correct-password',
        role: 'Player',
      }),
    );

    const service = new AuthService();
    const result = await service.login('player@example.com', 'wrong-password');

    expect(result.ok).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getCurrent()).toBeNull();
    expect(localStorage.getItem('ob_current_user_v1')).toBeNull();
    expect(mockedAuthSignOut).toHaveBeenCalledTimes(2);
  });

  it('still allows a local fallback for transient Firebase network failures when the password matches locally', async () => {
    mockedIsFirebaseEnabled.mockReturnValue(true);
    mockedAuthSignIn.mockRejectedValue({ code: 'auth/network-request-failed' });

    localStorage.setItem(
      'ob_users_v1',
      JSON.stringify([
        {
          email: 'player@example.com',
          password: 'correct-password',
          role: 'Player',
        },
      ]),
    );

    const service = new AuthService();
    const result = await service.login('player@example.com', 'correct-password');

    expect(result.ok).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getCurrent()?.email).toBe('player@example.com');
  });
});
