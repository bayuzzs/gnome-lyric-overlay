import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { LyricOverlayController } from './src/runtime/controller.js';

export default class LyricOverlayExtension extends Extension {
  /** @type {LyricOverlayController | null} */
  #controller = null;

  enable() {
    this.#controller ??= new LyricOverlayController(this);
    this.#controller.enable();
  }

  disable() {
    this.#controller?.disable();
    this.#controller = null;
  }
}
