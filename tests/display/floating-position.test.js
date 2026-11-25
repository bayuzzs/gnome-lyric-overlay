import { describe, expect, it } from 'vitest';

import {
  clampOverlayCoordinates,
  computeOverlayCoordinates,
  computeRatiosFromCoordinates,
  computeResizedOverlay,
  findMonitorContainingPoint,
  getFloatingPresetRatios,
  resolveMonitorIndex,
} from '../../src/domain/display/floating-position.js';

describe('floating-position', () => {
  const workArea = { x: 0, y: 32, width: 1920, height: 1048 };

  it('centers overlay horizontally at xRatio=0.5 and stays inside workarea margins', () => {
    const coords = computeOverlayCoordinates({
      workArea,
      overlayWidth: 600,
      overlayHeight: 80,
      xRatio: 0.5,
      yRatio: 0.88,
      margin: 16,
    });

    expect(coords.x).toBe(660);
    expect(coords.y).toBeGreaterThan(800);
    expect(coords.y + 80).toBeLessThanOrEqual(workArea.y + workArea.height - 16);
  });

  it('round-trips coordinates to ratios and back cleanly', () => {
    const original = computeOverlayCoordinates({
      workArea,
      overlayWidth: 500,
      overlayHeight: 64,
      xRatio: 0.25,
      yRatio: 0.75,
      margin: 16,
    });

    const ratios = computeRatiosFromCoordinates({
      workArea,
      overlayWidth: 500,
      overlayHeight: 64,
      x: original.x,
      y: original.y,
      margin: 16,
    });

    expect(ratios.xRatio).toBeCloseTo(0.25, 2);
    expect(ratios.yRatio).toBeCloseTo(0.75, 2);
  });

  it('clamps out-of-bounds dragged coordinates inside the workarea', () => {
    const clamped = clampOverlayCoordinates({
      workArea,
      overlayWidth: 400,
      overlayHeight: 60,
      x: -200,
      y: 2000,
      margin: 16,
    });

    expect(clamped.x).toBe(16);
    expect(clamped.y).toBe(workArea.y + workArea.height - 60 - 16);
  });

  it('resolves monitor index safely when preferred monitor is disconnected', () => {
    expect(resolveMonitorIndex(-1, 1, 2)).toBe(1);
    expect(resolveMonitorIndex(1, 0, 2)).toBe(1);
    expect(resolveMonitorIndex(3, 0, 2)).toBe(0);
    expect(resolveMonitorIndex(0, 0, 0)).toBe(0);
  });

  it('finds monitor containing pointer coordinates across multi-monitor setups', () => {
    const monitors = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 2560, height: 1440 },
    ];
    expect(findMonitorContainingPoint(monitors, 100, 100, 0)).toBe(0);
    expect(findMonitorContainingPoint(monitors, 2500, 500, 0)).toBe(1);
    expect(findMonitorContainingPoint(monitors, -50, -50, 1)).toBe(1);
  });

  it('returns valid ratios for known presets and falls back to bottom-center', () => {
    expect(getFloatingPresetRatios('top-center')).toEqual({ xRatio: 0.5, yRatio: 0.06 });
    expect(getFloatingPresetRatios('unknown-preset')).toEqual(
      getFloatingPresetRatios('bottom-center'),
    );
  });

  it('resizes width from the right edge while anchoring the left edge and clamping to workarea', () => {
    expect(
      computeResizedOverlay({
        edge: 'right',
        startX: 600,
        startWidth: 640,
        deltaX: 100,
        minWidth: 280,
        maxWidth: 1600,
        workArea,
      }),
    ).toEqual({ x: 600, width: 740 });

    expect(
      computeResizedOverlay({
        edge: 'right',
        startX: 600,
        startWidth: 640,
        deltaX: -500,
        minWidth: 280,
        maxWidth: 1600,
        workArea,
      }),
    ).toEqual({ x: 600, width: 280 });
  });

  it('resizes width from the left edge while anchoring the right edge and clamping to workarea', () => {
    expect(
      computeResizedOverlay({
        edge: 'left',
        startX: 600,
        startWidth: 640,
        deltaX: -120,
        minWidth: 280,
        maxWidth: 1600,
        workArea,
      }),
    ).toEqual({ x: 480, width: 760 });

    expect(
      computeResizedOverlay({
        edge: 'left',
        startX: 100,
        startWidth: 640,
        deltaX: -300,
        minWidth: 280,
        maxWidth: 1600,
        workArea,
      }),
    ).toEqual({ x: 16, width: 724 });
  });
});
