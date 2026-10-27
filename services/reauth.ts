/**
 * "Confirm it's you" for destructive admin actions. The server refuses them unless the caller signed
 * in recently (assertRecentAuth in functions/src/index.ts); the admin console catches that refusal,
 * asks for the password (or Google) here, refreshes the token so it carries the new auth_time, and
 * retries the action once.
 */
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, User } from 'firebase/auth';
import { googleProvider } from './firebase';
import { SecurityEngine } from './securityEngine';

/** The server's refusal, as it reaches the client through the callable wrappers (message kept). */
export const isReauthRequired = (err: any): boolean =>
  err?.details?.reason === 'reauth-required' || /confirm it is you/i.test(String(err?.message || ''));

export const usesPassword = (user: User | null | undefined): boolean =>
  !!user?.providerData?.some((p) => p.providerId === 'password');

const message = (err: any): string => {
  const code = err?.code || '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return "That password doesn't match.";
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'The Google window closed before we could verify you.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google popup. Allow popups for this site, then retry.';
  if (code === 'auth/user-mismatch') return 'That Google account is not the one you are signed in with.';
  return SecurityEngine.sanitizeErrorMessage(err?.message || 'Could not confirm it is you.');
};

/**
 * Re-authenticates with the password (password accounts) or a Google popup, then forces a fresh ID
 * token so the next callable carries the new auth_time. Resolves to an error message, or null on success.
 */
export async function confirmIdentity(user: User, password?: string): Promise<string | null> {
  try {
    if (usesPassword(user)) {
      if (!user.email) return 'This account has no email address to confirm with.';
      if (!password) return 'Enter your password.';
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else {
      await reauthenticateWithPopup(user, googleProvider);
    }
    await user.getIdToken(true);
    return null;
  } catch (err: any) {
    return message(err);
  }
}
