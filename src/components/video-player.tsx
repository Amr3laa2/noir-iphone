/**
 * Engine-isolated video player.
 *
 * Wraps `react-native-vlc-media-player` (libVLC) — chosen because IPTV streams
 * are MPEG-TS / RTSP / HLS that AVPlayer handles poorly. The screen talks to
 * this component through a small prop contract (`uri`, `initialPositionSeconds`,
 * `isLive`, `onPosition`), so the underlying engine can be swapped for
 * react-native-video later without touching callers.
 *
 * Resume/seek/throttle decisions come from the pure, unit-tested `playback`
 * module; this file is just the React + native glue + custom controls overlay.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import {
  clampSeek,
  formatTime,
  resumeFraction,
  shouldPersist,
  shouldResume,
} from '@/player/playback';

export interface VideoPlayerProps {
  uri: string;
  title: string;
  /** Resume point in seconds (ignored for live). */
  initialPositionSeconds?: number;
  isLive?: boolean;
  /** Throttled position reporter for watch-history persistence. */
  onPosition?: (positionSeconds: number, durationSeconds: number) => void;
  onClose?: () => void;
  onError?: () => void;
}

const SKIP = 15; // seconds for skip back/forward
const CONTROLS_HIDE_MS = 4000;

export function VideoPlayer({
  uri,
  title,
  initialPositionSeconds = 0,
  isLive = false,
  onPosition,
  onClose,
  onError,
}: VideoPlayerProps) {
  useKeepAwake();
  const playerRef = useRef<VLCPlayer>(null);
  const lastSavedAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resume can only be applied once we learn the duration (first progress tick).
  const resumeApplied = useRef(false);

  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [position, setPosition] = useState(0); // seconds
  const [duration, setDuration] = useState(0); // seconds

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scheduleHide]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const onProgress = useCallback(
    (e: { currentTime: number; duration: number }) => {
      // VLC reports seconds here (not ms).
      const pos = Math.max(0, e.currentTime);
      const dur = Math.max(0, e.duration);
      // Apply the resume seek once, now that duration is known.
      if (!resumeApplied.current && !isLive && dur > 0) {
        resumeApplied.current = true;
        if (shouldResume(initialPositionSeconds, dur)) {
          playerRef.current?.seek(resumeFraction(initialPositionSeconds, dur));
        }
      }
      setPosition(pos);
      setDuration(dur);
      setBuffering(false);
      const now = Date.now();
      if (onPosition && !isLive && shouldPersist(lastSavedAt.current, now)) {
        lastSavedAt.current = now;
        onPosition(pos, dur);
      }
    },
    [onPosition, isLive],
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (isLive || duration <= 0) return;
      const target = clampSeek((position + delta) / duration);
      playerRef.current?.seek(target);
      showControls();
    },
    [duration, position, isLive, showControls],
  );

  const togglePlay = useCallback(() => {
    setPaused((p) => !p);
    showControls();
  }, [showControls]);

  const fraction = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <View style={styles.container}>
      <VLCPlayer
        ref={playerRef}
        style={StyleSheet.absoluteFill}
        source={{ uri, initOptions: ['--network-caching=1500', '--rtsp-tcp'] }}
        paused={paused}
        playInBackground
        autoplay
        onProgress={onProgress}
        onBuffering={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => {
          setBuffering(false);
          onError?.();
        }}
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={showControls}>
        {buffering ? (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}

        {controlsVisible ? (
          <View style={styles.overlay}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable onPress={onClose} hitSlop={12}>
                <SymbolView name="chevron.down" tintColor="#fff" size={26} />
              </Pressable>
              <ThemedText type="smallBold" themeColor="text" numberOfLines={1} style={styles.title}>
                {title}
              </ThemedText>
              {isLive ? <View style={styles.liveBadge}><ThemedText type="small" style={styles.liveText}>LIVE</ThemedText></View> : null}
            </View>

            {/* Center transport */}
            <View style={styles.centerRow}>
              {!isLive ? (
                <Pressable onPress={() => seekBy(-SKIP)} hitSlop={12}>
                  <SymbolView name="gobackward.15" tintColor="#fff" size={40} />
                </Pressable>
              ) : null}
              <Pressable onPress={togglePlay} hitSlop={12} style={styles.playButton}>
                <SymbolView name={paused ? 'play.fill' : 'pause.fill'} tintColor="#fff" size={52} />
              </Pressable>
              {!isLive ? (
                <Pressable onPress={() => seekBy(SKIP)} hitSlop={12}>
                  <SymbolView name="goforward.15" tintColor="#fff" size={40} />
                </Pressable>
              ) : null}
            </View>

            {/* Bottom progress */}
            {!isLive ? (
              <View style={styles.bottomBar}>
                <ThemedText type="small" themeColor="text" style={styles.time}>
                  {formatTime(position)}
                </ThemedText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
                </View>
                <ThemedText type="small" themeColor="text" style={styles.time}>
                  {duration > 0 ? `-${formatTime(duration - position)}` : ''}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1, color: '#fff' },
  liveBadge: { backgroundColor: '#e0202b', borderRadius: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  liveText: { color: '#fff', fontWeight: '700' },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  playButton: { padding: Spacing.two },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  time: { color: '#fff', minWidth: 56, textAlign: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#3c87f7' },
});
