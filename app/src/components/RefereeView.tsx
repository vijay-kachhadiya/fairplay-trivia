// THE MONEY PANEL.
//
// A non-technical viewer can read this. Three labeled proofs, each with a green
// or red status, plus the raw data the phone actually holds. This is where the
// pitch stops being words and becomes something you can see with your own eyes.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { theme, shadow } from '../theme';
import { PerPlayerResult, Phase } from '../types';
import {
  cheatFakeScore,
  cheatDoubleAnswer,
  cheatAnswerAfterClose,
  killConnection,
  restoreConnection,
  CheatResult
} from '../api';

interface Props {
  uid: string;
  phase: Phase;
  currentQuestionId: string | null;
  rawPayload: Record<string, unknown> | null;
  serverClock: string;
  deviceClock: string;
  skewMs: number;
  setSkew: (ms: number) => void;
  myResult: PerPlayerResult | null;
}

function StatusPill({ good, label }: { good: boolean; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: good ? theme.goodSoft : theme.badSoft }]}>
      <Text style={[styles.pillText, { color: good ? theme.good : theme.bad }]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function RefereeView(props: Props) {
  const { uid, phase, currentQuestionId, rawPayload, serverClock, deviceClock, skewMs, setSkew, myResult } = props;

  const [cheats, setCheats] = useState<Record<string, CheatResult>>({});
  const [connLabel, setConnLabel] = useState('Connected');

  const payloadHasAnswer =
    rawPayload != null && Object.keys(rawPayload).some((k) => k.toLowerCase().includes('correct'));
  const questionOpen = phase === 'QUESTION_OPEN';

  async function runCheat(key: string, fn: () => Promise<CheatResult>) {
    const result = await fn();
    setCheats((prev) => ({ ...prev, [key]: result }));
  }

  function CheatRow({ id, label, run }: { id: string; label: string; run: () => Promise<CheatResult> }) {
    const r = cheats[id];
    return (
      <View style={styles.cheatRow}>
        <Pressable style={styles.cheatBtn} onPress={() => runCheat(id, run)}>
          <Text style={styles.cheatBtnText}>{label}</Text>
        </Pressable>
        {r ? (
          <View style={styles.cheatResult}>
            <StatusPill good={r.blocked} label={r.blocked ? 'BLOCKED BY SERVER' : 'GOT THROUGH'} />
            <Text style={styles.cheatReason}>{r.reason}</Text>
          </View>
        ) : (
          <Text style={styles.cheatHint}>tap to try it</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.header}>Referee View</Text>
      <Text style={styles.sub}>The client renders. The server decides. Here is the proof.</Text>

      {/* PROOF 1 */}
      <Section title="Proof 1: the answer is never on the wire">
        <View style={styles.statusLine}>
          <StatusPill
            good={questionOpen ? !payloadHasAnswer : true}
            label={questionOpen ? (payloadHasAnswer ? 'ANSWER LEAKED' : 'NO ANSWER PRESENT') : 'WAITING'}
          />
          <Text style={styles.note}>
            {questionOpen
              ? 'This is the exact live data on this device right now.'
              : 'Open a question to inspect the live payload.'}
          </Text>
        </View>
        <View style={styles.code}>
          <Text style={styles.codeText}>
            {rawPayload ? JSON.stringify(rawPayload, null, 2) : '// no open question'}
          </Text>
        </View>
        <Text style={styles.note}>
          There is no correctChoiceId field. The correct answer lives in Firestore, server side, and only
          appears here after the question closes.
        </Text>
      </Section>

      {/* PROOF 2 */}
      <Section title="Proof 2: the server owns the clock">
        <View style={styles.clockRow}>
          <Text style={styles.clockLabel}>Device clock{skewMs !== 0 ? ' (skewed)' : ''}</Text>
          <Text style={[styles.clockVal, skewMs !== 0 && { color: theme.bad }]}>{deviceClock}</Text>
        </View>
        <View style={styles.clockRow}>
          <Text style={styles.clockLabel}>Server clock</Text>
          <Text style={[styles.clockVal, { color: theme.good }]}>{serverClock}</Text>
        </View>
        <View style={styles.clockRow}>
          <Text style={styles.clockLabel}>Judged on</Text>
          <Text style={[styles.clockVal, { color: theme.good }]}>server</Text>
        </View>

        <View style={styles.skewControls}>
          <SkewBtn label="-30s" active={skewMs === -30000} onPress={() => setSkew(-30000)} />
          <SkewBtn label="real" active={skewMs === 0} onPress={() => setSkew(0)} />
          <SkewBtn label="+30s" active={skewMs === 30000} onPress={() => setSkew(30000)} />
        </View>
        <Text style={styles.note}>
          Skew the phone clock, then answer. Your score does not move, because the Cloud Function scores on
          the server timestamp of your write, not on what the phone claimed.
        </Text>

        {myResult ? (
          <View style={styles.judgeBox}>
            <Text style={styles.judgeTitle}>Last answer, how it was judged</Text>
            <Text style={styles.judgeLine}>
              Phone claimed: {fmtMs(myResult.claimedElapsedMs)} after start
            </Text>
            <Text style={styles.judgeLine}>
              Server clocked: {fmtMs(myResult.serverElapsedMs)} after start
            </Text>
            <Text style={[styles.judgeLine, { color: theme.good, fontWeight: '700' }]}>
              Scored on server time. Awarded {myResult.awarded}.
            </Text>
          </View>
        ) : null}
      </Section>

      {/* PROOF 3 */}
      <Section title="Proof 3: you cannot cheat the score">
        <CheatRow id="fakeScore" label="Write a fake high score" run={() => cheatFakeScore(uid)} />
        <CheatRow
          id="double"
          label="Answer twice"
          run={() => cheatDoubleAnswer(uid, currentQuestionId || 'none')}
        />
        <CheatRow
          id="late"
          label="Answer after it closed"
          run={() => cheatAnswerAfterClose(uid, currentQuestionId || 'none')}
        />
        <Text style={styles.note}>
          Every rejection above comes from the Security Rules, the trust boundary written in code. The app did
          not decide to block these. The server did.
        </Text>
      </Section>

      {/* PROOF 4 (stretch) */}
      <Section title="Proof 4: drop and resync">
        <View style={styles.skewControls}>
          <Pressable
            style={styles.connBtn}
            onPress={() => {
              killConnection();
              setConnLabel('Offline');
            }}
          >
            <Text style={styles.connBtnText}>Kill connection</Text>
          </Pressable>
          <Pressable
            style={[styles.connBtn, { borderColor: theme.good }]}
            onPress={() => {
              restoreConnection();
              setConnLabel('Connected');
            }}
          >
            <Text style={[styles.connBtnText, { color: theme.good }]}>Reconnect</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Status: {connLabel}. On reconnect the app resyncs to the live question, no dead screen.</Text>
      </Section>
    </ScrollView>
  );
}

function SkewBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.skewBtn, active && styles.skewBtnActive]} onPress={onPress}>
      <Text style={[styles.skewBtnText, active && { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function fmtMs(ms: number | null): string {
  if (ms == null) return 'n/a';
  return `${(ms / 1000).toFixed(1)}s`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: theme.textDim, fontSize: 14, marginBottom: 16, marginTop: 4 },
  section: {
    ...shadow,
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 14
  },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 12, letterSpacing: -0.2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  note: { color: theme.textDim, fontSize: 13, lineHeight: 19, marginTop: 8 },
  code: {
    backgroundColor: theme.codeBg,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.codeBg,
    padding: 14
  },
  codeText: { color: theme.codeText, fontFamily: 'monospace' as const, fontSize: 12, lineHeight: 18 },
  clockRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  clockLabel: { color: theme.textDim, fontSize: 14 },
  clockVal: { color: theme.text, fontSize: 15, fontWeight: '700', fontFamily: 'monospace' as const },
  skewControls: { flexDirection: 'row', gap: 8, marginTop: 12 },
  skewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: theme.radiusSm,
    paddingVertical: 12,
    alignItems: 'center'
  },
  skewBtnActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  skewBtnText: { color: theme.textDim, fontWeight: '700' },
  judgeBox: {
    marginTop: 14,
    backgroundColor: theme.surfaceMuted,
    borderRadius: theme.radiusSm,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border
  },
  judgeTitle: { color: theme.text, fontWeight: '700', marginBottom: 8 },
  judgeLine: { color: theme.textDim, fontSize: 13, lineHeight: 20 },
  cheatRow: { marginBottom: 14 },
  cheatBtn: {
    backgroundColor: theme.badSoft,
    borderWidth: 1,
    borderColor: theme.badSoft,
    borderRadius: theme.radiusSm,
    paddingVertical: 13,
    alignItems: 'center'
  },
  cheatBtnText: { color: theme.bad, fontWeight: '700' },
  cheatHint: { color: theme.textFaint, fontSize: 12, marginTop: 6, textAlign: 'center' },
  cheatResult: { marginTop: 8, gap: 6, alignItems: 'flex-start' },
  cheatReason: { color: theme.textDim, fontSize: 13, lineHeight: 18 },
  connBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: theme.radiusSm,
    paddingVertical: 13,
    alignItems: 'center'
  },
  connBtnText: { color: theme.bad, fontWeight: '700' }
});
