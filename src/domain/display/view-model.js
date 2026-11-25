import { formatDisplayState, normalizeDisplayText } from './state.js';

/**
 * @import { DisplayState, FloatingEnvironment } from './types.js'
 * @import {
 *   FloatingLineCount,
 *   LyricOverlaySettings,
 *   TextAlign,
 *   TextColorMode,
 * } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   text: string,
 *   visible: boolean,
 *   maxWidth: number,
 *   textAlign: TextAlign,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   textShadowEnabled: boolean,
 * }>} PanelViewModel
 *
 * @typedef {Readonly<{
 *   visible: boolean,
 *   previousText: string,
 *   currentText: string,
 *   nextText: string,
 *   lineIndex: number,
 *   linesCount: FloatingLineCount,
 *   locked: boolean,
 *   animate: boolean,
 *   maxWidth: number,
 *   preserveWidth: boolean,
 *   showVinyl: boolean,
 *   showTrackInfo: boolean,
 *   showControls: boolean,
 *   showProgress: boolean,
 *   isPlaying: boolean,
 *   artUri: string | null,
 *   trackTitle: string,
 *   trackSubtitle: string,
 *   fontSize: number,
 *   bgOpacity: number,
 *   textAlign: TextAlign,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   secondaryOpacity: number,
 *   textShadowEnabled: boolean,
 *   xRatio: number,
 *   yRatio: number,
 *   monitorIndex: number,
 * }>} FloatingViewModel
 */

/**
 * Builds the view model for Fixed Top-Bar mode.
 *
 * @param {DisplayState} state
 * @param {LyricOverlaySettings} settings
 * @returns {PanelViewModel}
 */
export function buildPanelViewModel(state, settings) {
  const display = formatDisplayState(state, settings.fallbackMode);

  return {
    text: display.text,
    visible: settings.lyricsVisible && display.visible,
    maxWidth: settings.panelMaxWidth,
    textAlign: settings.textAlign,
    textColorMode: settings.textColorMode,
    customTextColor: settings.customTextColor,
    textShadowEnabled: settings.textShadowEnabled,
  };
}

/**
 * Builds the view model for Floating Overlay mode, applying all visibility
 * rules (master toggle, idle auto-hide, Overview, fullscreen, pause),
 * multi-line (1/2/3) slicing, spinning vinyl metadata, and playback state.
 *
 * @param {DisplayState} state
 * @param {LyricOverlaySettings} settings
 * @param {FloatingEnvironment} env
 * @returns {FloatingViewModel}
 */
export function buildFloatingViewModel(state, settings, env) {
  const display = formatDisplayState(state, settings.fallbackMode);
  const hiddenByState = state.kind === 'idle' || state.kind === 'hidden' || !display.visible;
  const hiddenByOverview = env.overviewVisible;
  const hiddenByFullscreen = settings.floatingHideFullscreen && env.inFullscreen;
  const hiddenByPause = settings.floatingHidePaused && env.playbackStatus === 'Paused';

  const visible =
    settings.lyricsVisible &&
    !hiddenByState &&
    !hiddenByOverview &&
    !hiddenByFullscreen &&
    !hiddenByPause;

  let previousText = '';
  let currentText = display.text;
  let nextText = '';
  let lineIndex = -1;

  if (state.kind === 'lyrics') {
    const normalizedCurrent = normalizeDisplayText(state.line);
    currentText = normalizedCurrent !== '' ? normalizedCurrent : display.text;
    lineIndex = typeof state.lineIndex === 'number' ? state.lineIndex : -1;
    if (settings.floatingLines >= 2) {
      nextText = normalizeDisplayText(state.nextLine);
    }
    if (settings.floatingLines >= 3) {
      previousText = normalizeDisplayText(state.previousLine);
    }
  }

  const trackTitle = normalizeDisplayText(env.trackTitle);
  const trackArtist = normalizeDisplayText(env.trackArtist);
  const trackAlbum = normalizeDisplayText(env.trackAlbum);
  const trackSubtitle = formatTrackSubtitle(trackArtist, trackAlbum);

  return {
    visible,
    previousText,
    currentText,
    nextText,
    lineIndex,
    linesCount: settings.floatingLines,
    locked: settings.floatingLocked,
    animate: settings.floatingAnimate,
    maxWidth: settings.floatingMaxWidth,
    preserveWidth: settings.floatingPreserveWidth,
    showVinyl: settings.floatingShowVinyl,
    showTrackInfo: settings.floatingShowTrackInfo,
    showControls: settings.floatingShowControls,
    showProgress: settings.floatingShowProgress,
    isPlaying: env.playbackStatus === 'Playing',
    artUri: env.artUri ?? null,
    trackTitle,
    trackSubtitle,
    fontSize: settings.floatingFontSize,
    bgOpacity: settings.floatingBgOpacity,
    textAlign: settings.textAlign,
    textColorMode: settings.textColorMode,
    customTextColor: settings.customTextColor,
    secondaryOpacity: settings.secondaryOpacity,
    textShadowEnabled: settings.textShadowEnabled,
    xRatio: settings.floatingXRatio,
    yRatio: settings.floatingYRatio,
    monitorIndex: settings.floatingMonitorIndex,
  };
}

/**
 * @param {string} artist
 * @param {string} album
 * @returns {string}
 */
function formatTrackSubtitle(artist, album) {
  if (artist !== '' && album !== '') {
    return `${artist} · ${album}`;
  }
  return artist || album;
}
