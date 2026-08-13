// All runtime configuration in one place. Everything comes from EXPO_PUBLIC_*
// environment variables (see app/.env.example) so nothing sensitive is baked in.
//
// For the demo we default to the local Firebase Emulator Suite with a project
// id that starts with "demo-". Firebase treats "demo-" projects as emulator only,
// which is why a fresh clone runs with zero cloud setup and zero cost.

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value != null && value.length > 0 ? value : fallback;
}

const projectId = env('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'demo-fairplay-trivia');

// When the app runs on a phone, "localhost" means the phone, not your computer.
// Set EXPO_PUBLIC_EMULATOR_HOST to your computer's LAN IP (for example 192.168.1.20)
// so the phone can reach the emulators. See RUN.md.
const emulatorHost = env('EXPO_PUBLIC_EMULATOR_HOST', 'localhost');

// Default to the emulator. Set EXPO_PUBLIC_USE_EMULATOR=false to hit a real project.
const useEmulator = env('EXPO_PUBLIC_USE_EMULATOR', 'true') !== 'false';

export const CONFIG = {
  matchId: 'demo',
  region: 'us-central1',
  useEmulator,
  emulatorHost,
  firebase: {
    apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY', 'demo-api-key'),
    authDomain: env('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', `${projectId}.firebaseapp.com`),
    projectId,
    databaseURL: env(
      'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
      `https://${projectId}-default-rtdb.firebaseio.com`
    ),
    storageBucket: env('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', `${projectId}.appspot.com`),
    messagingSenderId: env('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '000000000000'),
    appId: env('EXPO_PUBLIC_FIREBASE_APP_ID', '1:000000000000:web:demo')
  }
};
