# RUN.md

Dead simple local run, plus deploy, plus the reset button for repeat demos.

## What you need once

- **Node 20 or newer** (check with `node -v`).
- **Java (JDK 11 or newer).** The Realtime Database and Firestore emulators are Java programs and will not start without it. Check with `java -version`. If it is missing, install Temurin / OpenJDK (https://adoptium.net) or `winget install EclipseAdoptium.Temurin.21.JDK` on Windows, then reopen the terminal.
- **Firebase CLI:** `npm install -g firebase-tools`.
- **Expo Go** on your phone (App Store or Play Store).
- **Same wifi:** the phone and the computer must be on the same network. The phone reaches the emulators over the computer's LAN IP (step 4 below).

> These five are the whole checklist. The most common first-run stumble is a missing Java, because the error it prints does not obviously say "install Java." If `firebase emulators:start` complains about the database or firestore emulator, it is almost always Java.

## Local run (the emulator path, zero cost)

Everything runs against the Firebase Emulator Suite. The project id is `demo-fairplay-trivia`, and Firebase treats any `demo-` project as emulator only, so there is no cloud account, no billing, and no keys to manage.

### 1. Install

```bash
cd functions && npm install && cd ..
cd app && npm install && cd ..
```

### 2. Start the backend

```bash
firebase emulators:start
```

Leave it running. The emulator UI is at http://localhost:4000. You will see the Realtime Database, Firestore, Auth, and Functions emulators come up.

### 3. Seed the questions

In a second terminal, with the emulators still running:

```bash
cd functions && npm run seed
```

This writes the five questions, including the correct answers, into Firestore where no client can read them.

### 4. Point the app at your computer and start it

Find your computer's LAN IP:

- Windows: `ipconfig`, look for IPv4 Address, for example `192.168.1.20`
- macOS: `ipconfig getifaddr en0`

Copy `app/.env.example` to `app/.env` and set:

```
EXPO_PUBLIC_EMULATOR_HOST=192.168.1.20
EXPO_PUBLIC_USE_EMULATOR=true
```

Then:

```bash
cd app && npm start
```

Scan the QR code with Expo Go. For a second player, scan it on a second phone, press `i` (iOS simulator) or `a` (Android emulator), or press `w` to open the app in a browser on this computer.

### Showing two players on one screen (no phone needed)

For a demo or a screen recording where you want everything visible at once, run two players in the browser on this same computer:

1. `cd app && npm start`, then press `w`. A browser tab opens with player one, for example at `http://localhost:8081`.
2. Open player two in an **incognito / private window** (Chrome or Edge: Ctrl+Shift+N), or in a **different browser**, at that same address. This matters: two normal windows of the same browser share sign-in storage, so they would become the same player. Incognito or a different browser gives player two its own identity.
3. Put the two windows side by side. Tap Start in one. The same question appears in both at once, and you can run the whole match, Referee View and all, on a single screen.

Your real phone can still join at the same time as a third player. This browser mode is a local preview only. It is not hosting the app anywhere, and it still talks to the emulator on this machine, so keep `EXPO_PUBLIC_EMULATOR_HOST=localhost` for the browser players.

> Why the LAN IP: on a phone, `localhost` means the phone itself, not your computer. The IP lets the phone reach the emulators running on your machine.

## Run a match

1. Both devices land on the join screen. Enter a name, tap Join.
2. On either device tap **Start match**.
3. The same question appears on both at once. Answer before the ring runs out.
4. Watch reveal, then standings, then the next question. Five questions, then final standings.

## Reset for the next demo

Two ways:

- In the app, at the end of a match tap **Reset to lobby** (or **Play again** to reset and immediately restart).
- Any time, call the `resetMatch` function. The in-app buttons already do this. It clears answers, reveal, scores, and the current question, and returns the room to the lobby.

To wipe everything including presence, stop the emulators (Ctrl+C) and start them again, then reseed.

## Deploy path (optional, "runs from anywhere")

The demo does not need this. Use it only if you want a link that works off your laptop.

1. Create a real Firebase project on the Blaze plan.
2. In the Google Cloud console for that project, set a **$1 budget alert**. Realistic demo cost is about $0.
3. `firebase use your-real-project-id`
4. `firebase deploy --only functions,database,firestore`
5. Seed the real project: unset `FIRESTORE_EMULATOR_HOST`, provide credentials, then `cd functions && npm run seed`.
6. In `app/.env` set `EXPO_PUBLIC_USE_EMULATOR=false` and fill in the seven `EXPO_PUBLIC_FIREBASE_*` values from your project's web app config.

The scheduling switches automatically. Local uses a timer inside the emulator (marked EMULATOR ONLY in the code). Deployed uses Cloud Tasks, which is the real "one authority ticking the clock".

## If something hiccups

- Emulators will not start, error mentions database or firestore: install Java (JDK 11+), see the checklist at the top. This is the number one first-run issue.
- Phone cannot reach the app: confirm phone and computer are on the same wifi, and that `EXPO_PUBLIC_EMULATOR_HOST` is your current LAN IP (it changes between networks).
- Questions do not appear: make sure you ran `npm run seed` after the emulators started.
- Nothing advances after a question: check the Functions emulator terminal for logs. The referee prints when it opens and closes each question.
