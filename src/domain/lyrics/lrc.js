const TIMESTAMP_PATTERN = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * @import { LyricLine } from './types.js'
 *
 * @typedef {Readonly<{
 *   previous: LyricLine | null,
 *   current: LyricLine | null,
 *   next: LyricLine | null,
 *   index: number,
 * }>} LyricContext
 */

/**
 * @param {string} input
 * @returns {LyricLine[]}
 */
export function parseLrc(input) {
  if (input.trim() === '') {
    return [];
  }

  /** @type {LyricLine[]} */
  const lines = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP_PATTERN)];
    if (timestamps.length === 0) {
      continue;
    }

    const text = rawLine.replace(TIMESTAMP_PATTERN, '').trim();

    for (const timestamp of timestamps) {
      const timeMs = parseTimestampMs(timestamp);
      if (timeMs === null) {
        continue;
      }

      lines.push({ timeMs, text });
    }
  }

  return lines.sort((left, right) => left.timeMs - right.timeMs);
}

/**
 * @param {readonly LyricLine[]} lines
 * @param {number} positionMs
 * @returns {LyricLine | null}
 */
export function selectLyricLine(lines, positionMs) {
  if (lines.length === 0) {
    return null;
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return null;
  }

  let current = null;
  for (const line of lines) {
    if (line.timeMs > positionMs) {
      break;
    }
    current = line;
  }

  return current;
}

/**
 * Selects the current lyric line along with its nearest non-empty previous and
 * next context lines for multi-line floating display.
 *
 * @param {readonly LyricLine[]} lines
 * @param {number} positionMs
 * @returns {LyricContext}
 */
export function selectLyricContext(lines, positionMs) {
  if (lines.length === 0 || !Number.isFinite(positionMs) || positionMs < 0) {
    return Object.freeze({ previous: null, current: null, next: null, index: -1 });
  }

  let currentIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || line.timeMs > positionMs) {
      break;
    }
    currentIndex = i;
  }

  if (currentIndex === -1) {
    return Object.freeze({
      previous: null,
      current: null,
      next: findNextNonEmpty(lines, 0),
      index: -1,
    });
  }

  const current = lines[currentIndex] ?? null;
  return Object.freeze({
    previous: findPreviousNonEmpty(lines, currentIndex - 1),
    current,
    next: findNextNonEmpty(lines, currentIndex + 1),
    index: currentIndex,
  });
}

/**
 * @param {readonly LyricLine[]} lines
 * @param {number} startIndex
 * @returns {LyricLine | null}
 */
function findPreviousNonEmpty(lines, startIndex) {
  for (let i = startIndex; i >= 0; i -= 1) {
    const candidate = lines[i];
    if (candidate !== undefined && candidate.text.trim() !== '') {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {readonly LyricLine[]} lines
 * @param {number} startIndex
 * @returns {LyricLine | null}
 */
function findNextNonEmpty(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const candidate = lines[i];
    if (candidate !== undefined && candidate.text.trim() !== '') {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {RegExpMatchArray} match
 * @returns {number | null}
 */
function parseTimestampMs(match) {
  const rawMinutes = match[1];
  const rawSeconds = match[2];
  if (rawMinutes === undefined || rawSeconds === undefined) {
    return null;
  }

  const minutes = Number.parseInt(rawMinutes, 10);
  const seconds = Number.parseInt(rawSeconds, 10);
  const fraction = match[3] ?? '0';

  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds > 59) {
    return null;
  }

  const fractionMs = parseFractionMs(fraction);
  return (minutes * 60 + seconds) * 1000 + fractionMs;
}

/**
 * @param {string} value
 * @returns {number}
 */
function parseFractionMs(value) {
  if (value.length === 1) {
    return Number.parseInt(value, 10) * 100;
  }

  if (value.length === 2) {
    return Number.parseInt(value, 10) * 10;
  }

  return Number.parseInt(value.slice(0, 3), 10);
}
