import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LoadingView, ErrorView } from '@/components/state-views';
import { getXtreamClient } from '@/api/client';
import { getDataLayer } from '@/db';
import { getDownloadManager } from '@/downloads';
import { streamUrl } from '@/api/xtreamUrls';
import { useAsync } from '@/hooks/use-async';
import { parseSeriesInfo, parseVodInfo, type Episode } from '@/api/xtreamInfo';
import type { PlayContext, Section } from '@/api/types';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/lib/navigation';
import { Spacing } from '@/constants/theme';

type DetailData =
  | { kind: 'vod'; title: string; plot?: string; poster?: string; genre?: string; rating?: string; releaseDate?: string; extension: string }
  | { kind: 'series'; title: string; plot?: string; poster?: string; genre?: string; seasons: { season: string; episodes: Episode[] }[] }
  | { kind: 'live'; title: string };

export default function DetailScreen() {
  const { section, id } = useLocalSearchParams<{ section: Section; id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [season, setSeason] = useState<string | null>(null);
  const [inList, setInList] = useState<boolean | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  const state = useAsync<DetailData>(async () => {
    const client = await getXtreamClient();
    // Reflect current watchlist membership + resume position.
    const data = await getDataLayer();
    setInList(await data.watchlist.has(section, id));
    const pos = await data.history.getPosition(section, id);
    if (pos) setResumeSeconds(pos.position);

    if (section === 'vod') {
      const d = parseVodInfo(await client.getVodInfo(id));
      return { kind: 'vod', ...d };
    }
    if (section === 'series') {
      const d = parseSeriesInfo(await client.getSeriesInfo(id));
      setSeason(d.seasons[0]?.season ?? null);
      return { kind: 'series', ...d };
    }
    return { kind: 'live', title: 'Live Channel' };
  }, [section, id]);

  const toggleList = useCallback(async () => {
    if (!state.data) return;
    const data = await getDataLayer();
    if (inList) {
      await data.watchlist.remove(section, id);
      setInList(false);
    } else {
      await data.watchlist.add(section, id, state.data.title, { name: state.data.title }, 'poster' in state.data ? state.data.poster : undefined);
      setInList(true);
    }
  }, [inList, section, id, state.data]);

  const playVod = () => {
    if (!state.data || state.data.kind !== 'vod') return;
    router.push(
      routes.player({
        section: 'vod',
        id,
        ext: state.data.extension,
        title: state.data.title,
        poster: state.data.poster,
        start: resumeSeconds,
      }),
    );
  };
  const playLive = () => {
    router.push(
      routes.player({ section: 'live', id, ext: 'ts', title: state.data?.title ?? 'Live' }),
    );
  };
  const playEpisode = (ep: Episode) => {
    router.push(
      routes.player({
        section: 'series',
        id: ep.id,
        ext: ep.extension,
        title: ep.title,
        poster: 'poster' in state.data! ? state.data!.poster : undefined,
      }),
    );
  };
  const play = () => (section === 'live' ? playLive() : playVod());

  // Resolve the stream URL from the active account and queue an offline copy.
  // Credentials stay on-device; the URL is persisted only in the downloads row.
  const enqueueDownload = async (
    contentType: Section,
    streamId: string,
    title: string,
    ext: string,
  ) => {
    const data = await getDataLayer();
    const account = await data.accounts.getActive();
    if (!account) {
      Alert.alert('Download', 'No active IPTV account.');
      return;
    }
    const url = streamUrl(account, contentType, streamId, ext);
    const ctx: PlayContext = {
      contentType,
      streamId,
      title,
      poster: 'poster' in state.data! ? state.data!.poster : undefined,
      url,
    };
    const mgr = await getDownloadManager();
    await mgr.enqueue(ctx, ext);
    Alert.alert('Download started', 'Track progress in the Downloads tab.');
  };

  const download = () => {
    if (!state.data || state.data.kind !== 'vod') return;
    void enqueueDownload('vod', id, state.data.title, state.data.extension);
  };
  const downloadEpisode = (ep: Episode) =>
    void enqueueDownload('series', ep.id, ep.title, ep.extension);

  if (state.loading) return <Screen><LoadingView /></Screen>;
  if (state.error || !state.data) {
    return (
      <Screen>
        <ErrorView error={state.error ?? new Error('Not found')} onRetry={state.reload} />
      </Screen>
    );
  }

  const d = state.data;
  const poster = 'poster' in d ? d.poster : undefined;

  return (
    <Screen title={d.title}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.poster, { backgroundColor: theme.backgroundElement }]} />
          )}
          <View style={styles.heroText}>
            <ThemedText type="subtitle" numberOfLines={3}>{d.title}</ThemedText>
            {d.kind === 'vod' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {[d.genre, d.releaseDate, d.rating ? `★ ${d.rating}` : null].filter(Boolean).join('  ·  ')}
              </ThemedText>
            ) : null}
            {d.kind === 'series' && d.genre ? (
              <ThemedText type="small" themeColor="textSecondary">{d.genre}</ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.buttons}>
          <Button label={resumeSeconds > 0 && section !== 'live' ? 'Resume' : 'Play'} primary onPress={play} />
          {d.kind !== 'series' ? <Button label="Download" onPress={download} /> : null}
          <Button label={inList ? 'In My List ✓' : 'My List'} onPress={toggleList} />
        </View>

        {'plot' in d && d.plot ? (
          <ThemedText type="small" style={styles.plot}>{d.plot}</ThemedText>
        ) : null}

        {d.kind === 'series' ? (
          <SeasonSection
            seasons={d.seasons}
            season={season}
            onSeason={setSeason}
            onPlayEpisode={playEpisode}
            onDownloadEpisode={downloadEpisode}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );

  function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: primary ? '#3c87f7' : theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: primary ? '#fff' : theme.text }}>{label}</ThemedText>
      </Pressable>
    );
  }
}

