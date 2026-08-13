// Subscribe to the live match state. Everything here is READ ONLY from the
// client's point of view. The phone listens; it never sets phase, never writes a
// score, never learns the answer early. The four nodes it reads:
//   matches/demo         phase, current question id, server start time, presence
//   questionsPublic/demo the answer-stripped question the phone is allowed to see
//   reveal/demo          correct answer + per player result, published only after close
//   scores/demo          running totals, written only by the server

import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from './firebase';
import { CONFIG } from './config';
import { MatchState, PublicQuestion, Reveal, ScoreRow } from './types';

const M = CONFIG.matchId;

export function useMatch() {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [questionsPublic, setQuestionsPublic] = useState<Record<string, PublicQuestion>>({});
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [scores, setScores] = useState<Record<string, { name?: string; total?: number }>>({});

  useEffect(() => {
    const subs = [
      onValue(ref(db, `matches/${M}`), (s) => setMatch(s.val())),
      onValue(ref(db, `questionsPublic/${M}`), (s) => setQuestionsPublic(s.val() || {})),
      onValue(ref(db, `reveal/${M}`), (s) => setReveals(s.val() || {})),
      onValue(ref(db, `scores/${M}`), (s) => setScores(s.val() || {}))
    ];
    return () => subs.forEach((off) => off());
  }, []);

  const currentQuestionId = match?.currentQuestionId ?? null;
  const currentQuestion = currentQuestionId ? questionsPublic[currentQuestionId] ?? null : null;
  const currentReveal = currentQuestionId ? reveals[currentQuestionId] ?? null : null;

  const leaderboard: ScoreRow[] = useMemo(() => {
    return Object.entries(scores)
      .map(([uid, row]) => ({ uid, name: row?.name || 'Player', total: row?.total || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [scores]);

  const players = useMemo(() => {
    const presence = match?.presence || {};
    return Object.entries(presence).map(([uid, p]) => ({ uid, ...p }));
  }, [match]);

  const connectedCount = players.filter((p) => p.connected).length;

  return {
    match,
    phase: match?.phase ?? 'LOBBY',
    currentQuestionId,
    currentQuestion,
    currentReveal,
    // The exact raw payload the device holds for the open question. The Referee
    // View renders this verbatim so anyone can see there is no answer in it.
    rawQuestionPayload: currentQuestion
      ? {
          questionId: currentQuestionId,
          prompt: currentQuestion.prompt,
          choices: currentQuestion.choices,
          index: currentQuestion.index,
          phase: match?.phase,
          serverStartAt: match?.serverStartAt ?? null,
          durationMs: match?.durationMs ?? null
        }
      : null,
    leaderboard,
    players,
    connectedCount
  };
}
