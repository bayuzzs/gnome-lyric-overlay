/**
 * @import { LyricOverlaySettings } from './types.js'
 */

/**
 * @param {LyricOverlaySettings} previous
 * @param {LyricOverlaySettings} next
 * @returns {boolean}
 */
export function shouldSwitchDisplayMode(previous, next) {
  return previous.displayMode !== next.displayMode;
}

/**
 * @param {LyricOverlaySettings} previous
 * @param {LyricOverlaySettings} next
 * @returns {boolean}
 */
export function shouldRefreshPlayerSelection(previous, next) {
  return (
    !sameStringList(previous.playerPriority, next.playerPriority) ||
    previous.browserPlayerService !== next.browserPlayerService
  );
}

/**
 * @param {LyricOverlaySettings} previous
 * @param {LyricOverlaySettings} next
 * @returns {boolean}
 */
export function shouldRepositionPanelIndicator(previous, next) {
  return (
    next.displayMode === 'panel' &&
    (previous.panelPosition !== next.panelPosition || previous.panelIndex !== next.panelIndex)
  );
}

/**
 * @param {LyricOverlaySettings} previous
 * @param {LyricOverlaySettings} next
 * @returns {boolean}
 */
export function shouldRefreshSyncedLyrics(previous, next) {
  return previous.lyricsOffsetMs !== next.lyricsOffsetMs;
}

/**
 * @param {readonly string[]} left
 * @param {readonly string[]} right
 * @returns {boolean}
 */
function sameStringList(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
