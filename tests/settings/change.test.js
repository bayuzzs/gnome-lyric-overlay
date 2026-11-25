import { describe, expect, it } from 'vitest';

import {
  shouldRefreshPlayerSelection,
  shouldRefreshSyncedLyrics,
  shouldRepositionPanelIndicator,
  shouldSwitchDisplayMode,
} from '../../src/domain/settings/change.js';
import { normalizeSettings } from '../../src/domain/settings/normalize.js';

describe('settings change detectors', () => {
  const base = normalizeSettings({});

  it('detects display mode transitions', () => {
    expect(shouldSwitchDisplayMode(base, { ...base, displayMode: 'panel' })).toBe(true);
    expect(shouldSwitchDisplayMode(base, { ...base })).toBe(false);
  });

  it('only repositions panel indicator when in panel mode', () => {
    expect(shouldRepositionPanelIndicator(base, { ...base, panelPosition: 'left' })).toBe(false);
    const panelBase = { ...base, displayMode: /** @type {const} */ ('panel') };
    expect(shouldRepositionPanelIndicator(panelBase, { ...panelBase, panelPosition: 'left' })).toBe(
      true,
    );
  });

  it('detects player priority and lyrics offset changes', () => {
    expect(shouldRefreshPlayerSelection(base, { ...base, playerPriority: ['vlc'] })).toBe(true);
    expect(shouldRefreshSyncedLyrics(base, { ...base, lyricsOffsetMs: 250 })).toBe(true);
  });
});
