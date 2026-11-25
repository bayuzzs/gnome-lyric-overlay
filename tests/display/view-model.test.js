import { describe, expect, it } from 'vitest';

import {
  buildFloatingViewModel,
  buildPanelViewModel,
} from '../../src/domain/display/view-model.js';
import { normalizeSettings } from '../../src/domain/settings/normalize.js';

describe('view-model', () => {
  const baseSettings = normalizeSettings({});
  const lyricsState = {
    kind: /** @type {const} */ ('lyrics'),
    previousLine: 'First line',
    line: 'Current line',
    nextLine: 'Next line',
    lineIndex: 1,
    track: { title: 'Song', artist: 'Artist' },
  };
  const normalEnv = {
    overviewVisible: false,
    inFullscreen: false,
    playbackStatus: 'Playing',
  };

  it('slices floating lines according to floatingLines (1, 2, or 3)', () => {
    const one = buildFloatingViewModel(
      lyricsState,
      { ...baseSettings, floatingLines: 1 },
      normalEnv,
    );
    expect(one.previousText).toBe('');
    expect(one.currentText).toBe('Current line');
    expect(one.nextText).toBe('');

    const two = buildFloatingViewModel(
      lyricsState,
      { ...baseSettings, floatingLines: 2 },
      normalEnv,
    );
    expect(two.previousText).toBe('');
    expect(two.currentText).toBe('Current line');
    expect(two.nextText).toBe('Next line');

    const three = buildFloatingViewModel(
      lyricsState,
      { ...baseSettings, floatingLines: 3 },
      {
        ...normalEnv,
        artUri: 'file:///tmp/art.img',
        trackTitle: 'About You',
        trackArtist: 'The 1975',
        trackAlbum: 'Being Funny In A Foreign Language',
      },
    );
    expect(three.previousText).toBe('First line');
    expect(three.currentText).toBe('Current line');
    expect(three.nextText).toBe('Next line');
    expect(three.lineIndex).toBe(1);
    expect(three.preserveWidth).toBe(true);
    expect(three.showVinyl).toBe(true);
    expect(three.showTrackInfo).toBe(true);
    expect(three.showControls).toBe(true);
    expect(three.isPlaying).toBe(true);
    expect(three.artUri).toBe('file:///tmp/art.img');
    expect(three.trackTitle).toBe('About You');
    expect(three.trackSubtitle).toBe('The 1975 · Being Funny In A Foreign Language');
  });

  it('auto-hides floating overlay when idle, in overview, fullscreen, paused, or globally hidden', () => {
    expect(buildFloatingViewModel({ kind: 'idle' }, baseSettings, normalEnv).visible).toBe(false);
    expect(
      buildFloatingViewModel(lyricsState, baseSettings, { ...normalEnv, overviewVisible: true })
        .visible,
    ).toBe(false);
    expect(
      buildFloatingViewModel(lyricsState, baseSettings, { ...normalEnv, inFullscreen: true })
        .visible,
    ).toBe(false);
    expect(
      buildFloatingViewModel(
        lyricsState,
        { ...baseSettings, floatingHideFullscreen: false },
        { ...normalEnv, inFullscreen: true },
      ).visible,
    ).toBe(true);
    expect(
      buildFloatingViewModel(lyricsState, baseSettings, {
        ...normalEnv,
        playbackStatus: 'Paused',
      }).visible,
    ).toBe(true);
    expect(
      buildFloatingViewModel(
        lyricsState,
        { ...baseSettings, floatingHidePaused: true },
        { ...normalEnv, playbackStatus: 'Paused' },
      ).visible,
    ).toBe(false);
    expect(
      buildFloatingViewModel(lyricsState, { ...baseSettings, lyricsVisible: false }, normalEnv)
        .visible,
    ).toBe(false);
  });

  it('builds panel view model respecting master lyricsVisible toggle', () => {
    const visible = buildPanelViewModel(lyricsState, baseSettings);
    expect(visible.visible).toBe(true);
    expect(visible.text).toBe('Current line');
    expect(visible.maxWidth).toBe(360);

    const hidden = buildPanelViewModel(lyricsState, { ...baseSettings, lyricsVisible: false });
    expect(hidden.visible).toBe(false);
  });
});
