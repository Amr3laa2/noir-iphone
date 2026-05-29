import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LoadingView } from '@/components/state-views';
import { getDataLayer } from '@/db';
import { getXtreamClient } from '@/api/client';
import { useActiveAccount } from '@/hooks/use-xtream';
import { useSession } from '@/state/session';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const account = useActiveAccount();
  const bumpAccount = useSession((s) => s.bumpAccount);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshMetadata = async () => {
    setBusy('refresh');
    try {
      const client = await getXtreamClient();
      let total = 0;
      for (const s of ['live', 'vod', 'series'] as const) {
        total += await client.refreshMetadata(s);
      }
      bumpAccount();
      Alert.alert('Cache cleared', `Removed ${total} cached entries. Fresh data will load next.`);
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const removeAccount = () => {
    if (!account.data) return;
    Alert.alert('Remove account?', 'This deletes the saved login from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const data = await getDataLayer();
          await data.accounts.remove(account.data!.id);
          bumpAccount();
          account.reload();
        },
      },
    ]);
  };

  if (account.loading) return <LoadingView />;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          {account.data ? (
            <>
              <Row label="Provider" value={account.data.name} />
              <Row label="Server" value={account.data.baseUrl} />
              <Row label="Username" value={account.data.username} />
              <Action label="Edit / replace account" onPress={() => router.push('/account')} />
              <Action label="Remove account" destructive onPress={removeAccount} />
            </>
          ) : (
            <Action label="Add IPTV account" onPress={() => router.push('/account')} />
          )}
        </Section>

        {account.data ? (
          <Section title="Data">
            <Action
              label={busy === 'refresh' ? 'Refreshing…' : 'Refresh metadata (clear cache)'}
              onPress={refreshMetadata}
              disabled={busy !== null}
            />
          </Section>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          Noir Mobile — credentials are stored locally on this device only.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          {children}
        </ThemedView>
      </View>
    );
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={styles.rowValue}>
          {value}
        </ThemedText>
      </View>
    );
  }

  function Action({
    label,
    onPress,
    destructive,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        <ThemedText
          type="small"
          style={{ color: destructive ? '#ff5a5a' : '#3c87f7', opacity: disabled ? 0.5 : 1 }}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionTitle: { marginLeft: Spacing.one },
  card: { borderRadius: Spacing.two, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  action: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  pressed: { opacity: 0.6 },
  footer: { textAlign: 'center', marginTop: Spacing.three },
});
