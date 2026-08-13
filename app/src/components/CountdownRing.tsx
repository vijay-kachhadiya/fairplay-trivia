// The countdown ring. It is drawn from SERVER time, not the phone clock. We pass
// in the remaining fraction computed against serverStartAt + durationMs using the
// Firebase server offset, so a phone with a wrong clock still shows the right ring.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

const SIZE = 132;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function CountdownRing({ fraction, secondsLeft }: { fraction: number; secondsLeft: number }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const color = secondsLeft <= 3 ? theme.bad : theme.accent;

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.border} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.num, { color }]}>{Math.max(0, secondsLeft)}</Text>
        <Text style={styles.label}>seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  num: { fontSize: 40, fontWeight: '800' },
  label: { color: theme.textDim, fontSize: 12, marginTop: -2 }
});
