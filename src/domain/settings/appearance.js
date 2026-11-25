/**
 * @import { TextColorMode } from './types.js'
 */

/** @type {TextColorMode} */
export const DEFAULT_TEXT_COLOR_MODE = 'default';

export const DEFAULT_CUSTOM_TEXT_COLOR = '#ffffff';
export const DEFAULT_TEXT_SHADOW_ENABLED = true;
export const DEFAULT_TEXT_SHADOW = '0px 1px 3px rgba(0, 0, 0, 0.85)';
export const STRONG_SUBTITLE_SHADOW =
  '0px 2px 6px rgba(0, 0, 0, 0.95), 0px 0px 2px rgba(0, 0, 0, 0.9)';
export const WHITE_TEXT_COLOR = '#ffffff';
export const BLACK_TEXT_COLOR = '#000000';

/** @type {readonly TextColorMode[]} */
export const TEXT_COLOR_MODES = Object.freeze(['default', 'system', 'white', 'black', 'custom']);

export const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * @param {unknown} value
 * @returns {value is TextColorMode}
 */
export function isTextColorMode(value) {
  return (
    typeof value === 'string' && TEXT_COLOR_MODES.includes(/** @type {TextColorMode} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function textColorModeIndex(value) {
  return isTextColorMode(value) ? TEXT_COLOR_MODES.indexOf(value) : -1;
}

/**
 * Resolves a hex or preset color into a CSS color string, or null when the
 * active desktop theme color should be inherited.
 *
 * @param {TextColorMode} mode
 * @param {string} customHex
 * @returns {string | null}
 */
export function resolveTextColor(mode, customHex) {
  if (mode === 'default' || mode === 'white') {
    return WHITE_TEXT_COLOR;
  }
  if (mode === 'black') {
    return BLACK_TEXT_COLOR;
  }
  if (mode === 'custom' && isHexColor(customHex)) {
    return customHex.trim();
  }
  return null;
}

/**
 * Converts a 3- or 6-digit hex color and percentage opacity into an rgba(...)
 * CSS string so secondary lines stay color-matched to the user's active color.
 *
 * @param {string | null} hex
 * @param {number} opacityPercent
 * @returns {string | null}
 */
export function hexColorWithOpacity(hex, opacityPercent) {
  if (hex === null || !isHexColor(hex)) {
    return null;
  }

  const clean = hex.trim().slice(1);
  const full =
    clean.length === 3
      ? `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const alpha = Math.min(1, Math.max(0, opacityPercent / 100));
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
}