function SeasonSection({
  seasons,
  season,
  onSeason,
  onPlayEpisode,
  onDownloadEpisode,
}: {
  seasons: { season: string; episodes: Episode[] }[];
  season: string | null;
  onSeason: (s: string) => void;
  onPlayEpisode: (ep: Episode) => void;
  onDownloadEpisode: (ep: Episode) => void;
}) {
  const theme = useTheme();
  if (!seasons.length) return null;
  const current = seasons.find((s) => s.season === season) ?? seasons[0];

  return (
    <View style={styles.seasonSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonTabs}>
        {seasons.map((s) => {
          const active = s.season === current.season;
          return (
            <Pressable key={s.season} onPress={() => onSeason(s.season)}>
              <ThemedView
                type={active ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.seasonTab}>
                <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                  Season {s.season}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ScrollView>

      {current.episodes.map((ep) => (
        <View
          key={ep.id}
          style={[styles.episode, { borderColor: theme.backgroundElement }]}>
          <Pressable
            onPress={() => onPlayEpisode(ep)}
            style={({ pressed }) => [styles.episodeMain, pressed && styles.pressed]}>
            <ThemedText type="small" numberOfLines={1}>
              {ep.episodeNum ? `${ep.episodeNum}. ` : ''}{ep.title}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => onDownloadEpisode(ep)}
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}>
            <SymbolView name="arrow.down.circle" tintColor={theme.textSecondary} size={22} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Screen({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: title ?? '' }} />
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  hero: { flexDirection: 'row', gap: Spacing.three },
  poster: { width: 120, height: 180, borderRadius: Spacing.two },
  heroText: { flex: 1, gap: Spacing.two, justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  button: { flexGrow: 1, paddingVertical: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
  plot: { lineHeight: 20 },
  seasonSection: { gap: Spacing.two },
  seasonTabs: { gap: Spacing.two, paddingVertical: Spacing.one },
  seasonTab: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.four },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  episodeMain: { flex: 1 },
  pressed: { opacity: 0.7 },
});
