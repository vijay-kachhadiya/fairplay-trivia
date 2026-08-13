import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme, shadow } from '../theme';

export function JoinScreen({ onJoin, busy }: { onJoin: (name: string) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <View style={styles.markInner} />
        </View>
        <Text style={styles.brand}>FairPlay</Text>
      </View>
      <Text style={styles.tagline}>
        Every player gets the same question, at the same instant. Nobody cheats the clock.
      </Text>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>JOIN THE ROOM</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Vijay"
          placeholderTextColor={theme.textFaint}
          maxLength={40}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => trimmed && onJoin(trimmed)}
        />
        <Pressable
          style={[styles.btn, (!trimmed || busy) && styles.btnDisabled]}
          disabled={!trimmed || busy}
          onPress={() => onJoin(trimmed)}
        >
          {busy ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Text style={styles.btnText}>Join the room</Text>
          )}
        </Pressable>
        <Text style={styles.foot}>No account, no login. Each device joins as an anonymous player.</Text>
      </View>

      <View style={styles.proofRow}>
        <ProofChip label="No answer on the device" />
        <ProofChip label="Server owns the clock" />
        <ProofChip label="Scores are un-cheatable" />
      </View>
    </View>
  );
}

function ProofChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipDot} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  markInner: { width: 16, height: 16, borderRadius: 5, backgroundColor: theme.accent },
  brand: { color: theme.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: {
    color: theme.textDim,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 8
  },
  card: {
    ...shadow,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border
  },
  eyebrow: { color: theme.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 16 },
  label: { color: theme.textDim, fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16
  },
  btn: {
    backgroundColor: theme.primary,
    borderRadius: theme.radiusSm,
    paddingVertical: 16,
    alignItems: 'center'
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: theme.primaryText, fontSize: 16, fontWeight: '700' },
  foot: { color: theme.textFaint, fontSize: 12.5, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  proofRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusPill,
    paddingVertical: 7,
    paddingHorizontal: 12
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.good },
  chipText: { color: theme.textDim, fontSize: 12, fontWeight: '600' }
});
