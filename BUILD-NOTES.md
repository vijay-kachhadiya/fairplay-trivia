# BUILD-NOTES.md

Engineering notes for FairPlay Trivia. This is the reasoning behind the code: what the demo defends against, how each defense is built, and where to look. If you want the five minute tour before reading source, start here.

The whole system is organized around one sentence: **the client renders, the server decides.** Everything below is in service of making that literally true, not just a slogan.

---

## 1. The problem being solved

A live multiplayer trivia game has three things a player can attack:

1. **The answer.** If the correct choice reaches the device while the question is open, a determined player reads it out of memory or the network tab.
2. **The clock.** If the phone decides how fast you answered, a player slows or rewinds their own clock to look faster.
3. **The score.** If the phone writes its own score, a player writes a bigger one.

The naive fix is to obfuscate on the client. That never holds. The real fix is architectural: move all three decisions to a place the client cannot reach or forge, and let the client do nothing but render what it is told. That place is a Cloud Function plus a set of Security Rules, with the answer key living in a server-only store.

---

## 2. System shape

```
Player (Expo app)                 SERVER-AUTHORITATIVE ZONE
  read live state  ───────────>   Realtime Database (RTDB)
  write ONE answer ───────────>     phase, current question (no answer),
                                    serverStartAt, presence, reveal, scores
                                          ^                 |
                                          | writes          | listeners
                                          |                 v
                                    Cloud Functions (the referee)
                                    open/close question, score on server time
                                          |
                                          v
                                    Firestore (server only)
                                    answer key, question bank, match history
```

The client holds live listeners and renders. It is allowed exactly one write that matters, its own answer, and even that is fenced by rules. Every other write in the system comes from the referee.

Files:
- Client: [`app/`](app/) (Expo, React Native, TypeScript)
- Referee: [`functions/index.js`](functions/index.js)
- Trust boundary: [`database.rules.json`](database.rules.json), [`firestore.rules`](firestore.rules)

---

## 3. Data model and the one decision everything rests on

RTDB (readable by signed-in clients, writable only where noted):

```
/matches/{matchId}          phase, currentQuestionId, currentIndex, serverStartAt, durationMs
/matches/{matchId}/presence/{uid}   name, connected, joinedAt   (player writes own only)
/questionsPublic/{matchId}/{qid}    prompt, choices, index      (NO answer; read only)
/answers/{matchId}/{qid}/{uid}      choiceId, clientSubmitAt, serverWriteTime  (player writes own, once)
/reveal/{matchId}/{qid}             correctChoiceId, perPlayerResult   (server writes only)
/scores/{matchId}/{uid}             total, name                 (server writes only)
```

Firestore, denied to every client, touched only by the Admin SDK inside functions:

```
answerKeys/{matchId}_{qid}   { correctChoiceId }
questionBank/{qid}           { prompt, choices, correctChoiceId, index }
matchHistory/*               final scores, written at match end
```

**The load-bearing decision:** the correct answer lives in Firestore, server side. When the referee opens a question it publishes a *projection* to `questionsPublic` with the answer field removed, and separately writes the answer key to `answerKeys`, which no client can read. Proofs 1 and 3 both stand on this single split. If the answer were ever a field on the client-visible question, no amount of rules would save it.

---

## 4. The referee lifecycle

Everything time and score related happens in [`functions/index.js`](functions/index.js). The round is a small state machine:

```
LOBBY -> QUESTION_OPEN -> QUESTION_CLOSED -> REVEAL -> LEADERBOARD -> (next) ... -> MATCH_END
```

- `startMatch` (callable): resets the room, then calls `openQuestion(0)`.
- `openQuestion(i)` (internal): reads question i from Firestore, writes the answer-stripped projection to `questionsPublic`, writes the answer key to `answerKeys`, sets `phase = QUESTION_OPEN` and `serverStartAt = ServerValue.TIMESTAMP` (the server stamps the start, not the phone), then schedules the close.
- `closeQuestion(i)` (task target): sets `QUESTION_CLOSED`, reads every answer, fetches the correct choice from the server-only key, scores each answer on server time, writes `reveal` and updated `scores`, then walks REVEAL -> LEADERBOARD -> next question or MATCH_END.
- `resetMatch` (callable): wipes answers, reveal, scores, questions, back to LOBBY. Used for repeat demos.

### Scheduling: one authority ticks the clock

`scheduleClose` has two paths, chosen at runtime:

- **Production:** enqueue a Cloud Task (`getFunctions().taskQueue('closeQuestionTask')`) that fires `closeQuestionTask` after the delay. This is the real "Cloud Scheduler plus Cloud Tasks, one authority ticking the clock" from the architecture diagram.
- **Emulator:** a `setTimeout` inside the function process, clearly commented `EMULATOR ONLY`, because the Task Queue emulator does not honor scheduled delays.

The scheduler mechanism is not the proof. Server authority is. Whichever path runs, the question opens and closes on the server's timeline, and scoring reads the server's timestamps.

---

## 5. Server-authoritative time, and how scoring cannot be gamed

This is the subtle one, so it gets its own section.

When a player answers, the client writes three fields to `/answers/.../{uid}`:
- `choiceId` the pick,
- `clientSubmitAt` the time the phone *claims* it answered,
- `serverWriteTime` a server timestamp sentinel (`.sv: timestamp`).

The Security Rule for that node validates `serverWriteTime == now`, which forces the value to be the server's own clock at write time. The client cannot forge it; if it sends anything but the sentinel, the write is rejected.

At close, `closeQuestion` scores each answer as:

