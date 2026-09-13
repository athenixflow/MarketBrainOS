import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { UserProfile } from '../types';
import { getUserProfile, ensureUserProfile, subscribeToSystemLock } from '../services/persistenceService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Emergency lockdown flag. One live subscription for the whole app — see the effect below. */
  isSystemLocked: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Set when the profile could not be read (offline, rules, outage). Retry with refreshProfile. */
  profileError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Never throws. A rejected read used to escape the auth callback below, so setLoading(false)
  // never ran and AppRoutes rendered nothing until a manual reload - the app opened to a blank
  // screen on any phone with a flaky connection.
  const fetchProfile = async (uid: string, email: string | null) => {
    try {
      // Ensure the database record exists for this user (Firebase Auth <-> Firestore Sync)
      if (email) await ensureUserProfile(uid, email);
      setProfile(await getUserProfile(uid));
      setProfileError(null);
    } catch (e: any) {
      console.error('Profile load failed:', e);
      setProfileError(e?.message || 'Could not load your account.');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        if (currentUser) {
          await fetchProfile(currentUser.uid, currentUser.email);
        } else {
          setProfile(null);
          setProfileError(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // One lockdown subscription for the whole app, and only once there is a user to authorise the read.
  // Header and AppContainer each used to run their own 10s poller from mount, which both denied on a
  // cold load (auth had not restored yet) and re-read the same document forever afterwards.
  useEffect(() => {
    if (!user) { setIsSystemLocked(false); return; }
    const unsubscribe = subscribeToSystemLock(setIsSystemLocked);
    return () => unsubscribe();
  }, [user]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user.email);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSystemLocked, signOut: handleSignOut, refreshProfile, profileError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};