import { parseVodInfo, parseSeriesInfo } from '../xtreamInfo';

describe('parseVodInfo', () => {
  it('extracts title, plot, poster, extension and duration (HH:MM:SS)', () => {
    const raw = {
      info: {
        name: 'The Matrix',
        plot: 'A hacker learns the truth.',
        movie_image: 'http://h/p.jpg',
        genre: 'Sci-Fi',
        duration: '02:16:00',
        rating: '8.7',
      },
      movie_data: { name: 'The Matrix (1999)', container_extension: 'mkv' },
    };
    const d = parseVodInfo(raw);
    expect(d.title).toBe('The Matrix (1999)'); // movie_data.name preferred
    expect(d.plot).toContain('hacker');
    expect(d.poster).toBe('http://h/p.jpg');
    expect(d.extension).toBe('mkv');
    expect(d.durationSeconds).toBe(2 * 3600 + 16 * 60);
    expect(d.rating).toBe('8.7');
  });

  it('parses numeric-seconds duration and defaults gracefully', () => {
    expect(parseVodInfo({ info: { duration: '5400' } }).durationSeconds).toBe(5400);
    const d = parseVodInfo({}, 'Fallback');
    expect(d.title).toBe('Fallback');
    expect(d.extension).toBe('mp4');
    expect(d.durationSeconds).toBeUndefined();
  });

  it('tolerates garbage input', () => {
    expect(parseVodInfo(null).title).toBe('Movie');
    expect(parseVodInfo('nope').extension).toBe('mp4');
  });
});

describe('parseSeriesInfo', () => {
  const raw = {
    info: { name: 'Breaking Bad', plot: 'Chemistry teacher.', cover: 'c.jpg', genre: 'Drama' },
    episodes: {
      '2': [
        { id: '20', title: 'S2E1', container_extension: 'mp4', episode_num: '1' },
        { id: '21', title: 'S2E2', container_extension: 'mp4', episode_num: '2' },
      ],
      '1': [{ id: '10', title: 'Pilot', container_extension: 'mkv', episode_num: '1' }],
    },
  };

  it('normalises seasons in numeric order with their episodes', () => {
    const d = parseSeriesInfo(raw);
    expect(d.title).toBe('Breaking Bad');
    expect(d.poster).toBe('c.jpg');
    expect(d.seasons.map((s) => s.season)).toEqual(['1', '2']); // sorted
    expect(d.seasons[0].episodes[0]).toMatchObject({ id: '10', extension: 'mkv', season: '1' });
    expect(d.seasons[1].episodes).toHaveLength(2);
  });

  it('skips episodes without an id and non-array seasons', () => {
    const d = parseSeriesInfo({
      episodes: { '1': [{ title: 'no id' }, { id: '5', title: 'ok' }], '2': 'bad' },
    });
    expect(d.seasons).toHaveLength(1);
    expect(d.seasons[0].episodes).toHaveLength(1);
    expect(d.seasons[0].episodes[0].id).toBe('5');
  });

  it('falls back to a default title', () => {
    expect(parseSeriesInfo({}, 'Unknown').title).toBe('Unknown');
  });
});
