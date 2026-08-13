// Firebase client setup. We use the modular JS SDK (v10) on purpose: it runs in
// Expo Go with no native build, which is the fastest path to "it is on my phone
// right now." A production build would swap in react-native-firebase; that is a
// packaging choice, not a change to the trust model. The server still decides
// everything either way.

import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // getReactNativePersistence ships in the firebase/auth RN bundle. Some typings
  // versions do not surface it, so we tolerate that without failing the build.
  // @ts-ignore
  getReactNativePersistence,
  connectAuthEmulator,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './config';

const app = initializeApp(CONFIG.firebase);

// Same app, two runtimes. On a phone we persist the auth session with React
// Native storage. When run in a local browser (handy for showing two players
// on one screen) we use Firebase's default browser persistence. This is only
// about where the session token is cached; the trust model is identical.
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const db = getDatabase(app);
export const functions = getFunctions(app, CONFIG.region);

if (CONFIG.useEmulator) {
  const host = CONFIG.emulatorHost;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, host, 9000);
  connectFunctionsEmulator(functions, host, 5001);
}

// Each device becomes a player through anonymous auth. That uid is what the
// Security Rules pin every answer and score to. No accounts, no login screen.
let signInPromise: Promise<string> | null = null;

export function ensureSignedIn(): Promise<string> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
  if (signInPromise) return signInPromise;

  signInPromise = new Promise<string>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user.uid);
      }
    });
    signInAnonymously(auth).catch((err) => {
      unsub();
      reject(err);
    });
  });
  return signInPromise;
}
