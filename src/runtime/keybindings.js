import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * @import { LifecycleRegistry } from './lifecycle.js'
 * @import { RuntimeLogger } from './logger.js'
 *
 * @typedef {Readonly<{
 *   onToggleMode: () => void,
 *   onToggleLock: () => void,
 *   onToggleVisible: () => void,
 * }>} KeybindingHandlers
 */

/** @type {readonly (readonly [string, keyof KeybindingHandlers])[]} */
const SHORTCUT_KEYS = [
  ['shortcut-toggle-mode', 'onToggleMode'],
  ['shortcut-toggle-lock', 'onToggleLock'],
  ['shortcut-toggle-visible', 'onToggleVisible'],
];

export class KeybindingManager {
  #gsettings;
  #lifecycle;
  #logger;

  /**
   * @param {any} gsettings
   * @param {LifecycleRegistry} lifecycle
   * @param {{ logger?: RuntimeLogger | undefined }} [options]
   */
  constructor(gsettings, lifecycle, options = {}) {
    this.#gsettings = gsettings;
    this.#lifecycle = lifecycle;
    this.#logger = options.logger ?? null;
  }

  /**
   * @param {KeybindingHandlers} handlers
   * @returns {void}
   */
  register(handlers) {
    for (const [key, handlerName] of SHORTCUT_KEYS) {
      const handler = handlers[/** @type {keyof KeybindingHandlers} */ (handlerName)];
      try {
        Main.wm.addKeybinding(
          key,
          this.#gsettings,
          Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
          Shell.ActionMode.NORMAL,
          () => {
            this.#logger?.debug('shortcut-triggered', { key });
            handler();
          },
        );
        this.#lifecycle.add(() => {
          try {
            Main.wm.removeKeybinding(key);
          } catch {
            // keybinding already removed
          }
        });
      } catch (error) {
        this.#logger?.debug('shortcut-register-failed', { key, error: String(error) });
      }
    }
  }
}
