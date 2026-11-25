import {
  DEFAULT_TEXT_SHADOW,
  STRONG_SUBTITLE_SHADOW,
  hexColorWithOpacity,
  resolveTextColor,
} from '../settings/appearance.js';

/**
 * @import { TextAlign, TextColorMode } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   maxWidth: number,
 *   textAlign: TextAlign,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   textShadowEnabled: boolean,
 * }>} PanelLabelStyleOptions
 *
 * @typedef {Readonly<{
 *   maxWidth: number,
 *   preserveWidth: boolean,
 *   bgOpacity: number,
 * }>} FloatingContainerStyleOptions
 *
 * @typedef {Readonly<{
 *   role: 'current' | 'secondary',
 *   fontSize: number,
 *   textAlign: TextAlign,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   secondaryOpacity: number,
 *   textShadowEnabled: boolean,
 *   bgOpacity: number,
 * }>} FloatingLineStyleOptions
 */

/**
 * Builds the inline CSS style string for the fixed Top-Bar label.
 *
 * @param {PanelLabelStyleOptions} options
 * @returns {string}
 */
export function buildPanelLabelStyleString(options) {
  let style = `width: ${options.maxWidth}px; min-width: 1px; text-align: ${options.textAlign};`;

  const color = resolveTextColor(options.textColorMode, options.customTextColor);
  if (color !== null) {
    style += ` color: ${color};`;
  }

  style += options.textShadowEnabled
    ? ` text-shadow: ${DEFAULT_TEXT_SHADOW};`
    : ' text-shadow: none;';

  return style;
}

/**
 * Builds the inline CSS style string for the floating overlay pill/container.
 * When `preserveWidth` is enabled, width is controlled directly on the actor
 * (`set_width`) so live edge-resizing never re-parses CSS on motion frames.
 * At bgOpacity === 0, renders as a transparent subtitle-style backdrop.
 *
 * @param {FloatingContainerStyleOptions} options
 * @returns {string}
 */
export function buildFloatingContainerStyle(options) {
  const widthPx = Math.max(240, Math.round(options.maxWidth));
  const opacity = Math.min(100, Math.max(0, Math.round(options.bgOpacity)));
  const sizeCss = options.preserveWidth ? '' : `max-width: ${widthPx}px; `;

  if (opacity === 0) {
    return `${sizeCss}background-color: transparent; border: 1px solid transparent; box-shadow: none;`;
  }

  const alpha = Number((opacity / 100).toFixed(2));
  const borderAlpha = Number(Math.min(0.24, alpha * 0.35).toFixed(2));
  const shadowAlpha = Number(Math.min(0.5, alpha * 0.65).toFixed(2));
  return (
    `${sizeCss}` +
    `background-color: rgba(14, 16, 22, ${alpha}); ` +
    `border: 1px solid rgba(255, 255, 255, ${borderAlpha}); ` +
    `box-shadow: 0px 8px 28px rgba(0, 0, 0, ${shadowAlpha});`
  );
}

/**
 * Builds the inline CSS style string for the circular album art inside the vinyl.
 * Uses explicit pixel lengths for `background-size` for desktop CSS compatibility.
 *
 * @param {string | null | undefined} artUri
 * @param {number} [sizePx]
 * @returns {string}
 */
export function buildVinylCoverStyle(artUri, sizePx = 30) {
  if (typeof artUri !== 'string' || artUri.trim() === '') {
    return '';
  }

  const size = Math.max(16, Math.round(sizePx));
  const escaped = artUri.trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `background-image: url("${escaped}"); background-size: ${size}px ${size}px;`;
}

/**
 * Builds the inline CSS style string for a floating overlay lyric line.
 *
 * @param {FloatingLineStyleOptions} options
 * @returns {string}
 */
export function buildFloatingLineStyle(options) {
  const isCurrent = options.role === 'current';
  const fontSize = isCurrent ? options.fontSize : Math.max(11, Math.round(options.fontSize * 0.78));
  let style = `font-size: ${fontSize}px; text-align: ${options.textAlign};`;

  const baseColor = resolveTextColor(options.textColorMode, options.customTextColor);
  if (isCurrent) {
    if (baseColor !== null) {
      style += ` color: ${baseColor};`;
    }
  } else {
    const dimmed = hexColorWithOpacity(baseColor, options.secondaryOpacity);
    if (dimmed !== null) {
      style += ` color: ${dimmed};`;
    }
  }

  if (options.textShadowEnabled) {
    const shadow = options.bgOpacity === 0 ? STRONG_SUBTITLE_SHADOW : DEFAULT_TEXT_SHADOW;
    style += ` text-shadow: ${shadow};`;
  } else {
    style += ' text-shadow: none;';
  }

  return style;
}
