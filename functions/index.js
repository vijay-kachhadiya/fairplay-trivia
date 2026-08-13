// THE REFEREE.
//
// Every decision that matters happens in this file, on the server:
//   - which question is open, and when it opened (server timestamp)
//   - when it closes (a single authority ticking the clock)
//   - whether an answer is correct (the answer key never leaves the server)
//   - how many points each player earns (judged on SERVER time, not the phone)
//   - the leaderboard
//
// The phone only renders what this file publishes. That is the whole product
// thesis in one sentence: the client renders, the server decides.

const admin = require('firebase-admin');
const { ServerValue } = require('firebase-admin/database');
const { FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const { getFunctions } = require('firebase-admin/functions');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { QUESTION_BANK } = require('./questionBank');

// A determinable database URL is required. Under the emulator, the CLI sets
// FIREBASE_DATABASE_EMULATOR_HOST and the Admin SDK redirects to it automatically,
// so this production-shaped URL is just the fallback shape it needs.
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-fairplay-trivia';
admin.initializeApp({
  databaseURL: `https://${PROJECT_ID}-default-rtdb.firebaseio.com`
});
setGlobalOptions({ region: 'us-central1', timeoutSeconds: 120 });

const db = admin.database();
const fs = admin.firestore();

// One shared room for the demo. A real match id would be generated per game.
const MATCH_ID = 'demo';
const DURATION_MS = 12000;   // how long a question stays open
const REVEAL_MS = 4000;      // time to show the correct answer
const LEADERBOARD_MS = 3500; // time to show standings before the next question
const BASE_POINTS = 500;     // points for a correct answer
const SPEED_POINTS = 500;    // extra points, scaled by how fast (on server time)

const IS_EMULATOR = !!process.env.FUNCTIONS_EMULATOR;

// ---------------------------------------------------------------------------
// Callable entry points (what the app can ask the server to do)
// ---------------------------------------------------------------------------

// Start a fresh match: clear the room, then open question 0.
exports.startMatch = onCall(async (request) => {
  requireAuth(request);
  await resetMatchState();
  await openQuestion(0);
  return { ok: true, matchId: MATCH_ID };
});

// Reset the room back to the lobby without starting. Used for repeat demos.
exports.resetMatch = onCall(async (request) => {
  requireAuth(request);
  await resetMatchState();
  return { ok: true };
});

// The timed close. In production this is invoked by Cloud Tasks at
// serverStartAt + durationMs. In the emulator we call closeQuestion() directly
// via setTimeout (see scheduleClose), so this task target is the deployed path.
exports.closeQuestionTask = onTaskDispatched(
  { retryConfig: { maxAttempts: 3 }, rateLimits: { maxConcurrentDispatches: 5 } },
  async (request) => {
    const { index } = request.data || {};
    await closeQuestion(index);
  }
);

// ---------------------------------------------------------------------------
// The round loop
// ---------------------------------------------------------------------------

async function openQuestion(index) {
  const q = QUESTION_BANK.find((item) => item.index === index);
  if (!q) {
    logger.warn(`openQuestion: no question at index ${index}`);
    return;
  }

  // The answer key goes to Firestore, server only. Security rules deny every
  // client read of this collection. The phone can never fetch it.
  await fs
    .collection('answerKeys')
    .doc(`${MATCH_ID}_${q.id}`)
    .set({ matchId: MATCH_ID, questionId: q.id, correctChoiceId: q.correctChoiceId });

  // The phone receives THIS projection: prompt and choices, no correct answer.
  await db.ref(`questionsPublic/${MATCH_ID}/${q.id}`).set({
    prompt: q.prompt,
    choices: q.choices,
    index: q.index
  });

  // Open the question. serverStartAt is stamped by the server, not the phone.
  await db.ref(`matches/${MATCH_ID}`).update({
    phase: 'QUESTION_OPEN',
    currentQuestionId: q.id,
    currentIndex: q.index,
    totalQuestions: QUESTION_BANK.length,
    durationMs: DURATION_MS,
    serverStartAt: ServerValue.TIMESTAMP
  });

  logger.info(`Opened ${q.id} (index ${index}). Closing in ${DURATION_MS}ms.`);
  await scheduleClose(index, DURATION_MS + 500);
}

async function closeQuestion(index) {
  const matchRef = db.ref(`matches/${MATCH_ID}`);
  const matchSnap = await matchRef.get();
  const match = matchSnap.val() || {};

  // Idempotency guard: only close the question that is actually open.
  if (match.phase !== 'QUESTION_OPEN' || match.currentIndex !== index) {
    logger.info(`closeQuestion(${index}) ignored, phase=${match.phase} currentIndex=${match.currentIndex}`);
    return;
  }

  const questionId = match.currentQuestionId;
  const serverStartAt = match.serverStartAt;
  const durationMs = match.durationMs || DURATION_MS;

  await matchRef.update({ phase: 'QUESTION_CLOSED' });

  // Fetch the correct answer from the server-only store.
  const keySnap = await fs.collection('answerKeys').doc(`${MATCH_ID}_${questionId}`).get();
  const correctChoiceId = keySnap.exists ? keySnap.data().correctChoiceId : null;

  // Read every submitted answer and score it on SERVER time.
  const answersSnap = await db.ref(`answers/${MATCH_ID}/${questionId}`).get();
  const answers = answersSnap.val() || {};

  const perPlayerResult = {};
  const scoreDeltas = {};

  for (const [uid, ans] of Object.entries(answers)) {
    const correct = ans.choiceId === correctChoiceId;

    // The ONLY time that counts: the server's timestamp on the write.
    const serverElapsedMs = clampElapsed(ans.serverWriteTime - serverStartAt, durationMs);
    // What the phone CLAIMED. We store it only to prove we ignore it.
    const claimedElapsedMs = ans.clientSubmitAt != null ? ans.clientSubmitAt - serverStartAt : null;

    const awarded = correct ? BASE_POINTS + speedBonus(serverElapsedMs, durationMs) : 0;

    perPlayerResult[uid] = {
      choiceId: ans.choiceId,
      correct,
      awarded,
      serverElapsedMs,
      claimedElapsedMs
    };
    scoreDeltas[uid] = awarded;
  }

  // Write the reveal (correct answer becomes visible to clients only NOW).
  await db.ref(`reveal/${MATCH_ID}/${questionId}`).set({
    correctChoiceId,
    perPlayerResult
  });

  // Update running totals. Server is the only writer of /scores.
  for (const [uid, delta] of Object.entries(scoreDeltas)) {
    await db.ref(`scores/${MATCH_ID}/${uid}/total`).transaction((cur) => (cur || 0) + delta);
    await db.ref(`scores/${MATCH_ID}/${uid}/name`).set((match.presence && match.presence[uid] && match.presence[uid].name) || 'Player');
  }

  logger.info(`Closed ${questionId}. Correct=${correctChoiceId}. Scored ${Object.keys(answers).length} answers.`);

  // Reveal, then leaderboard, then the next question or the end.
  await matchRef.update({ phase: 'REVEAL' });
  await wait(REVEAL_MS);
  await matchRef.update({ phase: 'LEADERBOARD' });
  await wait(LEADERBOARD_MS);

  if (index + 1 < QUESTION_BANK.length) {
    await openQuestion(index + 1);
  } else {
    await endMatch();
  }
}

async function endMatch() {
  await db.ref(`matches/${MATCH_ID}`).update({ phase: 'MATCH_END' });

  // Durable history goes to Firestore (server only).
  const scoresSnap = await db.ref(`scores/${MATCH_ID}`).get();
  await fs.collection('matchHistory').add({
    matchId: MATCH_ID,
    finishedAt: FieldValue.serverTimestamp(),
    finalScores: scoresSnap.val() || {}
  });
  logger.info('Match ended. History written to Firestore.');
}

// ---------------------------------------------------------------------------
// Scheduling: Cloud Tasks in production, setTimeout in the emulator only
// ---------------------------------------------------------------------------

async function scheduleClose(index, delayMs) {
  if (IS_EMULATOR) {
    // EMULATOR ONLY. The Task Queue emulator does not honor scheduleDelaySeconds,
    // so we tick the clock locally. The production path below uses Cloud Tasks.
    // Timing and scoring are still done on the server either way, that is the proof.
    setTimeout(() => {
      closeQuestion(index).catch((err) => logger.error('closeQuestion failed', err));
    }, delayMs);
    return;
  }

  // PRODUCTION: enqueue a Cloud Task that fires closeQuestionTask after the delay.
  // One authority ticks the clock, exactly as the architecture diagram shows.
  const queue = getFunctions().taskQueue('closeQuestionTask');
  await queue.enqueue(
    { index },
    { scheduleDelaySeconds: Math.round(delayMs / 1000) }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resetMatchState() {
  await Promise.all([
    db.ref(`answers/${MATCH_ID}`).remove(),
    db.ref(`reveal/${MATCH_ID}`).remove(),
    db.ref(`scores/${MATCH_ID}`).remove(),
    db.ref(`questionsPublic/${MATCH_ID}`).remove()
  ]);
  await db.ref(`matches/${MATCH_ID}`).update({
    phase: 'LOBBY',
    currentQuestionId: null,
    currentIndex: null,
    serverStartAt: null,
    durationMs: DURATION_MS,
    totalQuestions: QUESTION_BANK.length
  });
}

function speedBonus(serverElapsedMs, durationMs) {
  const remainingFraction = Math.max(0, (durationMs - serverElapsedMs) / durationMs);
  return Math.round(SPEED_POINTS * remainingFraction);
}

function clampElapsed(elapsed, durationMs) {
  if (!Number.isFinite(elapsed)) return durationMs;
  return Math.min(Math.max(elapsed, 0), durationMs);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first. Anonymous auth is enough.');
  }
}
