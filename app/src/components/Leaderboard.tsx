import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, shadowSm } from '../theme';
import { ScoreRow } from '../types';

export function Leaderboard({ rows, meUid }: { rows: ScoreRow[]; meUid: string | null }) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>No scores yet.</Text>;
  }
  return (
    <View style={styles.wrap}>
      {rows.map((r, i) => {
        const isMe = r.uid === meUid;
        return (
          <View key={r.uid} style={[styles.row, isMe && styles.rowMe]}>
            <Text style={[styles.rank, i === 0 && styles.rankTop]}>{i + 1}</Text>
            <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
              {r.name}
              {isMe ? '  (you)' : ''}
            </Text>
            <Text style={styles.total}>{r.total}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  empty: { color: theme.textDim, textAlign: 'center', paddingVertical: 12 },
  row: {
    ...shadowSm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radiusSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.border
  },
  rowMe: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  rank: { width: 28, color: theme.textFaint, fontSize: 16, fontWeight: '800' },
  rankTop: { color: theme.gold },
  name: { flex: 1, color: theme.text, fontSize: 16, fontWeight: '600' },
  nameMe: { color: theme.text },
  total: { color: theme.text, fontSize: 18, fontWeight: '800' }
});
