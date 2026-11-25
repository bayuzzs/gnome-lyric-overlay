/**
 * @typedef {'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right' | 'center'} FloatingPositionPreset
 *
 * @typedef {Readonly<{
 *   x: number,
 *   y: number,
 *   width: number,
 *   height: number,
 * }>} WorkArea
 *
 * @typedef {Readonly<{
 *   xRatio: number,
 *   yRatio: number,
 * }>} NormalizedPosition
 *
 * @typedef {Readonly<{
 *   x: number,
 *   y: number,
 * }>} OverlayCoordinates
 */

export const DEFAULT_OVERLAY_MARGIN_PX = 16;

/** @type {Readonly<Record<FloatingPositionPreset, NormalizedPosition>>} */
export const FLOATING_POSITION_PRESETS = Object.freeze({
  'bottom-center': Object.freeze({ xRatio: 0.5, yRatio: 0.88 }),
  'top-center': Object.freeze({ xRatio: 0.5, yRatio: 0.06 }),
  'bottom-left': Object.freeze({ xRatio: 0.04, yRatio: 0.88 }),
  'bottom-right': Object.freeze({ xRatio: 0.96, yRatio: 0.88 }),
  center: Object.freeze({ xRatio: 0.5, yRatio: 0.5 }),
});

/**
 * @param {string} preset
 * @returns {NormalizedPosition}
 */
export function getFloatingPresetRatios(preset) {
  if (Object.hasOwn(FLOATING_POSITION_PRESETS, preset)) {
    return FLOATING_POSITION_PRESETS[/** @type {FloatingPositionPreset} */ (preset)];
  }
  return FLOATING_POSITION_PRESETS['bottom-center'];
}

/**
 * Resolves a stored monitor index safely when monitors are added or removed.
 * Negative values always track the primary monitor.
 *
 * @param {number} preferredIndex
 * @param {number} primaryIndex
 * @param {number} monitorCount
 * @returns {number}
 */
export function resolveMonitorIndex(preferredIndex, primaryIndex, monitorCount) {
  if (monitorCount <= 0) {
    return 0;
  }

  if (preferredIndex >= 0 && preferredIndex < monitorCount) {
    return preferredIndex;
  }

  if (primaryIndex >= 0 && primaryIndex < monitorCount) {
    return primaryIndex;
  }

  return 0;
}

/**
 * Finds the monitor whose geometry contains (pointX, pointY), falling back to
 * primaryIndex when the point lies outside all monitor rectangles.
 *
 * @param {readonly WorkArea[]} monitors
 * @param {number} pointX
 * @param {number} pointY
 * @param {number} primaryIndex
 * @returns {number}
 */
export function findMonitorContainingPoint(monitors, pointX, pointY, primaryIndex) {
  for (let i = 0; i < monitors.length; i += 1) {
    const monitor = monitors[i];
    if (monitor === undefined) {
      continue;
    }
    if (
      pointX >= monitor.x &&
      pointX < monitor.x + monitor.width &&
      pointY >= monitor.y &&
      pointY < monitor.y + monitor.height
    ) {
      return i;
    }
  }

  return resolveMonitorIndex(-1, primaryIndex, monitors.length);
}

/**
 * Converts normalized (0..1) ratios into clamped pixel coordinates within a
 * monitor's usable workarea.
 *
 * @param {{
 *   workArea: WorkArea,
 *   overlayWidth: number,
 *   overlayHeight: number,
 *   xRatio: number,
 *   yRatio: number,
 *   margin?: number,
 * }} input
 * @returns {OverlayCoordinates}
 */
export function computeOverlayCoordinates(input) {
  const margin = input.margin ?? DEFAULT_OVERLAY_MARGIN_PX;
  const width = Math.max(0, input.overlayWidth);
  const height = Math.max(0, input.overlayHeight);

  const bounds = computeTravelBounds(input.workArea, width, height, margin);
  const rx = clampUnit(input.xRatio);
  const ry = clampUnit(input.yRatio);

  return {
    x: Math.round(bounds.minX + rx * (bounds.maxX - bounds.minX)),
    y: Math.round(bounds.minY + ry * (bounds.maxY - bounds.minY)),
  };
}