```
serverElapsedMs = clamp(answer.serverWriteTime - match.serverStartAt, 0, durationMs)
awarded         = correct ? BASE_POINTS + round(SPEED_POINTS * remainingFraction) : 0
```

It uses `serverWriteTime`. It never uses `clientSubmitAt`. The client-claimed time is stored only so the reveal can show it next to the server time and prove it was ignored. That is the entire content of Proof 2: you can lie in `clientSubmitAt` all you want, the score is computed from a timestamp the server wrote itself.

Client-side, [`app/src/useServerTime.ts`](app/src/useServerTime.ts) tracks the device-to-server clock delta from RTDB's `.info/serverTimeOffset`, so the countdown ring renders correctly even on a phone with a wrong clock. The demo "skew" control changes only the claimed `clientSubmitAt`, which is exactly the value the server throws away.

---

## 6. The trust boundary, in code

[`database.rules.json`](database.rules.json) is a deliverable, not an afterthought. The important clauses:

- **Answer write** `/answers/{m}/{q}/{uid}` is allowed only if all of these hold: `auth.uid === uid` (you write your own), `!data.exists()` (one shot, no overwrite), `phase === "QUESTION_OPEN"`, `currentQuestionId === q`, and `serverWriteTime == now`. A `$other` validator of `false` forbids any extra fields.
- **Scores and reveal** have no client write at all. Only the Admin SDK (the referee) writes them.
- **questionsPublic** is read only to clients. The answer key is in Firestore, which [`firestore.rules`](firestore.rules) denies to every client, read and write.
- **Presence** lets a player write only their own node.

Each of the three cheat attempts in Proof 3 fails against a specific one of these clauses, and the app surfaces the rejection in plain English.

---

## 7. The four proofs, and where each lives

**Proof 1, the answer is never on the wire.** The Referee View ([`app/src/components/RefereeView.tsx`](app/src/components/RefereeView.tsx)) renders the raw payload the device is holding for the open question, assembled in [`app/src/useMatch.ts`](app/src/useMatch.ts) as `{ questionId, prompt, choices, index, phase, serverStartAt, durationMs }`. There is no `correctChoiceId` in it, because the referee never put one there. A status pill checks the payload for any answer-like field and stays green.

**Proof 2, the server owns the clock.** The skew control and the side-by-side "phone claimed vs server clocked" readout, backed by the scoring logic in section 5. Answer with the clock skewed 30 seconds and the awarded points do not move.

**Proof 3, you cannot cheat the score.** Three real writes fired at the live database from [`app/src/api.ts`](app/src/api.ts):
- `cheatFakeScore` writes to `/scores`, rejected because clients cannot write scores.
- `cheatDoubleAnswer` writes a second answer, rejected by the one-shot `!data.exists()` clause.
- `cheatAnswerAfterClose` writes once the phase has moved on, rejected by the `phase === "QUESTION_OPEN"` clause.
Each rejection is caught and shown as "Blocked by the server" with the reason. These are not simulations. They are genuine writes that the rules refuse.

**Proof 4, drop and resync (stretch).** `killConnection` and `restoreConnection` in [`app/src/api.ts`](app/src/api.ts) call RTDB `goOffline` / `goOnline`. On disconnect, an `onDisconnect` handler marks presence disconnected; on reconnect, the live listeners in `useMatch` resync the app straight to the current phase and question, with no dead screen.

---

## 8. Notable decisions and tradeoffs

- **Firebase JS SDK, not react-native-firebase.** Chosen so the app runs in Expo Go with no native build, which is the fastest path to "it is on a phone right now." A production build would swap in react-native-firebase. That is a packaging choice; it does not touch the trust model. Noted honestly in the README.
- **A `demo-` project id.** Firebase treats any project id starting with `demo-` as emulator only, so a fresh clone runs the full backend with zero cloud setup and zero cost. This is why the demo has no secrets and no billing.
- **Cross-platform auth persistence.** [`app/src/firebase.ts`](app/src/firebase.ts) uses React Native storage on a phone and the browser default in a local browser, so the same app can also run as two browser windows side by side on one screen for a demo. Local browser only, not a hosted site.
- **One shared room, five questions.** Scope was kept ruthless. The round loop, the three proofs, and the trust boundary are the product. Everything else was left out on purpose (see section 9).
- **Answer key per match, not just in the question bank.** The referee copies the correct choice into `answerKeys/{matchId}_{qid}` on open and reads it on close. This mirrors the "durable server-only data" box in the diagram and keeps the read path off the source-of-truth bank.

---

## 9. Deliberately out of scope

No accounts or login screens, no payments, no chat, no avatars, no sound, no push notifications, no matchmaking beyond the one shared room, no store builds. Each of these was a conscious cut. The demo exists to prove fairness by construction, and anything that does not serve the three proofs is noise.

Push (FCM plus APNs) is drawn in the architecture as the next milestone, not built.

This is a proof, not a production system. It is built to make the trust model undeniable on a phone, not to run a live product at scale. The production version is a separate build, with the operational hardening and scale work a real deployment needs, done properly.

---

## 10. Verification

The build is checked:
- `node --check` on every function file, plus a module load with the real Firebase Admin and Functions dependencies, confirming all exports resolve.
- `tsc --noEmit` on the app, clean.
- `expo export` for both the native (iOS) and web targets, both bundling without error.

Running a full live match is the next step, and a normal one. It needs the Firebase Emulator Suite (which requires Java) plus a phone, a simulator, or a browser. [RUN.md](RUN.md) has the exact steps, the prerequisites, and the reset command. Run it there once before presenting it, so you have watched it work end to end.
