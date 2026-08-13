// Everything the client is allowed to DO. Two kinds of action live here:
//
//   1. Honest moves: join, submit one answer, start or reset the match.
//   2. Cheat attempts: deliberate rule-breaking writes that the server must
//      reject. These power Proof 3. We WANT them to fail, and we surface the
//      real Firebase error so a viewer sees the server say no.

import { ref, set, serverTimestamp, onDisconnect, goOffline, goOnline } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { CONFIG } from './config';

const M = CONFIG.matchId;

export interface CheatResult {
  ok: boolean;        // true only if the write went through (which would be bad)
  blocked: boolean;   // true if the server rejected it (the good outcome)
  reason: string;     // plain-English explanation for the Referee View
  raw?: string;       // the underlying error code, for the curious
}

// --- Presence ---------------------------------------------------------------

export async function joinRoom(uid: string, name: string): Promise<void> {
  const presenceRef = ref(db, `matches/${M}/presence/${uid}`);
  await set(presenceRef, { name, connected: true, joinedAt: serverTimestamp() });
  // If this device drops, mark it disconnected. This is what lets other players
  // see "left the room" and what Proof 4 (resync) leans on.
  await onDisconnect(presenceRef).update({ connected: false });
}

// --- Match control (server side, via callable) ------------------------------

export async function startMatch(): Promise<void> {
  await httpsCallable(functions, 'startMatch')({});
}

export async function resetMatch(): Promise<void> {
  await httpsCallable(functions, 'resetMatch')({});
}

// --- The one honest answer write --------------------------------------------

// Write a single answer. Note what we send: choiceId, a clientSubmitAt that the
// server ignores, and serverWriteTime as a server sentinel. The Security Rules
// force serverWriteTime to equal the server's own clock, and the Cloud Function
// scores on THAT. clientSubmitAt is carried only so the reveal can show it was
// ignored.
export async function submitAnswer(
  uid: string,
  questionId: string,
  choiceId: string,
  claimedTime: number
): Promise<void> {
  const answerRef = ref(db, `answers/${M}/${questionId}/${uid}`);
  await set(answerRef, {
    choiceId,
    clientSubmitAt: claimedTime,
    serverWriteTime: serverTimestamp()
  });
}

// --- Cheat attempts (Proof 3) -----------------------------------------------

// (a) Write a fake high score directly. Only the server may write /scores.
export async function cheatFakeScore(uid: string): Promise<CheatResult> {
  try {
    await set(ref(db, `scores/${M}/${uid}`), { total: 999999, name: 'Cheater' });
    return { ok: true, blocked: false, reason: 'Score write went through. That should never happen.' };
  } catch (err) {
    return {
      ok: false,
      blocked: true,
      reason: 'Players cannot write scores. Only the server can.',
      raw: codeOf(err)
    };
  }
}

// (b) Submit a second answer to the same question. One locked answer per player.
export async function cheatDoubleAnswer(uid: string, questionId: string): Promise<CheatResult> {
  try {
    await set(ref(db, `answers/${M}/${questionId}/${uid}`), {
      choiceId: 'a',
      clientSubmitAt: Date.now(),
      serverWriteTime: serverTimestamp()
    });
    return { ok: true, blocked: false, reason: 'Second answer was accepted. That should never happen.' };
  } catch (err) {
    return {
      ok: false,
      blocked: true,
      reason: 'One locked answer per player per question. The second write was refused.',
      raw: codeOf(err)
    };
  }
}

// (c) Submit an answer after the question closed. Writes are allowed only while
// the phase is QUESTION_OPEN. Fire this during reveal or the leaderboard.
export async function cheatAnswerAfterClose(uid: string, questionId: string): Promise<CheatResult> {
  try {
    await set(ref(db, `answers/${M}/${questionId}/${uid}`), {
      choiceId: 'a',
      clientSubmitAt: Date.now(),
      serverWriteTime: serverTimestamp()
    });
    return { ok: true, blocked: false, reason: 'Late answer was accepted. That should never happen.' };
  } catch (err) {
    return {
      ok: false,
      blocked: true,
      reason: 'The question is closed. Writes are only allowed while it is open.',
      raw: codeOf(err)
    };
  }
}

// --- Connection control (Proof 4) -------------------------------------------

export function killConnection(): void {
  goOffline(db);
}

export function restoreConnection(): void {
  goOnline(db);
}

function codeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
