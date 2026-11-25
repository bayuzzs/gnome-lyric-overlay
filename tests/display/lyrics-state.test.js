import { describe, expect, it } from 'vitest';

import {
  displayStateFromLookup,
  displayStateFromSyncedPosition,
} from '../../src/domain/display/lyrics-state.js';

describe('display lyrics-state with multi-line context', () => {
  const player = {
    busName: 'org.mpris.MediaPlayer2.spotify',
    title: 'Track',
    artist: 'Artist',
    album: 'Album',
    durationMs: 200000,
    trackId: '/track/1',
    url: '',
    playbackStatus: /** @type {const} */ ('Playing'),
  };

  const syncedLookup = {
    kind: /** @type {const} */ ('synced'),
    track: { trackName: 'Track', artistName: 'Artist', albumName: 'Album', durationMs: 200000 },
    plainText: 'Line 1\nLine 2\nLine 3',
    lines: [
      { timeMs: 1000, text: 'Line 1' },
      { timeMs: 5000, text: '' },
      { timeMs: 8000, text: 'Line 2' },
      { timeMs: 12000, text: 'Line 3' },
    ],
  };

  it('populates previousLine and nextLine while skipping blank instrumental gaps', () => {
    const state = displayStateFromSyncedPosition(player, syncedLookup, 9000);
    expect(state).toEqual({
      kind: 'lyrics',
      line: 'Line 2',
      previousLine: 'Line 1',
      nextLine: 'Line 3',
      lineIndex: 2,
      track: { title: 'Track', artist: 'Artist' },
    });
  });

  it('extracts initial first and next lines from synced lookup', () => {
    const state = displayStateFromLookup(player, syncedLookup);
    expect(state).toEqual({
      kind: 'lyrics',
      line: 'Line 1',
      previousLine: null,
      nextLine: 'Line 2',
      lineIndex: 0,
      track: { title: 'Track', artist: 'Artist' },
    });
  });
});
