// The question card and the four choice buttons. After the question locks, the
// player's pick highlights, the correct answer turns green, and a wrong pick
// turns red. Before that, there is simply no answer to show, because the phone
// does not have it.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme, shadow, shadowSm } from '../theme';
import { Choice, PerPlayerResult } from '../types';

interface Props {
  prompt: string;
  choices: Choice[];
  selectedId: string | null;
  locked: boolean;
  correctChoiceId: string | null; // null until the server reveals it
  myResult: PerPlayerResult | null;
  onPick: (choiceId: string) => void;
}

export function QuestionCard({ prompt, choices, selectedId, locked, correctChoiceId, onPick }: Props) {
  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.prompt}>{prompt}</Text>
      </View>
      <View style={styles.choices}>
        {choices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = correctChoiceId === c.id;
          const isWrongPick = locked && isSelected && correctChoiceId != null && !isCorrect;

          let bg = theme.cardRaised;
          let border = theme.border;
          if (correctChoiceId != null && isCorrect) {
            bg = theme.goodSoft;
            border = theme.good;
          } else if (isWrongPick) {
            bg = theme.badSoft;
            border = theme.bad;
          } else if (isSelected) {
            bg = theme.accentSoft;
            border = theme.accent;
          }

          return (
            <Pressable
              key={c.id}
              disabled={locked}
              onPress={() => onPick(c.id)}
              style={[styles.choice, { backgroundColor: bg, borderColor: border }]}
            >
              <Text style={styles.choiceLabel}>{c.label}</Text>
              {isSelected ? <Text style={styles.tag}>your pick</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16
  },
  prompt: { color: theme.text, fontSize: 22, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3 },
  choices: { gap: 12 },
  choice: {
    ...shadowSm,
    borderRadius: theme.radiusSm,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  choiceLabel: { color: theme.text, fontSize: 17, fontWeight: '600' },
  tag: { color: theme.textDim, fontSize: 12, fontWeight: '600' }
});
