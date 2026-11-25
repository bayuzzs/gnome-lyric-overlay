import { normalizeRatio, normalizeSettings } from '../domain/settings/normalize.js';

/**
 * @import { LyricOverlaySettings } from '../domain/settings/types.js'
 * @import { LifecycleRegistry } from './lifecycle.js'
 *
 * @typedef {Readonly<{
 *   get_string(key: string): string,
 *   set_string?(key: string, value: string): boolean,
 *   get_int(key: string): number,
 *   set_int?(key: string, value: number): boolean,
 *   get_double(key: string): number,
 *   set_double?(key: string, value: number): boolean,
 *   get_strv(key: string): string[],
 *   get_boolean(key: string): boolean,
 *   set_boolean?(key: string, value: boolean): boolean,
 *   connect(signal: string, callback: () => void): number,
 *   disconnect(id: number): void,
 * }>} GSettingsBackend
 */

const SETTING_KEYS = [
  'display-mode',
  'lyrics-visible',
  'fallback-mode',
  'floating-locked',
  'floating-lines',
  'floating-x-ratio',
  'floating-y-ratio',
  'floating-monitor-index',
  'floating-max-width',
  'floating-preserve-width',
  'floating-show-vinyl',
  'floating-show-track-info',
  'floating-show-controls',
  'floating-font-size',
  'floating-bg-opacity',
  'floating-animate',
  'floating-hide-fullscreen',
  'floating-hide-paused',
  'panel-position',
  'panel-index',
  'panel-max-width',
  'text-align',
  'style-text-color-type',
  'style-text-color-custom',
  'style-secondary-opacity',
  'style-text-shadow',
  'lyrics-offset-ms',
  'player-priority',
  'browser-player-service',
  'cache-enabled',
  'debug-logging',
];

export class SettingsAdapter {
  #settings;
  #lifecycle;

  /**
   * @param {GSettingsBackend} settings
   * @param {LifecycleRegistry} lifecycle
   */
  constructor(settings, lifecycle) {
    this.#settings = settings;
    this.#lifecycle = lifecycle;
  }

  /**
   * @returns {LyricOverlaySettings}
   */
  read() {
    return normalizeSettings({
      displayMode: this.#settings.get_string('display-mode'),
      lyricsVisible: this.#settings.get_boolean('lyrics-visible'),
      fallbackMode: this.#settings.get_string('fallback-mode'),
      floatingLocked: this.#settings.get_boolean('floating-locked'),
      floatingLines: this.#settings.get_int('floating-lines'),
      floatingXRatio: this.#settings.get_double('floating-x-ratio'),
      floatingYRatio: this.#settings.get_double('floating-y-ratio'),
      floatingMonitorIndex: this.#settings.get_int('floating-monitor-index'),
      floatingMaxWidth: this.#settings.get_int('floating-max-width'),
      floatingPreserveWidth: this.#settings.get_boolean('floating-preserve-width'),
      floatingShowVinyl: this.#settings.get_boolean('floating-show-vinyl'),
      floatingShowTrackInfo: this.#settings.get_boolean('floating-show-track-info'),
      floatingShowControls: this.#settings.get_boolean('floating-show-controls'),
      floatingFontSize: this.#settings.get_int('floating-font-size'),
      floatingBgOpacity: this.#settings.get_int('floating-bg-opacity'),
      floatingAnimate: this.#settings.get_boolean('floating-animate'),
      floatingHideFullscreen: this.#settings.get_boolean('floating-hide-fullscreen'),
      floatingHidePaused: this.#settings.get_boolean('floating-hide-paused'),
      panelPosition: this.#settings.get_string('panel-position'),
      panelIndex: this.#settings.get_int('panel-index'),
      panelMaxWidth: this.#settings.get_int('panel-max-width'),
      textAlign: this.#settings.get_string('text-align'),
      textColorMode: this.#settings.get_string('style-text-color-type'),
      customTextColor: this.#settings.get_string('style-text-color-custom'),
      secondaryOpacity: this.#settings.get_int('style-secondary-opacity'),
      textShadowEnabled: this.#settings.get_boolean('style-text-shadow'),
      lyricsOffsetMs: this.#settings.get_int('lyrics-offset-ms'),
      playerPriority: this.#settings.get_strv('player-priority'),
      browserPlayerService: this.#settings.get_string('browser-player-service'),
      cacheEnabled: this.#settings.get_boolean('cache-enabled'),
      debugLogging: this.#settings.get_boolean('debug-logging'),
    });
  }

  /**
   * @param {(settings: LyricOverlaySettings) => void} callback
   * @returns {void}
   */
  subscribe(callback) {
    for (const key of SETTING_KEYS) {
      const signalId = this.#settings.connect(`changed::${key}`, () => {
        callback(this.read());
      });
      this.#lifecycle.addSignal(
        () => this.#settings,
        () => signalId,
      );
    }
  }

  /**
   * @returns {void}
   */
  toggleDisplayMode() {
    const current = this.#settings.get_string('display-mode');
    this.#settings.set_string?.('display-mode', current === 'panel' ? 'floating' : 'panel');
  }

  /**
   * @returns {void}
   */
  toggleFloatingLocked() {
    const current = this.#settings.get_boolean('floating-locked');
    this.#settings.set_boolean?.('floating-locked', !current);
  }

  /**
   * @returns {void}
   */
  toggleLyricsVisible() {
    const current = this.#settings.get_boolean('lyrics-visible');
    this.#settings.set_boolean?.('lyrics-visible', !current);
  }

  /**
   * @param {number} xRatio
   * @param {number} yRatio
   * @param {number} monitorIndex
   * @returns {void}
   */
  setFloatingPosition(xRatio, yRatio, monitorIndex) {
    this.#settings.set_double?.('floating-x-ratio', normalizeRatio(xRatio, 0.5));
    this.#settings.set_double?.('floating-y-ratio', normalizeRatio(yRatio, 0.88));
    this.#settings.set_int?.('floating-monitor-index', Math.round(monitorIndex));
  }

  /**
   * Commits an edge-resized floating width along with the updated relative anchor
   * so the opposite edge stays pinned cleanly.
   *
   * @param {number} width
   * @param {number} xRatio
   * @param {number} yRatio
   * @param {number} monitorIndex
   * @returns {void}
   */
  setFloatingWidthAndPosition(width, xRatio, yRatio, monitorIndex) {
    const clampedWidth = Math.min(1600, Math.max(280, Math.round(width)));
    this.#settings.set_boolean?.('floating-preserve-width', true);
    this.#settings.set_int?.('floating-max-width', clampedWidth);
    this.setFloatingPosition(xRatio, yRatio, monitorIndex);
  }
}
