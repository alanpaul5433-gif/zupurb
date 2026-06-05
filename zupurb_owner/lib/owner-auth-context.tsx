'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface OwnerAuthContextType {
  user: User | null;
  isOwner: boolean;
  loading: boolean;
  establishmentIds: string[];
  displayName: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType>({
  user: null,
  isOwner: false,
  loading: true,
  establishmentIds: [],
  displayName: '',
  login: async () => {},
  logout: async () => {},
});

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [establishmentIds, setEstablishmentIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'owners', u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setIsOwner(true);
          setEstablishmentIds(data.establishmentIds ?? []);
          setDisplayName(data.displayName ?? u.email ?? '');
        } else {
          setIsOwner(false);
          setEstablishmentIds([]);
          setDisplayName('');
        }
      } else {
        setIsOwner(false);
        setEstablishmentIds([]);
        setDisplayName('');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'owners', cred.user.uid));
    if (!snap.exists()) {
      await signOut(auth);
      throw new Error('Your account is not registered as an owner. Contact support at support@zupurb.com');
    }
    const data = snap.data();
    setEstablishmentIds(data.establishmentIds ?? []);
    setDisplayName(data.displayName ?? cred.user.email ?? '');
  };

  const logout = () => signOut(auth);

  return (
    <OwnerAuthContext.Provider value={{ user, isOwner, loading, establishmentIds, displayName, login, logout }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export const useOwnerAuth = () => useContext(OwnerAuthContext);
