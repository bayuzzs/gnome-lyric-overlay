import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { getFloatingPresetRatios } from '../domain/display/floating-position.js';
import { normalizeLyricsOffset } from '../domain/settings/normalize.js';

/**
 * @typedef {Readonly<{
 *   openPreferences(): void,
 * }>} TrayExtensionHandle
 */

/** @type {readonly (readonly [string, string])[]} */
const POSITION_PRESET_ITEMS = [
  ['Bottom Center', 'bottom-center'],
  ['Top Center', 'top-center'],
  ['Bottom Left', 'bottom-left'],
  ['Bottom Right', 'bottom-right'],
  ['Center', 'center'],
];

class TrayIndicatorBase extends PanelMenu.Button {
  /**
   * @override
   * @param {any} settings
   * @param {any} extension
   */
  _init(settings, extension) {
    super._init(0.0, 'GNOME Lyric Overlay', false);

    this.add_style_class_name('lyric-overlay-tray-button');

    this._settings = settings;
    this._extension = extension;
    /** @type {Array<[any, number]>} */
    this._connections = [];
    this._syncingToggles = false;

    this._icon = new St.Icon({
      gicon: Gio.Icon.new_for_string('audio-x-generic-symbolic'),
      style_class: 'system-status-icon',
    });
    this.add_child(this._icon);

    // Display Mode
    this._floatingModeItem = new PopupMenu.PopupMenuItem('Floating Overlay');
    this._connect(this._floatingModeItem, 'activate', () => {
      settings.set_string('display-mode', 'floating');
    });

    this._panelModeItem = new PopupMenu.PopupMenuItem('Top Bar');
    this._connect(this._panelModeItem, 'activate', () => {
      settings.set_string('display-mode', 'panel');
    });

    this.menu.addMenuItem(this._floatingModeItem);
    this.menu.addMenuItem(this._panelModeItem);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Lock / Click-through & Show Lyrics toggles
    this._lockSwitchItem = new PopupMenu.PopupSwitchMenuItem(
      'Lock Overlay (Click-through)',
      settings.get_boolean('floating-locked'),
    );
    this._connect(
      this._lockSwitchItem,
      'toggled',
      /**
       * @param {unknown} _item
       * @param {boolean} active
       */
      (_item, active) => {
        if (!this._syncingToggles) {
          settings.set_boolean('floating-locked', active);
        }
      },
    );

    this._visibleSwitchItem = new PopupMenu.PopupSwitchMenuItem(
      'Show Lyrics',
      settings.get_boolean('lyrics-visible'),
    );
    this._connect(
      this._visibleSwitchItem,
      'toggled',
      /**
       * @param {unknown} _item
       * @param {boolean} active
       */
      (_item, active) => {
        if (!this._syncingToggles) {
          settings.set_boolean('lyrics-visible', active);
        }
      },
    );

    this.menu.addMenuItem(this._lockSwitchItem);
    this.menu.addMenuItem(this._visibleSwitchItem);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Quick Lyrics Offset Submenu
    this._offsetSubMenu = new PopupMenu.PopupSubMenuMenuItem(
      formatOffsetMenuLabel(settings.get_int('lyrics-offset-ms')),
      false,
    );
    this._addOffsetAction('-500 ms (Earlier)', -500);
    this._addOffsetAction('-250 ms (Earlier)', -250);
    const resetOffsetItem = new PopupMenu.PopupMenuItem('Reset Offset (0 ms)');
    this._connect(resetOffsetItem, 'activate', () => {
      settings.set_int('lyrics-offset-ms', 0);
    });
    this._offsetSubMenu.menu.addMenuItem(resetOffsetItem);
    this._addOffsetAction('+250 ms (Later)', 250);
    this._addOffsetAction('+500 ms (Later)', 500);
    this.menu.addMenuItem(this._offsetSubMenu);

    // Floating Position Presets Submenu
    this._positionSubMenu = new PopupMenu.PopupSubMenuMenuItem('Floating Position', false);
    for (const [label, presetId] of POSITION_PRESET_ITEMS) {
      const item = new PopupMenu.PopupMenuItem(label);
      this._connect(item, 'activate', () => {
        const ratios = getFloatingPresetRatios(presetId);
        settings.set_double('floating-x-ratio', ratios.xRatio);
        settings.set_double('floating-y-ratio', ratios.yRatio);
        settings.set_int('floating-monitor-index', -1);
      });
      this._positionSubMenu.menu.addMenuItem(item);
    }
    this.menu.addMenuItem(this._positionSubMenu);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Preferences
    this._prefsItem = new PopupMenu.PopupMenuItem('Preferences');
    this._connect(this._prefsItem, 'activate', () => {
      this._extension?.openPreferences();
    });
    this.menu.addMenuItem(this._prefsItem);

    // Sync menu state with GSettings changes (including shortcut triggers)
    this._syncFromSettings();
    for (const key of ['display-mode', 'floating-locked', 'lyrics-visible', 'lyrics-offset-ms']) {
      this._connect(settings, `changed::${key}`, () => {
        this._syncFromSettings();
      });
    }
  }

