import {
  DEFAULT_CUSTOM_TEXT_COLOR,
  DEFAULT_TEXT_COLOR_MODE,
  DEFAULT_TEXT_SHADOW_ENABLED,
  isHexColor,
  isTextColorMode,
} from './appearance.js';

const DEFAULT_DISPLAY_MODE = 'floating';
const DEFAULT_FALLBACK_MODE = 'track';
const DEFAULT_FLOATING_LINES = 2;
const DEFAULT_FLOATING_X_RATIO = 0.5;
const DEFAULT_FLOATING_Y_RATIO = 0.88;
const DEFAULT_FLOATING_MONITOR_INDEX = -1;
const MIN_MONITOR_INDEX = -1;
const MAX_MONITOR_INDEX = 15;
const DEFAULT_FLOATING_MAX_WIDTH = 640;
const MIN_FLOATING_MAX_WIDTH = 280;
const MAX_FLOATING_MAX_WIDTH = 1600;
const DEFAULT_FLOATING_FONT_SIZE = 18;
const MIN_FLOATING_FONT_SIZE = 12;
const MAX_FLOATING_FONT_SIZE = 36;
const DEFAULT_FLOATING_BG_OPACITY = 55;
const DEFAULT_PANEL_POSITION = 'center';
const DEFAULT_PANEL_INDEX = 0;
const MIN_PANEL_INDEX = -1;
const MAX_PANEL_INDEX = 20;
const DEFAULT_PANEL_MAX_WIDTH = 360;
const MIN_PANEL_MAX_WIDTH = 120;
const MAX_PANEL_MAX_WIDTH = 720;
const DEFAULT_TEXT_ALIGN = 'center';
const DEFAULT_SECONDARY_OPACITY = 55;
const MIN_SECONDARY_OPACITY = 20;
const MAX_SECONDARY_OPACITY = 90;
const DEFAULT_LYRICS_OFFSET_MS = 0;
const MIN_LYRICS_OFFSET_MS = -5000;
const MAX_LYRICS_OFFSET_MS = 5000;
const DEFAULT_PLAYER_PRIORITY = ['spotify'];
const DEFAULT_BROWSER_PLAYER_SERVICE = 'auto';

const DISPLAY_MODES = new Set(['floating', 'panel']);
const PANEL_POSITIONS = new Set(['left', 'center', 'right']);
const FALLBACK_MODES = new Set(['track', 'idle', 'hidden']);
const BROWSER_PLAYER_SERVICES = new Set([
  'auto',
  'spotify',
  'youtube-music',
  'apple-music',
  'generic',
]);
const TEXT_ALIGNS = new Set(['left', 'center', 'right']);

/**
 * @import {
 *   BrowserPlayerService,
 *   DisplayMode,
 *   FallbackMode,
 *   FloatingLineCount,
 *   LyricOverlaySettings,
 *   PanelPosition,
 *   RawSettings,
 *   TextAlign,
 *   TextColorMode,
 * } from './types.js'
 */

/**
 * @param {RawSettings} raw
 * @returns {LyricOverlaySettings}
 */
