/**
 * Once-only bookkeeping for the welcome email.
 *
 * THE FLAG MUST NOT LIVE IN users/{uid}. The browser creates the profile (email, tier, the free
 * token allowance, role, created_at) with a create-if-missing, and the Firestore rules only allow
 * those economy fields on that create. The welcome path runs at the same moment, from the auth
 * trigger and from the sendWelcomeEmail callable, and it used to write `users/{uid}.welcome_sent`
 * with merge, which CREATED the document first. The browser then saw "profile exists" and skipped
 * its create, so every such account was left with no email, no tier and no tokens.
 *
 * The flag lives in email_flags/{uid}, which no client can read or write. `create()` is atomic, so
 * the trigger and the callable racing each other can no longer both send.
 */

/* The slice of the Admin SDK this needs, so the guard test can pass an in-memory fake. */
export interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, any> | undefined }>;
  create(data: Record<string, any>): Promise<unknown>;
  delete(): Promise<unknown>;
}
export interface Db { collection(name: string): { doc(id: string): DocRef } }

export const WELCOME_FLAGS = 'email_flags';

/**
 * Claims the right to send this user's welcome. True exactly once per uid; false if it was already
 * claimed here, or sent before the flag moved (accounts whose profile carries the old flag).
 */
export async function claimWelcome(db: Db, uid: string): Promise<boolean> {
  const legacy = await db.collection('users').doc(uid).get();
  if (legacy.exists && legacy.data()?.welcome_sent) return false;
  try {
    await db.collection(WELCOME_FLAGS).doc(uid).create({ welcome_sent: true, at: new Date().toISOString() });
    return true;
  } catch (e: any) {
    // ALREADY_EXISTS (gRPC 6) is the other path winning the race; anything else is a real failure.
    if (e?.code === 6 || /already exists/i.test(String(e?.message))) return false;
    throw e;
  }
}

/** Gives the claim back when the send failed, so the next attempt can retry it. */
export async function releaseWelcome(db: Db, uid: string): Promise<void> {
  await db.collection(WELCOME_FLAGS).doc(uid).delete().catch(() => undefined);
}
