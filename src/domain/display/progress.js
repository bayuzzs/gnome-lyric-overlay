/**
 * Formats a millisecond timestamp as `m:ss` (or `h:mm:ss` when >= 1 hour).
 *
 * @param {number | null | undefined} ms
 * @returns {string}
 */
export function formatTimeMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

/**
 * Computes a clamped [0, 1] progress ratio from playback position and duration.
 *
 * @param {number | null | undefined} positionMs
 * @param {number | null | undefined} durationMs
 * @returns {number}
 */
export function computeProgressRatio(positionMs, durationMs) {
  if (
    typeof positionMs !== 'number' ||
    !Number.isFinite(positionMs) ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    return 0;
  }

  return Math.min(1, Math.max(0, positionMs / durationMs));
}

/**
 * Computes the target seek position in milliseconds from a pointer X coordinate
 * over the seekbar track.
 *
 * @param {{
 *   pointerX: number,
 *   trackLeftX: number,
 *   trackWidth: number,
 *   durationMs: number,
 * }} input
 * @returns {number}
 */
export function computeSeekPositionMs(input) {
  if (
    !Number.isFinite(input.trackWidth) ||
    input.trackWidth <= 0 ||
    !Number.isFinite(input.durationMs) ||
    input.durationMs <= 0
  ) {
    return 0;
  }

  const ratio = Math.min(1, Math.max(0, (input.pointerX - input.trackLeftX) / input.trackWidth));
  return Math.round(ratio * input.durationMs);
}

/**
 * Computes pixel fill width and knob X offset inside a progress track.
 *
 * @param {number} ratio
 * @param {number} trackWidth
 * @param {number} knobSize
 * @returns {{ fillWidth: number, knobX: number }}
 */
export function computeSeekFillMetrics(ratio, trackWidth, knobSize) {
  const safeWidth = Math.max(0, Math.round(trackWidth));
  const clampedRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const fillWidth = Math.round(clampedRatio * safeWidth);
  const maxKnobX = Math.max(0, safeWidth - knobSize);
  const knobX = Math.round(Math.min(maxKnobX, Math.max(0, fillWidth - knobSize / 2)));

  return { fillWidth, knobX };
}