export function normalizeSettings(raw) {
  return {
    displayMode: normalizeDisplayMode(raw.displayMode),
    lyricsVisible: normalizeBoolean(raw.lyricsVisible, true),
    fallbackMode: normalizeFallbackMode(raw.fallbackMode),
    floatingLocked: normalizeBoolean(raw.floatingLocked, false),
    floatingLines: normalizeFloatingLines(raw.floatingLines),
    floatingXRatio: normalizeRatio(raw.floatingXRatio, DEFAULT_FLOATING_X_RATIO),
    floatingYRatio: normalizeRatio(raw.floatingYRatio, DEFAULT_FLOATING_Y_RATIO),
    floatingMonitorIndex: clampInt(
      raw.floatingMonitorIndex,
      MIN_MONITOR_INDEX,
      MAX_MONITOR_INDEX,
      DEFAULT_FLOATING_MONITOR_INDEX,
    ),
    floatingMaxWidth: clampInt(
      raw.floatingMaxWidth,
      MIN_FLOATING_MAX_WIDTH,
      MAX_FLOATING_MAX_WIDTH,
      DEFAULT_FLOATING_MAX_WIDTH,
    ),
    floatingPreserveWidth: normalizeBoolean(raw.floatingPreserveWidth, true),
    floatingShowVinyl: normalizeBoolean(raw.floatingShowVinyl, true),
    floatingShowTrackInfo: normalizeBoolean(raw.floatingShowTrackInfo, true),
    floatingShowControls: normalizeBoolean(raw.floatingShowControls, true),
    floatingShowProgress: normalizeBoolean(raw.floatingShowProgress, true),
    floatingFontSize: clampInt(
      raw.floatingFontSize,
      MIN_FLOATING_FONT_SIZE,
      MAX_FLOATING_FONT_SIZE,
      DEFAULT_FLOATING_FONT_SIZE,
    ),
    floatingBgOpacity: clampInt(raw.floatingBgOpacity, 0, 100, DEFAULT_FLOATING_BG_OPACITY),
    floatingAnimate: normalizeBoolean(raw.floatingAnimate, true),
    floatingHideFullscreen: normalizeBoolean(raw.floatingHideFullscreen, true),
    floatingHidePaused: normalizeBoolean(raw.floatingHidePaused, false),
    panelPosition: normalizePanelPosition(raw.panelPosition),
    panelIndex: normalizePanelIndex(raw.panelIndex),
    panelMaxWidth: clampInt(
      raw.panelMaxWidth,
      MIN_PANEL_MAX_WIDTH,
      MAX_PANEL_MAX_WIDTH,
      DEFAULT_PANEL_MAX_WIDTH,
    ),
    textAlign: normalizeTextAlign(raw.textAlign),
    textColorMode: normalizeTextColorMode(raw.textColorMode),
    customTextColor: normalizeCustomTextColor(raw.customTextColor),
    secondaryOpacity: clampInt(
      raw.secondaryOpacity,
      MIN_SECONDARY_OPACITY,
      MAX_SECONDARY_OPACITY,
      DEFAULT_SECONDARY_OPACITY,
    ),
    textShadowEnabled: normalizeBoolean(raw.textShadowEnabled, DEFAULT_TEXT_SHADOW_ENABLED),
    lyricsOffsetMs: normalizeLyricsOffset(raw.lyricsOffsetMs),
    playerPriority: normalizePlayerPriority(raw.playerPriority),
    browserPlayerService: normalizeBrowserPlayerService(raw.browserPlayerService),
    cacheEnabled: normalizeBoolean(raw.cacheEnabled, true),
    debugLogging: normalizeBoolean(raw.debugLogging, false),
  };
}

/**
 * @param {unknown} value
 * @returns {DisplayMode}
 */
export function normalizeDisplayMode(value) {
  return typeof value === 'string' && DISPLAY_MODES.has(value)
    ? /** @type {DisplayMode} */ (value)
    : DEFAULT_DISPLAY_MODE;
}

/**
 * @param {unknown} value
 * @returns {FloatingLineCount}
 */
export function normalizeFloatingLines(value) {
  const clamped = clampInt(value, 1, 3, DEFAULT_FLOATING_LINES);
  return /** @type {FloatingLineCount} */ (clamped);
}

/**
 * @param {unknown} value
 * @returns {PanelPosition}
 */
export function normalizePanelPosition(value) {
  return typeof value === 'string' && PANEL_POSITIONS.has(value)
    ? /** @type {PanelPosition} */ (value)
    : DEFAULT_PANEL_POSITION;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizePanelIndex(value) {
  return clampInt(value, MIN_PANEL_INDEX, MAX_PANEL_INDEX, DEFAULT_PANEL_INDEX);
}

/**
 * @param {unknown} value
 * @returns {FallbackMode}
 */
export function normalizeFallbackMode(value) {
  return typeof value === 'string' && FALLBACK_MODES.has(value)
    ? /** @type {FallbackMode} */ (value)
    : DEFAULT_FALLBACK_MODE;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeLyricsOffset(value) {
  return clampInt(value, MIN_LYRICS_OFFSET_MS, MAX_LYRICS_OFFSET_MS, DEFAULT_LYRICS_OFFSET_MS);
}

/**
 * @param {unknown} value
 * @returns {readonly string[]}
 */
export function normalizePlayerPriority(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_PLAYER_PRIORITY;
  }

  const normalized = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');

  return [...new Set(normalized)];
}

/**
 * @param {unknown} value
 * @returns {BrowserPlayerService}
 */
export function normalizeBrowserPlayerService(value) {
  return typeof value === 'string' && BROWSER_PLAYER_SERVICES.has(value)
    ? /** @type {BrowserPlayerService} */ (value)
    : DEFAULT_BROWSER_PLAYER_SERVICE;
}

/**
 * @param {unknown} value
 * @returns {TextAlign}
 */
export function normalizeTextAlign(value) {
  return typeof value === 'string' && TEXT_ALIGNS.has(value)
    ? /** @type {TextAlign} */ (value)
    : DEFAULT_TEXT_ALIGN;
}

/**
 * @param {unknown} value
 * @returns {TextColorMode}
 */
export function normalizeTextColorMode(value) {
  return isTextColorMode(value) ? value : DEFAULT_TEXT_COLOR_MODE;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCustomTextColor(value) {
  return isHexColor(value) ? value.trim() : DEFAULT_CUSTOM_TEXT_COLOR;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function normalizeRatio(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}
