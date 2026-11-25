import { selectLyricContext } from '../lyrics/lrc.js';

/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { LyricsProviderResult } from '../lyrics/types.js'
 * @import { DisplayState, DisplayTrack } from './types.js'
 *
 * @typedef {Readonly<{
 *   previousState?: DisplayState | null | undefined,
 * }>} DisplayLookupOptions
 */

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {LyricsProviderResult | null | undefined} lookup
 * @param {DisplayLookupOptions} [options]
 * @returns {DisplayState}
 */
export function displayStateFromLookup(player, lookup, options = {}) {
  if (player === null || player === undefined) {
    return { kind: 'idle' };
  }

  /** @type {DisplayTrack} */
  const track = { title: player.title, artist: player.artist };

  if (lookup === null || lookup === undefined) {
    return { kind: 'loading', track };
  }

  switch (lookup.kind) {
    case 'synced': {
      if (
        options.previousState?.kind === 'lyrics' &&
        sameDisplayTrack(options.previousState.track, track)
      ) {
        return options.previousState;
      }
      const first = extractInitialSyncedLines(lookup);
      return {
        kind: 'lyrics',
        line: first.current,
        previousLine: null,
        nextLine: first.next,
        lineIndex: first.index,
        track,
      };
    }
    case 'plain':
      return {
        kind: 'lyrics',
        line: extractFirstNonEmptyLine(lookup.text),
        previousLine: null,
        nextLine: null,
        lineIndex: 0,
        track,
      };
    case 'instrumental':
    case 'not-found':
      return { kind: 'track', track };
    case 'error':
      return { kind: 'error', track };
    default:
      return { kind: 'track', track };
  }
}

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
 * @param {number} positionMs
 * @returns {DisplayState}
 */
export function displayStateFromSyncedPosition(player, lookup, positionMs) {
  if (player === null || player === undefined) {
    return { kind: 'idle' };
  }

  /** @type {DisplayTrack} */
  const track = { title: player.title, artist: player.artist };
  const context = selectLyricContext(lookup.lines, positionMs);
  if (context.current !== null) {
    return {
      kind: 'lyrics',
      line: context.current.text,
      previousLine: context.previous?.text ?? null,
      nextLine: context.next?.text ?? null,
      lineIndex: context.index,
      track,
    };
  }

  return displayStateFromLookup(player, lookup);
}

/**
 * @param {DisplayTrack | null | undefined} left
 * @param {DisplayTrack} right
 * @returns {boolean}
 */
function sameDisplayTrack(left, right) {
  return left?.title === right.title && left?.artist === right.artist;
}

/**
 * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
 * @returns {{ current: string, next: string | null, index: number }}
 */
function extractInitialSyncedLines(lookup) {
  let firstIndex = -1;
  let firstText = '';

  for (let i = 0; i < lookup.lines.length; i += 1) {
    const line = lookup.lines[i];
    if (line !== undefined && line.text.trim() !== '') {
      firstIndex = i;
      firstText = line.text;
      break;
    }
  }

  if (firstIndex === -1) {
    return { current: extractFirstNonEmptyLine(lookup.plainText), next: null, index: -1 };
  }

  let nextText = null;
  for (let i = firstIndex + 1; i < lookup.lines.length; i += 1) {
    const line = lookup.lines[i];
    if (line !== undefined && line.text.trim() !== '') {
      nextText = line.text;
      break;
    }
  }

  return { current: firstText, next: nextText, index: firstIndex };
}

/**
 * @param {string} text
 * @returns {string}
 */
function extractFirstNonEmptyLine(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }
  return '';
}
