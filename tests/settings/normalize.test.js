import { describe, expect, it } from 'vitest';

import { normalizeSettings } from '../../src/domain/settings/normalize.js';

describe('normalizeSettings', () => {
  it('produces valid defaults for empty raw input', () => {
    const settings = normalizeSettings({});
    expect(settings.displayMode).toBe('floating');
    expect(settings.lyricsVisible).toBe(true);
    expect(settings.floatingLocked).toBe(false);
    expect(settings.floatingLines).toBe(2);
    expect(settings.floatingXRatio).toBe(0.5);
    expect(settings.floatingYRatio).toBe(0.88);
    expect(settings.floatingBgOpacity).toBe(55);
    expect(settings.floatingFontSize).toBe(18);
    expect(settings.floatingHideFullscreen).toBe(true);
    expect(settings.floatingHidePaused).toBe(false);
    expect(settings.textAlign).toBe('center');
  });

  it('clamps out-of-range numeric values and sanitizes invalid enums', () => {
    const settings = normalizeSettings({
      displayMode: 'invalid',
      floatingLines: 9,
      floatingXRatio: 5,
      floatingYRatio: -2,
      floatingBgOpacity: 150,
      floatingFontSize: 4,
      floatingMaxWidth: 9999,
      panelMaxWidth: 50,
      secondaryOpacity: 5,
      lyricsOffsetMs: -99999,
      customTextColor: 'not-a-hex',
    });

    expect(settings.displayMode).toBe('floating');
    expect(settings.floatingLines).toBe(3);
    expect(settings.floatingXRatio).toBe(1);
    expect(settings.floatingYRatio).toBe(0);
    expect(settings.floatingBgOpacity).toBe(100);
    expect(settings.floatingFontSize).toBe(12);
    expect(settings.floatingMaxWidth).toBe(1600);
    expect(settings.panelMaxWidth).toBe(120);
    expect(settings.secondaryOpacity).toBe(20);
    expect(settings.lyricsOffsetMs).toBe(-5000);
    expect(settings.customTextColor).toBe('#ffffff');
  });
});
