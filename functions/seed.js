// Seed the question bank into Firestore (the server-only source of truth).
//
// Run this once against the running emulator:
//   npm run seed          (from the functions/ folder, with emulators up)
//
// It talks to the Firestore emulator by default. To seed a real Blaze project
// instead, unset FIRESTORE_EMULATOR_HOST and provide credentials, then run it.

const admin = require('firebase-admin');
const { QUESTION_BANK } = require('./questionBank');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-fairplay-trivia';

// Default to the local emulator so a fresh clone seeds with zero cloud setup.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  console.log('FIRESTORE_EMULATOR_HOST not set, defaulting to 127.0.0.1:8080 (emulator).');
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function seed() {
  const batch = db.batch();
  for (const q of QUESTION_BANK) {
    const ref = db.collection('questionBank').doc(q.id);
    batch.set(ref, q);
  }
  await batch.commit();
  console.log(`Seeded ${QUESTION_BANK.length} questions into questionBank on project ${PROJECT_ID}.`);
  console.log('The correct answers live here, in Firestore, where no client can read them.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
