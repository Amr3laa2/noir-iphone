import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { LoadingView } from '@/components/state-views';
import { VideoPlayer } from '@/components/video-player';
import { getDataLayer } from '@/db';
import { streamUrl } from '@/api/xtreamUrls';
import type { PlayContext, Section } from '@/api/types';

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    section: Section;
    id: string;
    ext: string;
    title: string;
    poster?: string;
    start?: string;
    src?: string;
  }>();

  const section = params.section;
  const id = params.id;
  const title = params.title ?? 'Now Playing';
  const isLive = section === 'live';
  const startSeconds = Number(params.start ?? 0) || 0;

  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Keep the latest position so we can persist on unmount as well.
  const latest = useRef({ position: startSeconds, duration: 0 });
  const ctxRef = useRef<PlayContext | null>(null);

  const localSrc = params.src && params.src.length > 0 ? params.src : null;

  // Resolve the stream URL from the active account (keeps credentials off the
  // navigation params — they never appear in route state or logs). When a local
  // file path is supplied (offline playback) we use it directly and skip the
  // account lookup entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let built: string;
      if (localSrc) {
        built = localSrc.startsWith('file://') ? localSrc : `file://${localSrc}`;
      } else {
        const data = await getDataLayer();
        const account = await data.accounts.getActive();
        if (!account) {
          setFailed(true);
          return;
        }
        if (cancelled) return;
        built = streamUrl(account, section, id, params.ext ?? 'mp4');
      }
      ctxRef.current = {
        contentType: section,
        streamId: id,
        title,
        poster: params.poster || undefined,
        url: built,
      };
      setUri(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [section, id, params.ext, params.poster, title, localSrc]);

  const persist = useCallback(async () => {
    if (isLive || !ctxRef.current) return;
    const { position, duration } = latest.current;
    if (position <= 0) return;
    const data = await getDataLayer();
    await data.history.record(ctxRef.current, position, duration);
  }, [isLive]);

  // Persist progress when leaving the screen.
  useEffect(() => {
    return () => {
      void persist();
    };
  }, [persist]);

  const onPosition = useCallback((position: number, duration: number) => {
    latest.current = { position, duration };
    // The throttled write is handled here so history reflects live progress.
    if (!isLive && ctxRef.current) {
      void getDataLayer().then((d) => d.history.record(ctxRef.current!, position, duration));
    }
  }, [isLive]);

  const close = useCallback(() => {
    void persist();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [persist, router]);

  // Surface playback/account failures via an alert, then leave the screen.
  // Done in an effect so we never trigger navigation during render.
  useEffect(() => {
    if (!failed) return;
    Alert.alert('Cannot play', 'This stream could not be started.', [
      { text: 'OK', onPress: close },
    ]);
  }, [failed, close]);

  if (failed) return null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      {uri ? (
        <VideoPlayer
          uri={uri}
          title={title}
          isLive={isLive}
          initialPositionSeconds={startSeconds}
          onPosition={onPosition}
          onClose={close}
          onError={() => setFailed(true)}
        />
      ) : (
        <LoadingView label="Connecting…" />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
