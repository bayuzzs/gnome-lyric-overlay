import { describe, expect, it } from 'vitest';

import {
  computeProgressRatio,
  computeSeekFillMetrics,
  computeSeekPositionMs,
  formatTimeMs,
} from '../../src/domain/display/progress.js';

describe('display progress helpers', () => {
  it('formats milliseconds into m:ss and h:mm:ss timestamps', () => {
    expect(formatTimeMs(0)).toBe('0:00');
    expect(formatTimeMs(-500)).toBe('0:00');
    expect(formatTimeMs(84_900)).toBe('1:24');
    expect(formatTimeMs(326_490)).toBe('5:26');
    expect(formatTimeMs(3_661_000)).toBe('1:01:01');
  });

  it('computes clamped [0, 1] progress ratios', () => {
    expect(computeProgressRatio(50_000, 200_000)).toBe(0.25);
    expect(computeProgressRatio(300_000, 200_000)).toBe(1);
    expect(computeProgressRatio(-10, 200_000)).toBe(0);
    expect(computeProgressRatio(10_000, 0)).toBe(0);
  });

  it('computes clamped seek position from pointer X across the seekbar track', () => {
    expect(
      computeSeekPositionMs({
        pointerX: 250,
        trackLeftX: 100,
        trackWidth: 300,
        durationMs: 200_000,
      }),
    ).toBe(100_000);

    expect(
      computeSeekPositionMs({
        pointerX: 50,
        trackLeftX: 100,
        trackWidth: 300,
        durationMs: 200_000,
      }),
    ).toBe(0);

    expect(
      computeSeekPositionMs({
        pointerX: 600,
        trackLeftX: 100,
        trackWidth: 300,
        durationMs: 200_000,
      }),
    ).toBe(200_000);
  });

  it('computes seekbar fill width and clamped knob position', () => {
    expect(computeSeekFillMetrics(0, 200, 10)).toEqual({ fillWidth: 0, knobX: 0 });
    expect(computeSeekFillMetrics(0.5, 200, 10)).toEqual({ fillWidth: 100, knobX: 95 });
    expect(computeSeekFillMetrics(1, 200, 10)).toEqual({ fillWidth: 200, knobX: 190 });
  });
});
