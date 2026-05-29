import {
  formatTime,
  shouldResume,
  resumeFraction,
  clampSeek,
  toProgress,
  shouldPersist,
  PERSIST_INTERVAL_MS,
} from '../playback';

describe('formatTime', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(125)).toBe('2:05');
  });
  it('formats over an hour as H:MM:SS', () => {
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7325)).toBe('2:02:05');
  });
  it('guards against junk', () => {
    expect(formatTime(-10)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});

describe('shouldResume', () => {
  it('skips short watches and finished titles', () => {
    expect(shouldResume(10, 1000)).toBe(false); // < 30s
    expect(shouldResume(990, 1000)).toBe(false); // ~99% done
    expect(shouldResume(300, 1000)).toBe(true); // mid-watch
  });
  it('resumes when duration unknown but position meaningful', () => {
    expect(shouldResume(60, 0)).toBe(true);
  });
});

describe('resumeFraction', () => {
  it('maps position/duration into [0, 0.999]', () => {
    expect(resumeFraction(0, 1000)).toBe(0);
    expect(resumeFraction(500, 1000)).toBe(0.5);
    expect(resumeFraction(1000, 1000)).toBe(0); // finished → restart
    expect(resumeFraction(60, 0)).toBe(0); // unknown duration
  });
});

describe('clampSeek', () => {
  it('clamps to [0,1]', () => {
    expect(clampSeek(-1)).toBe(0);
    expect(clampSeek(2)).toBe(1);
    expect(clampSeek(0.3)).toBe(0.3);
    expect(clampSeek(NaN)).toBe(0);
  });
});

describe('toProgress', () => {
  it('converts ms to seconds with labels', () => {
    const p = toProgress({ currentTime: 65_000, duration: 125_000 });
    expect(p.positionSeconds).toBe(65);
    expect(p.durationSeconds).toBe(125);
    expect(p.fraction).toBeCloseTo(0.52, 2);
    expect(p.positionLabel).toBe('1:05');
    expect(p.remainingLabel).toBe('-1:00');
  });
  it('labels unknown-duration streams as LIVE', () => {
    const p = toProgress({ currentTime: 5000, duration: 0 });
    expect(p.fraction).toBe(0);
    expect(p.remainingLabel).toBe('LIVE');
  });
});

describe('shouldPersist', () => {
  it('throttles to the persist interval', () => {
    expect(shouldPersist(1000, 1000 + PERSIST_INTERVAL_MS - 1)).toBe(false);
    expect(shouldPersist(1000, 1000 + PERSIST_INTERVAL_MS)).toBe(true);
  });
});
