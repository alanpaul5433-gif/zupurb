import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCoGnMQGysi8AUq6SyWLs0n-H39ddl7u74',
  authDomain: 'zupurb-9580f.firebaseapp.com',
  projectId: 'zupurb-9580f',
  storageBucket: 'zupurb-9580f.firebasestorage.app',
  messagingSenderId: '122627565692',
  appId: '1:122627565692:web:43a54f108565b8274481f9',
  measurementId: 'G-PTKV2VQ85E',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