  /**
   * @param {string} label
   * @param {number} deltaMs
   * @returns {void}
   */
  _addOffsetAction(label, deltaMs) {
    const item = new PopupMenu.PopupMenuItem(label);
    this._connect(item, 'activate', () => {
      const next = normalizeLyricsOffset(this._settings.get_int('lyrics-offset-ms') + deltaMs);
      this._settings.set_int('lyrics-offset-ms', next);
    });
    this._offsetSubMenu?.menu.addMenuItem(item);
  }

  /**
   * @returns {void}
   */
  _syncFromSettings() {
    const mode = this._settings.get_string('display-mode');
    const isFloating = mode !== 'panel';
    const { Ornament } = PopupMenu;

    this._floatingModeItem?.setOrnament(isFloating ? Ornament.DOT : Ornament.NONE);
    this._panelModeItem?.setOrnament(isFloating ? Ornament.NONE : Ornament.DOT);

    this._syncingToggles = true;
    try {
      this._lockSwitchItem?.setToggleState(this._settings.get_boolean('floating-locked'));
      this._lockSwitchItem?.setSensitive(isFloating);
      this._visibleSwitchItem?.setToggleState(this._settings.get_boolean('lyrics-visible'));
    } finally {
      this._syncingToggles = false;
    }

    this._positionSubMenu?.setSensitive(isFloating);
    if (this._offsetSubMenu?.label) {
      this._offsetSubMenu.label.text = formatOffsetMenuLabel(
        this._settings.get_int('lyrics-offset-ms'),
      );
    }
  }

  /**
   * @param {any} target
   * @param {string} signal
   * @param {(...args: any[]) => void} callback
   * @returns {void}
   */
  _connect(target, signal, callback) {
    const id = target.connect(signal, callback);
    this._connections.push([target, id]);
  }

  /** @override */
  destroy() {
    for (const [target, id] of this._connections.splice(0)) {
      try {
        target.disconnect(id);
      } catch {
        // target already finalized
      }
    }

    this._icon = null;
    this._floatingModeItem = null;
    this._panelModeItem = null;
    this._lockSwitchItem = null;
    this._visibleSwitchItem = null;
    this._offsetSubMenu = null;
    this._positionSubMenu = null;
    this._prefsItem = null;
    this._settings = null;
    this._extension = null;
    super.destroy();
  }
}

export const TrayIndicator = /** @type {any} */ (GObject.registerClass(TrayIndicatorBase));

/**
 * @param {number} offsetMs
 * @returns {string}
 */
function formatOffsetMenuLabel(offsetMs) {
  if (offsetMs === 0) {
    return 'Lyrics Offset (0 ms)';
  }
  const sign = offsetMs > 0 ? '+' : '';
  return `Lyrics Offset (${sign}${offsetMs} ms)`;
}
