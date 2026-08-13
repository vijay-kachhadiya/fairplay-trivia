# FairPlay Trivia

A small, runnable, server-authoritative live multiplayer trivia demo. Its whole job is to prove one thing, on a real phone: **the client renders, the server decides.**

This is not a product. It is a proof. Two players join one room, the same question appears for both at the same instant, and every decision that could be cheated (the answer key, the clock, the score) is made on the server, not the device. You can watch that happen with your own eyes inside the app.

> **Where it runs.** Built with Expo (React Native), so it runs on a phone through the Expo Go app, on an iOS or Android simulator, or in a local browser on your own machine. The browser mode is handy for showing two players side by side on one screen during a demo. It is a local preview, not a hosted website. Setup is in [RUN.md](RUN.md).

## Why this exists

Live trivia lives or dies on trust. If the answer ships to the phone, someone reads it from memory. If the phone judges its own timing, someone sets their clock back. If the phone writes its own score, someone writes a bigger one. The fix is not clever client code. It is moving every decision behind a boundary the phone cannot cross. This repo is that boundary, small enough to read in five minutes and real enough to run today.

## The one line the demo makes undeniable

The phone is given a question with no answer in it, a countdown drawn from the server's clock, and one locked shot at answering. The server opens and closes the question, checks the answer against a key the phone can never read, scores you on its own timestamp, and writes the leaderboard. Try to cheat any of it and the server says no, out loud, in the app.

## The three proofs

Open the **Referee View** (button, top right) during a live match and see each one for yourself.

1. **The answer is never on the wire.** While a question is open, the Referee View shows the exact raw data this device is holding: question id, prompt, choices, phase, server start time. There is no correct answer field in it. The phone does not have the answer while you are answering.
2. **The server owns the clock.** Tap "+30s" or "-30s" to make the phone lie about the time, then answer. Your score does not move. The Cloud Function scored you on the server's timestamp, not the one the phone claimed. The panel shows both, side by side.
3. **You cannot cheat the score.** Tap "Write a fake high score", "Answer twice", and "Answer after it closed". All three come back "Blocked by the server" with a plain reason. The app did not decide to block them. The Security Rules did.

There is a fourth, a stretch proof: "Kill connection" then "Reconnect" resyncs the app to the live question instead of a dead screen.

## Architecture, mapped one to one to the diagram

This demo is the architecture diagram compiled. Same boxes, same arrows.

| Diagram element | In this repo |
|---|---|
| One React Native codebase, iOS plus Android | Expo app in [`app/`](app/), single codebase, runs on a real phone through Expo Go with no native build |
| Realtime Database is the live state channel only | RTDB holds game phase, current question (prompt and choices, no answer), server start time, presence, reveal, leaderboard. Rules in [`database.rules.json`](database.rules.json) |
| Cloud Functions are the referee | [`functions/index.js`](functions/index.js) opens and closes each question, validates and scores on server time, writes the reveal and the leaderboard |
| Cloud Scheduler plus Cloud Tasks, one authority ticking the clock | On question open the referee schedules the close (Cloud Tasks in the production shape, a clearly marked local timer in the emulator) |
| Security Rules are the trust boundary | [`database.rules.json`](database.rules.json): a player writes their own answer once, only while the question is open, cannot read the answer key, cannot touch a score |
| Firestore is durable, server-only data | [`firestore.rules`](firestore.rules) denies all client access. Holds the answer key, the question bank, and match history |
| FCM plus APNs | Out of scope for this demo, noted as the next milestone, not built |

The load-bearing decision: **the correct answer lives in Firestore, server only.** The question the phone receives is a copy with the answer stripped out. Proofs 1 and 3 both rest on that one choice.

For the reasoning behind the code, the data model, the security rules, and how each proof is implemented, see [BUILD-NOTES.md](BUILD-NOTES.md).

## Project structure

```
fairplay-trivia/
  app/                       Expo client (React Native + TypeScript)
    App.tsx                  sign in, join the room, then the game
    src/
      firebase.ts            client setup, emulator wiring, anonymous auth
      config.ts              all runtime config, read from environment
      useMatch.ts            live subscription to the match (read only)
      useServerTime.ts       server clock offset, plus the demo skew control
      api.ts                 the one honest answer write, plus the cheat attempts
      screens/               JoinScreen, GameScreen
      components/            QuestionCard, CountdownRing, Leaderboard, RefereeView
  functions/
    index.js                 the referee: open and close a question, score on server time
    questionBank.js          the five questions (swap this one file to rebrand the game)
    seed.js                  load the question bank into Firestore
  database.rules.json        RTDB Security Rules, the trust boundary in code
  firestore.rules            Firestore locked to the server only
  firebase.json              emulator and rules configuration
  RUN.md                     step by step run guide
```

## Run it

Full detail, including the two-players-on-one-screen browser trick, is in [RUN.md](RUN.md). The short version, from the repo root:

```bash
# 1. install
cd functions && npm install && cd ..
cd app && npm install && cd ..

# 2. start the backend (emulators) and seed the questions
firebase emulators:start         # terminal 1, leave running
cd functions && npm run seed     # terminal 2, once, after emulators are up

# 3. start the app
cd app && npm start
```

Then run two players any way you like:

- **Two phones:** scan the QR with Expo Go on each. Set `EXPO_PUBLIC_EMULATOR_HOST` in `app/.env` to your computer's LAN IP so the phones can reach the emulator.
- **One screen, no phone:** press `w` for a browser tab (player one), then open a second player in an incognito window. Put them side by side and run the whole match on one screen.

Tap Start on one, and the same question lands on both at once.

> First-run note: the Firebase database and firestore emulators need **Java (JDK 11+)** installed. If `firebase emulators:start` complains, that is almost always a missing Java. See [RUN.md](RUN.md).

## Swap the questions in one file

The whole game is driven by one file: [`functions/questionBank.js`](functions/questionBank.js). Faith, sports, pop culture, corporate onboarding, a product launch quiz. Change the five questions, reseed, done. The engine does not care what the questions are about. The demo ships with neutral general knowledge on purpose.

## Cost and safety

- Runs fully on the local Firebase Emulator Suite, with a project id that starts with `demo-`, which needs no cloud account and costs nothing.
- No secrets in the repo. Configuration comes from `.env`, and `.env.example` shows the shape. Anonymous auth only.
- The production shape (a hosted, always-on version) would use Firebase Blaze and Cloud Tasks. The demo does not need any of that.

## What this is not

No accounts, no payments, no chat, no avatars, no push, no matchmaking. Every one of those was left out on purpose. The three proofs are the product. Everything else is a distraction from them.
