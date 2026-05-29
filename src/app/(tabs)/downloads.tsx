import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, ErrorView, LoadingView } from '@/components/state-views';
import { getDownloadManager } from '@/downloads';
import type { DownloadRecord } from '@/db/downloadStore';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/lib/navigation';
import { Spacing } from '@/constants/theme';
import type { Section } from '@/api/types';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function extFromUrl(url: string): string {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(url);
  return m ? m[1] : 'mp4';
}

export default function DownloadsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [version, setVersion] = useState(0);

  // Re-load the list whenever the manager reports a change (progress, done…).
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void getDownloadManager().then((mgr) => {
      unsub = mgr.subscribe(() => setVersion((v) => v + 1));
    });
    return () => unsub?.();
  }, []);

  const state = useAsync<DownloadRecord[]>(async () => {
    const mgr = await getDownloadManager();
    return mgr.list();
  }, [version]);

  const playOffline = useCallback(
    (rec: DownloadRecord) => {
      if (!rec.outputPath) return;
      router.push(
        routes.player({
          section: rec.contentType as Section,
          id: rec.streamId,
          ext: extFromUrl(rec.url),
          title: rec.title,
          poster: rec.context.poster,
          src: rec.outputPath,
        }),
      );
    },
    [router],
  );

  const onPause = useCallback(async (rec: DownloadRecord) => {
    (await getDownloadManager()).pause(rec.id);
  }, []);
  const onResume = useCallback(async (rec: DownloadRecord) => {
    (await getDownloadManager()).resume(rec.id);
  }, []);
  const onRetry = useCallback(async (rec: DownloadRecord) => {
    (await getDownloadManager()).enqueue(rec.context, extFromUrl(rec.url));
  }, []);
  const onRemove = useCallback((rec: DownloadRecord) => {
    Alert.alert('Remove download', `Delete "${rec.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void getDownloadManager().then((m) => m.remove(rec.id)),
      },
    ]);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScreenHeader
          title="Downloads"
          actions={[{ sf: 'gearshape', href: routes.settings(), label: 'Settings' }]}
        />
        {state.loading && !state.data ? (
          <LoadingView />
        ) : state.error ? (
          <ErrorView error={state.error} onRetry={state.reload} />
        ) : !state.data || state.data.length === 0 ? (
          <EmptyState
            title="No downloads yet"
            hint="Tap the download icon on a movie or episode to save it for offline viewing."
          />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {state.data.map((rec) => (
              <DownloadRow
                key={rec.id}
                rec={rec}
                theme={theme}
                onPlay={playOffline}
                onPause={onPause}
                onResume={onResume}
                onRetry={onRetry}
                onRemove={onRemove}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function DownloadRow({
  rec,
  theme,
  onPlay,
  onPause,
  onResume,
  onRetry,
  onRemove,
}: {
  rec: DownloadRecord;
  theme: ReturnType<typeof useTheme>;
  onPlay: (rec: DownloadRecord) => void;
  onPause: (rec: DownloadRecord) => void;
  onResume: (rec: DownloadRecord) => void;
  onRetry: (rec: DownloadRecord) => void;
  onRemove: (rec: DownloadRecord) => void;
}) {
  const pct = Math.round(rec.progress * 100);
  const subtitle =
    rec.status === 'done'
      ? `Downloaded · ${formatBytes(rec.totalBytes)}`
      : rec.status === 'error'
        ? (rec.error ?? 'Failed')
        : rec.status === 'paused'
          ? `Paused · ${pct}%`
          : rec.status === 'queued'
            ? 'Queued…'
            : `${pct}% · ${formatBytes(rec.downloadedBytes)} / ${formatBytes(rec.totalBytes)}`;

  return (
    <Pressable
      onPress={() => (rec.status === 'done' ? onPlay(rec) : undefined)}
      style={({ pressed }) => [styles.row, { borderColor: theme.backgroundElement }, pressed && rec.status === 'done' && styles.pressed]}>
      {rec.context.poster ? (
        <Image source={{ uri: rec.context.poster }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={styles.rowText}>
        <ThemedText type="small" numberOfLines={1}>{rec.title}</ThemedText>
        <ThemedText
          type="small"
          themeColor={rec.status === 'error' ? 'text' : 'textSecondary'}
          numberOfLines={1}
          style={styles.subtitle}>
          {subtitle}
        </ThemedText>
        {rec.status !== 'done' && rec.status !== 'error' ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(pct, 2)}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {rec.status === 'done' ? (
          <RowIcon name="play.circle.fill" tint="#3c87f7" onPress={() => onPlay(rec)} />
        ) : null}
        {rec.status === 'downloading' || rec.status === 'queued' ? (
          <RowIcon name="pause.circle" tint={theme.textSecondary} onPress={() => onPause(rec)} />
        ) : null}
        {rec.status === 'paused' ? (
          <RowIcon name="play.circle" tint={theme.textSecondary} onPress={() => onResume(rec)} />
        ) : null}
        {rec.status === 'error' ? (
          <RowIcon name="arrow.clockwise.circle" tint={theme.textSecondary} onPress={() => onRetry(rec)} />
        ) : null}
        <RowIcon name="trash" tint="#e0202b" onPress={() => onRemove(rec)} />
      </View>
    </Pressable>
  );
}

function RowIcon({ name, tint, onPress }: { name: SymbolViewProps['name']; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
      <SymbolView name={name} tintColor={tint} size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 54, height: 80, borderRadius: Spacing.one },
  rowText: { flex: 1, gap: Spacing.one },
  subtitle: {},
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(127,127,127,0.3)',
    overflow: 'hidden',
    marginTop: Spacing.half,
  },
  fill: { height: '100%', backgroundColor: '#3c87f7' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.6 },
});
