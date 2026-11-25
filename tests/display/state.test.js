import { describe, expect, it } from 'vitest';

import { formatDisplayState, formatTrackText } from '../../src/domain/display/state.js';

describe('formatDisplayState', () => {
  it('formats track, lyrics, idle, and hidden states', () => {
    expect(formatTrackText({ artist: 'A', title: 'B' })).toBe('A - B');
    expect(formatDisplayState({ kind: 'lyrics', line: 'Hello' }, 'track')).toEqual({
      text: 'Hello',
      visible: true,
    });
    expect(formatDisplayState({ kind: 'idle' }, 'hidden')).toEqual({
      text: '',
      visible: false,
    });
    expect(formatDisplayState({ kind: 'idle' }, 'idle')).toEqual({
      text: 'Lyric Overlay',
      visible: true,
    });
  });
});
