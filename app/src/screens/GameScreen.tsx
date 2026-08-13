import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { theme, shadow, shadowSm } from '../theme';
import { useMatch } from '../useMatch';
import { useServerTime } from '../useServerTime';
import { submitAnswer, startMatch, resetMatch } from '../api';
import { CountdownRing } from '../components/CountdownRing';
import { QuestionCard } from '../components/QuestionCard';
import { Leaderboard } from '../components/Leaderboard';
import { RefereeView } from '../components/RefereeView';

const PHASE_LABEL: Record<string, string> = {
  LOBBY: 'Lobby',
  QUESTION_OPEN: 'Answer now',
  QUESTION_CLOSED: 'Locked',
  REVEAL: 'Reveal',
  LEADERBOARD: 'Standings',
  MATCH_END: 'Match over'
};

export function GameScreen({ uid }: { uid: string }) {
  const {
    match,
    phase,
    currentQuestionId,
    currentQuestion,
    currentReveal,
    rawQuestionPayload,
    leaderboard,
    connectedCount
  } = useMatch();
  const { skewMs, setSkew, serverNow, deviceNow } = useServerTime();

  const [selected, setSelected] = useState<string | null>(null);
  const [submittedQid, setSubmittedQid] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [, setTick] = useState(0);
  const busyRef = useRef(false);

  // Drive the countdown and the live clocks. Every tick re-renders, which
  // recomputes the countdown and both clock strings below against fresh values.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  // New question means a fresh pick.
  useEffect(() => {
    setSelected(null);
  }, [currentQuestionId]);

  const durationMs = match?.durationMs ?? 12000;
  const startAt = match?.serverStartAt ?? null;
  const elapsed = startAt ? serverNow() - startAt : 0;
  const remainingMs = Math.max(0, durationMs - elapsed);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const fraction = durationMs ? remainingMs / durationMs : 0;

  const locked = phase !== 'QUESTION_OPEN' || submittedQid === currentQuestionId;
  const correctChoiceId = currentReveal?.correctChoiceId ?? null;
  const myResult = currentReveal?.perPlayerResult?.[uid] ?? null;
  const myTotal = leaderboard.find((r) => r.uid === uid)?.total ?? 0;

  async function pick(choiceId: string) {
    if (locked || !currentQuestionId || busyRef.current) return;
    busyRef.current = true;
    setSelected(choiceId);
    setSubmittedQid(currentQuestionId);
    try {
      // Note the deviceNow(): if the demo skew is on, this is a deliberately
      // wrong time. The server ignores it and stamps its own. See Proof 2.
      await submitAnswer(uid, currentQuestionId, choiceId, deviceNow());
    } catch {
      // Rejected (closed or already answered). Leave the pick shown; it will
      // simply not score. The Referee View is where we prove rejection on purpose.
    } finally {
      busyRef.current = false;
    }
  }

  async function handleStart() {
    try {
      await startMatch();
    } catch (err) {
      console.warn('startMatch failed', err);
    }
  }

  async function handleReset() {
    try {
      await resetMatch();
    } catch (err) {
      console.warn('resetMatch failed', err);
    }
  }

  // Recomputed every render (the 200ms tick above), so both clocks stay live.
  const serverClock = new Date(serverNow()).toLocaleTimeString();
  const deviceClock = new Date(deviceNow()).toLocaleTimeString();

  const totalQuestions = match?.totalQuestions ?? 5;
  const questionNumber = (match?.currentIndex ?? 0) + 1;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.phase}>{PHASE_LABEL[phase] || phase}</Text>
          <Text style={styles.presence}>{connectedCount} in the room</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.scoreWrap}>
            <Text style={styles.score}>{myTotal}</Text>
            <Text style={styles.scoreLabel}>POINTS</Text>
          </View>
          <Pressable style={styles.refBtn} onPress={() => setRefOpen(true)}>
            <Text style={styles.refBtnText}>Referee View</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {phase === 'LOBBY' ? (
          <Lobby onStart={handleStart} count={connectedCount} />
        ) : phase === 'MATCH_END' ? (
          <MatchEnd rows={leaderboard} meUid={uid} onReset={handleReset} onStart={handleStart} />
        ) : phase === 'LEADERBOARD' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.blockTitle}>Standings</Text>
            <Leaderboard rows={leaderboard} meUid={uid} />
          </View>
        ) : currentQuestion ? (
          <>
            <View style={styles.qMeta}>
              <Text style={styles.qCount}>
                Question {questionNumber} of {totalQuestions}
              </Text>
              {phase === 'QUESTION_OPEN' ? (
                <CountdownRing fraction={fraction} secondsLeft={secondsLeft} />
              ) : (
                <Text style={styles.lockedTag}>Locked</Text>
              )}
            </View>

            <QuestionCard
              prompt={currentQuestion.prompt}
              choices={currentQuestion.choices}
              selectedId={selected}
              locked={locked}
              correctChoiceId={correctChoiceId}
              myResult={myResult}
              onPick={pick}
            />

            {phase === 'REVEAL' && myResult ? (
              <View
                style={[
                  styles.resultBanner,
                  {
                    backgroundColor: myResult.correct ? theme.goodSoft : theme.badSoft,
                    borderColor: myResult.correct ? theme.good : theme.bad
                  }
                ]}
              >
                <Text style={[styles.resultText, { color: myResult.correct ? theme.good : theme.bad }]}>
                  {myResult.correct ? `+${myResult.awarded}` : 'No points'}
                  {myResult.correct && myResult.serverElapsedMs < durationMs * 0.4 ? '  (fast!)' : ''}
                </Text>
                <Text style={styles.resultSub}>Judged on server time, not your phone.</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.waiting}>Waiting for the server...</Text>
        )}
      </ScrollView>

      <Modal visible={refOpen} animationType="slide" onRequestClose={() => setRefOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.close}
                onPress={() => setRefOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close referee view"
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <RefereeView
              uid={uid}
              phase={phase}
              currentQuestionId={currentQuestionId}
              rawPayload={rawQuestionPayload as Record<string, unknown> | null}
              serverClock={serverClock}
              deviceClock={deviceClock}
              skewMs={skewMs}
              setSkew={setSkew}
              myResult={myResult}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Lobby({ onStart, count }: { onStart: () => void; count: number }) {
  return (
    <View style={styles.centerBlock}>
      <Text style={styles.blockTitle}>Ready when you are</Text>
      <Text style={styles.blockSub}>{count} player{count === 1 ? '' : 's'} in the room. Anyone can start.</Text>
      <Pressable style={styles.primaryBtn} onPress={onStart}>
        <Text style={styles.primaryBtnText}>Start match</Text>
      </Pressable>
    </View>
  );
}

function MatchEnd({
  rows,
  meUid,
  onReset,
  onStart
}: {
  rows: { uid: string; name: string; total: number }[];
  meUid: string;
  onReset: () => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.centerBlock}>
      <Text style={styles.blockTitle}>Final standings</Text>
      <Leaderboard rows={rows} meUid={meUid} />
      <Pressable style={styles.primaryBtn} onPress={onStart}>
        <Text style={styles.primaryBtnText}>Play again</Text>
      </Pressable>
      <Pressable style={styles.ghostBtn} onPress={onReset}>
        <Text style={styles.ghostBtnText}>Reset to lobby</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    ...shadowSm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  phase: { color: theme.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  presence: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreWrap: { alignItems: 'flex-end' },
  score: { color: theme.text, fontSize: 20, fontWeight: '800' },
  scoreLabel: { color: theme.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: -1 },
  refBtn: {
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: theme.radiusPill,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  refBtnText: { color: theme.accent, fontWeight: '700', fontSize: 13 },
  body: { padding: 20, paddingBottom: 40 },
  qMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  qCount: { color: theme.textDim, fontSize: 14, fontWeight: '600' },
  lockedTag: { color: theme.textDim, fontSize: 14, fontWeight: '700' },
  resultBanner: {
    marginTop: 18,
    borderRadius: theme.radius,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1
  },
  resultText: { fontSize: 26, fontWeight: '800' },
  resultSub: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  centerBlock: { paddingTop: 24, gap: 14 },
  blockTitle: { color: theme.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  blockSub: { color: theme.textDim, fontSize: 15, textAlign: 'center', marginBottom: 6 },
  primaryBtn: {
    ...shadowSm,
    backgroundColor: theme.primary,
    borderRadius: theme.radiusSm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10
  },
  primaryBtnText: { color: theme.primaryText, fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: theme.textDim, fontSize: 14, fontWeight: '600' },
  waiting: { color: theme.textDim, textAlign: 'center', paddingTop: 40 },
  modalSafe: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0
  },
  modal: { flex: 1, paddingHorizontal: 20 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 44,
    paddingTop: 4,
    paddingBottom: 4
  },
  close: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12
  },
  closeText: { color: theme.accent, fontWeight: '700', fontSize: 15 }
});
