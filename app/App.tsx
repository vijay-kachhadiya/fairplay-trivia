import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, StatusBar as RNStatusBar, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from './src/theme';
import { ensureSignedIn } from './src/firebase';
import { joinRoom } from './src/api';
import { JoinScreen } from './src/screens/JoinScreen';
import { GameScreen } from './src/screens/GameScreen';

export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn()
      .then(setUid)
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  async function handleJoin(name: string) {
    if (!uid) return;
    setBusy(true);
    setError(null);
    try {
      await joinRoom(uid, name);
      setJoined(true);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!uid ? (
          <View style={styles.center}>
            <Text style={styles.loading}>Connecting...</Text>
          </View>
        ) : !joined ? (
          <JoinScreen onJoin={handleJoin} busy={busy} />
        ) : (
          <GameScreen uid={uid} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0
  },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: theme.textDim, fontSize: 16 },
  error: {
    color: theme.bad,
    backgroundColor: theme.badSoft,
    padding: 10,
    fontSize: 13,
    textAlign: 'center'
  }
});
