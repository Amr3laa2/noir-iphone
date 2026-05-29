import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/screen-header';
import { MediaRow } from '@/components/media-row';
import { PosterCard } from '@/components/poster-card';
import { LoadingView, ErrorView, EmptyState } from '@/components/state-views';
import { useHome, useActiveAccount } from '@/hooks/use-xtream';
import { itemId } from '@/api/xtreamItem';
import type { Section, XtreamItem } from '@/api/types';
import { routes } from '@/lib/navigation';
import { Spacing } from '@/constants/theme';

const HEADER_ACTIONS = [
  { sf: 'magnifyingglass' as const, href: routes.search(), label: 'Search' },
  { sf: 'gearshape' as const, href: routes.settings(), label: 'Settings' },
];

export default function HomeScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  const home = useHome();

  const open = (section: Section, item: XtreamItem, id: string | undefined) => {
    if (id) router.push(routes.details(section, id));
  };

  // No account configured yet → onboarding CTA.
  if (account.loading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }
  if (!account.data) {
    return (
      <Screen>
        <EmptyState
          title="No IPTV account yet"
          hint="Add your Xtream Codes login to start browsing."
        />
        <View style={styles.ctaWrap}>
          <ThemedText
            type="linkPrimary"
            onPress={() => router.push(routes.account())}
            style={styles.cta}>
            Add account
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen account={account.data.name}>
      {home.loading ? (
        <LoadingView label="Loading your library…" />
      ) : home.error ? (
        <ErrorView error={home.error} onRetry={home.reload} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={home.reload} />
          }>
          {home.data && home.data.continueWatching.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="smallBold" style={styles.heading}>
                Continue Watching
              </ThemedText>
              <FlatList
                horizontal
                data={home.data.continueWatching}
                keyExtractor={(c, i) => `${c.contentType}:${c.streamId}:${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowContent}
                renderItem={({ item }) => (
                  <PosterCard
                    title={item.title}
                    poster={item.poster}
                    width={120}
                    onPress={() => router.push(routes.details(item.contentType, item.streamId))}
                  />
                )}
              />
            </View>
          ) : null}

          {home.data?.featured ? (
            <MediaRow
              title="Featured"
              section="vod"
              items={[home.data.featured]}
              onPressItem={(item, id) => open('vod', item, id)}
            />
          ) : null}

          <MediaRow
            title="Recently Added Movies"
            section="vod"
            items={home.data?.recentMovies ?? []}
            onPressItem={(item, id) => open('vod', item, id)}
          />
          <MediaRow
            title="Recently Added Series"
            section="series"
            items={home.data?.recentSeries ?? []}
            onPressItem={(item, id) => open('series', item, id)}
          />
          <MediaRow
            title="Live Channels"
            section="live"
            items={home.data?.liveChannels ?? []}
            onPressItem={(item, id) => open('live', item, id)}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function Screen({ children, account }: { children: React.ReactNode; account?: string }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScreenHeader title={account ? `Hi — ${account}` : 'Noir'} actions={HEADER_ACTIONS} />
        <View style={styles.flex}>{children}</View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingVertical: Spacing.three },
  section: { marginBottom: Spacing.four },
  heading: { marginBottom: Spacing.two, paddingHorizontal: Spacing.three },
  rowContent: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  ctaWrap: { alignItems: 'center', paddingBottom: Spacing.five },
  cta: { padding: Spacing.three },
});