/**
 * Clamps arbitrary dragged pixel coordinates to stay inside the monitor workarea.
 *
 * @param {{
 *   workArea: WorkArea,
 *   overlayWidth: number,
 *   overlayHeight: number,
 *   x: number,
 *   y: number,
 *   margin?: number,
 * }} input
 * @returns {OverlayCoordinates}
 */
export function clampOverlayCoordinates(input) {
  const margin = input.margin ?? DEFAULT_OVERLAY_MARGIN_PX;
  const bounds = computeTravelBounds(
    input.workArea,
    Math.max(0, input.overlayWidth),
    Math.max(0, input.overlayHeight),
    margin,
  );

  return {
    x: Math.round(Math.min(bounds.maxX, Math.max(bounds.minX, input.x))),
    y: Math.round(Math.min(bounds.maxY, Math.max(bounds.minY, input.y))),
  };
}

/**
 * Converts committed pixel coordinates back into normalized (0..1) ratios.
 *
 * @param {{
 *   workArea: WorkArea,
 *   overlayWidth: number,
 *   overlayHeight: number,
 *   x: number,
 *   y: number,
 *   margin?: number,
 * }} input
 * @returns {NormalizedPosition}
 */
export function computeRatiosFromCoordinates(input) {
  const margin = input.margin ?? DEFAULT_OVERLAY_MARGIN_PX;
  const bounds = computeTravelBounds(
    input.workArea,
    Math.max(0, input.overlayWidth),
    Math.max(0, input.overlayHeight),
    margin,
  );

  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  return {
    xRatio: spanX > 0 ? roundRatio(clampUnit((input.x - bounds.minX) / spanX)) : 0.5,
    yRatio: spanY > 0 ? roundRatio(clampUnit((input.y - bounds.minY) / spanY)) : 0.5,
  };
}

/**
 * Computes new horizontal position and width when dragging the left or right
 * edge of the floating overlay, keeping the opposite edge anchored and clamped
 * within the monitor workarea.
 *
 * @param {{
 *   edge: 'left' | 'right',
 *   startX: number,
 *   startWidth: number,
 *   deltaX: number,
 *   minWidth: number,
 *   maxWidth: number,
 *   workArea: WorkArea,
 *   margin?: number,
 * }} input
 * @returns {{ x: number, width: number }}
 */
export function computeResizedOverlay(input) {
  const margin = input.margin ?? DEFAULT_OVERLAY_MARGIN_PX;
  const workLeft = input.workArea.x + margin;
  const workRight = input.workArea.x + input.workArea.width - margin;

  if (input.edge === 'right') {
    const maxAllowed = Math.max(input.minWidth, Math.min(input.maxWidth, workRight - input.startX));
    const width = Math.round(
      Math.min(maxAllowed, Math.max(input.minWidth, input.startWidth + input.deltaX)),
    );
    return { x: Math.round(input.startX), width };
  }

  const rightEdge = input.startX + input.startWidth;
  const maxAllowed = Math.max(input.minWidth, Math.min(input.maxWidth, rightEdge - workLeft));
  const width = Math.round(
    Math.min(maxAllowed, Math.max(input.minWidth, input.startWidth - input.deltaX)),
  );
  return { x: Math.round(rightEdge - width), width };
}

/**
 * @param {WorkArea} workArea
 * @param {number} width
 * @param {number} height
 * @param {number} margin
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function computeTravelBounds(workArea, width, height, margin) {
  const effectiveMarginX = Math.min(margin, Math.max(0, (workArea.width - width) / 2));
  const effectiveMarginY = Math.min(margin, Math.max(0, (workArea.height - height) / 2));
  const minX = workArea.x + effectiveMarginX;
  const maxX = Math.max(minX, workArea.x + workArea.width - width - effectiveMarginX);
  const minY = workArea.y + effectiveMarginY;
  const maxY = Math.max(minY, workArea.y + workArea.height - height - effectiveMarginY);
  return { minX, maxX, minY, maxY };
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampUnit(value) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * @param {number} value
 * @returns {number}
 */
function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}
