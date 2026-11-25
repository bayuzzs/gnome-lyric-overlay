import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { getFloatingPresetRatios } from './src/domain/display/floating-position.js';
import {
  DEFAULT_CUSTOM_TEXT_COLOR,
  isHexColor,
  TEXT_COLOR_MODES,
  textColorModeIndex,
} from './src/domain/settings/appearance.js';

/**
 * @typedef {Array<[any, number]>} ConnectionList
 */

const CACHE_SUBDIRS = [
  ['lyric-overlay', 'cache-v1'],
  ['lyric-overlay', 'art-v1'],
];

export default class LyricOverlayPreferences extends ExtensionPreferences {
  /**
   * @param {any} window
   * @returns {void}
   */
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const metadata = /** @type {Record<string, unknown>} */ (
      /** @type {{ metadata?: unknown }} */ (this).metadata ?? {}
    );
    /** @type {ConnectionList} */
    const connections = [];

    window.add(buildDisplayPage(settings, connections));
    window.add(buildAppearancePage(settings, connections));
    window.add(buildBehaviorPage(window, settings, metadata, connections));

    const destroyId = window.connect('destroy', () => {
      for (const [obj, id] of connections.splice(0)) {
        try {
          obj.disconnect(id);
        } catch {
          // object already finalized
        }
      }
      window.disconnect(destroyId);
    });
  }
}

/**
 * @param {any} settings
 * @param {ConnectionList} connections
 * @returns {any}
 */
function buildDisplayPage(settings, connections) {
  const page = new Adw.PreferencesPage({
    title: 'Display',
    icon_name: 'audio-x-generic-symbolic',
  });

  // 1. Mode & General
  const modeGroup = new Adw.PreferencesGroup({
    title: 'Display Mode',
    description: 'Choose between the floating desktop overlay and the fixed GNOME top bar.',
  });

  modeGroup.add(
    createStringComboRow(
      settings,
      connections,
      'display-mode',
      'Display mode',
      'Switch between floating desktop overlay and top-bar mode.',
      ['floating', 'panel'],
      ['Floating Overlay', 'Top Bar'],
    ),
  );
  modeGroup.add(
    createSwitchRow(
      settings,
      'lyrics-visible',
      'Show lyrics',
      'Master visibility toggle (can also be toggled via shortcut or tray).',
    ),
  );
  modeGroup.add(
    createStringComboRow(
      settings,
      connections,
      'fallback-mode',
      'Fallback mode',
      'Display behavior when synced lyrics are unavailable.',
      ['track', 'idle', 'hidden'],
      ['Show track title', 'Show static idle text', 'Hide display'],
    ),
  );

  // 2. Floating Overlay
  const floatingGroup = new Adw.PreferencesGroup({
    title: 'Floating Overlay',
    description: 'Configure layout, drag lock, backdrop, and auto-hide behavior.',
  });

  const lineRow = new Adw.ComboRow({
    title: 'Visible lyric lines',
    subtitle: 'How many lyric lines appear in floating mode.',
    model: new Gtk.StringList({
      strings: [
        '1 line (Current only)',
        '2 lines (Current + Next)',
        '3 lines (Prev + Current + Next)',
      ],
    }),
  });
  lineRow.selected = Math.min(2, Math.max(0, settings.get_int('floating-lines') - 1));
  connections.push([
    lineRow,
    lineRow.connect('notify::selected', () => {
      const value = lineRow.selected + 1;
      if (value >= 1 && value <= 3 && settings.get_int('floating-lines') !== value) {
        settings.set_int('floating-lines', value);
      }
    }),
  ]);
  connections.push([
    settings,
    settings.connect('changed::floating-lines', () => {
      const idx = Math.min(2, Math.max(0, settings.get_int('floating-lines') - 1));
      if (lineRow.selected !== idx) {
        lineRow.selected = idx;
      }
    }),
  ]);
  floatingGroup.add(lineRow);

  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-locked',
      'Lock overlay (Click-through)',
      'When enabled, clicks pass straight through the overlay to windows underneath.',
    ),
  );
  floatingGroup.add(
    createSpinRow(
      settings,
      'floating-bg-opacity',
      'Background opacity (%)',
      '0% renders pure subtitle text with drop shadow; higher values show a dark translucent pill.',
      0,
      100,
      5,
      15,
    ),
  );
  floatingGroup.add(
    createSpinRow(
      settings,
      'floating-font-size',
      'Font size (px)',
      'Font size for the active lyric line in floating mode.',
      12,
      36,
      1,
      4,
    ),
  );
  floatingGroup.add(
    createSpinRow(
      settings,
      'floating-max-width',
      'Overlay width (px)',
      'Fixed (or maximum) width of the floating lyric overlay.',
      280,
      1600,
      20,
      100,
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-preserve-width',
      'Preserve fixed width',
      'Keep a constant pill width to eliminate horizontal layout shifting between short and long lyrics.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-show-vinyl',
      'Spinning vinyl album art',
      'Show a rotating vinyl disc with the active track cover art at the top.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-show-track-info',
      'Show song title & album',
      'Display the song title, artist, and album name in the overlay header.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-show-controls',
      'Playback controls',
      'Show Previous, Play/Pause, and Next buttons at the bottom of the overlay.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-show-progress',
      'Interactive progress seekbar',
      'Show song progress bar with timestamps; click or drag to seek playback.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-animate',
      'Smooth vertical slide transitions',
      'Glide lyrics smoothly from bottom to top when lines change.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-hide-fullscreen',
      'Hide in fullscreen',
      'Automatically hide the floating overlay when a window is fullscreen.',
    ),
  );
  floatingGroup.add(
    createSwitchRow(
      settings,
      'floating-hide-paused',
      'Hide when paused',
      'Automatically hide the floating overlay while playback is paused.',
    ),
  );

  // Position presets row
  const presetIds = ['bottom-center', 'top-center', 'bottom-left', 'bottom-right', 'center'];
  const presetLabels = ['Bottom Center', 'Top Center', 'Bottom Left', 'Bottom Right', 'Center'];
  const presetRow = new Adw.ComboRow({
    title: 'Reset to preset position',
    subtitle: 'Snap the floating overlay back to a standard anchor on the primary monitor.',
    model: new Gtk.StringList({ strings: presetLabels }),
  });
  const applyPresetButton = new Gtk.Button({
    label: 'Apply',
    valign: Gtk.Align.CENTER,
  });
  connections.push([
    applyPresetButton,
    applyPresetButton.connect('clicked', () => {
      const presetId = presetIds[presetRow.selected] ?? 'bottom-center';
      const ratios = getFloatingPresetRatios(presetId);
      settings.set_double('floating-x-ratio', ratios.xRatio);
      settings.set_double('floating-y-ratio', ratios.yRatio);
      settings.set_int('floating-monitor-index', -1);
    }),
  ]);
  presetRow.add_suffix(applyPresetButton);
  floatingGroup.add(presetRow);

  // 3. Fixed Top Bar
  const panelGroup = new Adw.PreferencesGroup({
    title: 'Top Bar Mode',
    description: 'Configure placement and width when Display Mode is set to Top Bar.',
  });

  panelGroup.add(
    createStringComboRow(
      settings,
      connections,
      'panel-position',
      'Panel position',
      'Which box of the GNOME top bar holds the indicator.',
      ['left', 'center', 'right'],
      ['Left', 'Center', 'Right'],
    ),
  );
  panelGroup.add(
    createSpinRow(
      settings,
      'panel-index',
      'Panel index',
      '0-based order inside the selected panel box (-1 appends to the end).',
      -1,
      20,
      1,
      5,
    ),
  );
  panelGroup.add(
    createSpinRow(
      settings,
      'panel-max-width',
      'Top-bar maximum width (px)',
      'Maximum width of the single-line top-bar lyric label.',
      120,
      720,
      10,
      50,
    ),
  );

  page.add(modeGroup);
  page.add(floatingGroup);
  page.add(panelGroup);
  return page;
}

/**
 * @param {any} settings
 * @param {ConnectionList} connections
 * @returns {any}
 */
function buildAppearancePage(settings, connections) {
  const page = new Adw.PreferencesPage({
    title: 'Appearance',
    icon_name: 'preferences-desktop-appearance-symbolic',
  });

  const styleGroup = new Adw.PreferencesGroup({
    title: 'Typography & Colors',
    description: 'Customize lyric alignment, text colors, secondary line dimming, and shadow.',
  });

  styleGroup.add(
    createStringComboRow(
      settings,
      connections,
      'text-align',
      'Text alignment',
      'Horizontal alignment of lyric lines.',
      ['left', 'center', 'right'],
      ['Left', 'Center', 'Right'],
    ),
  );

  const textColorPresetRow = new Adw.ComboRow({
    title: 'Active text color',
    subtitle: 'Color preset for the active lyric line.',
    model: new Gtk.StringList({
      strings: ['Default (White)', 'Theme default', 'White', 'Black', 'Custom color'],
    }),
  });
  const initialColorIdx = textColorModeIndex(settings.get_string('style-text-color-type'));
  if (initialColorIdx !== -1) {
    textColorPresetRow.selected = initialColorIdx;
  }

  const textColorCustomRow = new Adw.EntryRow({
    title: 'Custom text color (HEX)',
    show_apply_button: true,
  });
  textColorCustomRow.text = settings.get_string('style-text-color-custom');

  const colorPickerButton = new Gtk.ColorDialogButton({
    dialog: new Gtk.ColorDialog({
      title: 'Pick lyric text color',
      modal: true,
      with_alpha: false,
    }),
    rgba: rgbaFromHex(settings.get_string('style-text-color-custom')),
    valign: Gtk.Align.CENTER,
  });
  textColorCustomRow.add_suffix(colorPickerButton);

  const syncCustomColorVisibility = () => {
    textColorCustomRow.visible = textColorPresetRow.selected === 4;
  };
  syncCustomColorVisibility();

  connections.push([
    textColorPresetRow,
    textColorPresetRow.connect('notify::selected', () => {
      const mode = TEXT_COLOR_MODES[textColorPresetRow.selected];
      if (mode !== undefined) {
        settings.set_string('style-text-color-type', mode);
        syncCustomColorVisibility();
      }
    }),
  ]);
  connections.push([
    settings,
    settings.connect('changed::style-text-color-type', () => {
      const idx = textColorModeIndex(settings.get_string('style-text-color-type'));
      if (idx !== -1 && textColorPresetRow.selected !== idx) {
        textColorPresetRow.selected = idx;
        syncCustomColorVisibility();
      }
    }),
  ]);
  connections.push([
    textColorCustomRow,
    textColorCustomRow.connect('apply', () => {
      const candidate = textColorCustomRow.text.trim();
      if (isHexColor(candidate)) {
        settings.set_string('style-text-color-custom', candidate);
      } else {
        textColorCustomRow.text = settings.get_string('style-text-color-custom');
      }
    }),
  ]);
  connections.push([
    colorPickerButton,
    colorPickerButton.connect('notify::rgba', () => {
      const hex = hexFromRgba(colorPickerButton.rgba);
      if (settings.get_string('style-text-color-custom') !== hex) {
        settings.set_string('style-text-color-custom', hex);
      }
    }),
  ]);
  connections.push([
    settings,
    settings.connect('changed::style-text-color-custom', () => {
      const current = settings.get_string('style-text-color-custom');
      if (textColorCustomRow.text !== current) {
        textColorCustomRow.text = current;
      }
      if (hexFromRgba(colorPickerButton.rgba) !== current) {
        colorPickerButton.rgba = rgbaFromHex(current);
      }
    }),
  ]);

  styleGroup.add(textColorPresetRow);
  styleGroup.add(textColorCustomRow);
  styleGroup.add(
    createSpinRow(
      settings,
      'style-secondary-opacity',
      'Secondary line opacity (%)',
      'Opacity for previous and next context lines in floating mode.',
      20,
      90,
      5,
      10,
    ),
  );
  styleGroup.add(
    createSwitchRow(
      settings,
      'style-text-shadow',
      'Text drop shadow',
      'Render a drop shadow behind lyrics for readability over bright wallpapers.',
    ),
  );

  page.add(styleGroup);
  return page;
}

/**
 * @param {any} window
 * @param {any} settings
 * @param {Record<string, unknown>} metadata
 * @param {ConnectionList} connections
 * @returns {any}
 */
function buildBehaviorPage(window, settings, metadata, connections) {
  const page = new Adw.PreferencesPage({
    title: 'Behavior',
    icon_name: 'preferences-system-symbolic',
  });

  // 1. Shortcuts
  const shortcutGroup = new Adw.PreferencesGroup({
    title: 'Keyboard Shortcuts',
    description:
      'Use GTK accelerator syntax (e.g. <Super><Alt>m). Leave empty and apply to disable a shortcut.',
  });

  shortcutGroup.add(
    createShortcutRow(
      settings,
      connections,
      'shortcut-toggle-mode',
      'Toggle Floating / Top Bar',
      '<Super><Alt>m',
    ),
  );
  shortcutGroup.add(
    createShortcutRow(
      settings,
      connections,
      'shortcut-toggle-lock',
      'Toggle Lock (Click-through)',
      '<Super><Alt>l',
    ),
  );
  shortcutGroup.add(
    createShortcutRow(
      settings,
      connections,
      'shortcut-toggle-visible',
      'Toggle Show / Hide Lyrics',
      '<Super><Alt>h',
    ),
  );

  // 2. Lyrics & Players
  const playerGroup = new Adw.PreferencesGroup({
    title: 'Lyrics & Players',
    description: 'Timing sync, MPRIS player priority, browser profiles, and local cache.',
  });

  playerGroup.add(
    createSpinRow(
      settings,
      'lyrics-offset-ms',
      'Lyrics timing offset (ms)',
      'Negative values show lines earlier; positive values delay them.',
      -5000,
      5000,
      50,
      500,
    ),
  );

  const priorityRow = new Adw.EntryRow({
    title: 'Player priority (comma-separated)',
    show_apply_button: true,
  });
  priorityRow.text = settings.get_strv('player-priority').join(', ');
  connections.push([
    priorityRow,
    priorityRow.connect('apply', () => {
      const parts = priorityRow.text
        .split(',')
        .map((/** @type {string} */ item) => item.trim())
        .filter((/** @type {string} */ item) => item !== '');
      settings.set_strv('player-priority', parts);
    }),
  ]);
  connections.push([
    settings,
    settings.connect('changed::player-priority', () => {
      const formatted = settings.get_strv('player-priority').join(', ');
      if (priorityRow.text !== formatted) {
        priorityRow.text = formatted;
      }
    }),
  ]);
  playerGroup.add(priorityRow);

  playerGroup.add(
    createStringComboRow(
      settings,
      connections,
      'browser-player-service',
      'Browser player service',
      'How browser MPRIS players should be interpreted.',
      ['auto', 'spotify', 'youtube-music', 'apple-music', 'generic'],
      ['Auto detect', 'Spotify Web', 'YouTube Music', 'Apple Music', 'Generic browser'],
    ),
  );
  playerGroup.add(
    createSwitchRow(
      settings,
      'cache-enabled',
      'Cache lyrics locally',
      'Store LRCLIB lookup results locally for faster repeat playback.',
    ),
  );

  const clearCacheRow = new Adw.ActionRow({
    title: 'Clear lyrics & artwork cache',
    subtitle: 'Remove cached lyrics and downloaded album art from ~/.cache/lyric-overlay.',
  });
  const clearCacheButton = new Gtk.Button({
    label: 'Clear Cache',
    valign: Gtk.Align.CENTER,
    css_classes: ['destructive-action'],
  });
  connections.push([
    clearCacheButton,
    clearCacheButton.connect('clicked', () => {
      const removed = clearLocalLyricsCache();
      clearCacheRow.subtitle =
        removed === 0
          ? 'Cache is already empty.'
          : `Cleared ${removed} cached ${removed === 1 ? 'entry' : 'entries'}.`;
    }),
  ]);
  clearCacheRow.add_suffix(clearCacheButton);
  playerGroup.add(clearCacheRow);

  // 3. Debugging & About
  const aboutGroup = new Adw.PreferencesGroup({
    title: 'Debugging & About',
  });

  aboutGroup.add(
    createSwitchRow(
      settings,
      'debug-logging',
      'Debug logging',
      'Write verbose diagnostic messages to the GNOME Shell journal.',
    ),
  );

  const copyDiagRow = new Adw.ActionRow({
    title: 'Copy diagnostics',
    subtitle: 'Copy safe settings summary (excludes lyrics, logs, and track history).',
  });
  const copyDiagButton = new Gtk.Button({
    icon_name: 'edit-copy-symbolic',
    valign: Gtk.Align.CENTER,
    tooltip_text: 'Copy diagnostics',
  });
  connections.push([
    copyDiagButton,
    copyDiagButton.connect('clicked', () => {
      window.get_clipboard().set(buildDiagnosticsMarkdown(metadata, settings));
      copyDiagButton.tooltip_text = 'Copied!';
    }),
  ]);
  copyDiagRow.add_suffix(copyDiagButton);
  aboutGroup.add(copyDiagRow);

  aboutGroup.add(
    new Adw.ActionRow({
      title: 'Version',
      subtitle: readMetadataText(metadata, 'version-name', '0.1.0'),
    }),
  );
  aboutGroup.add(
    new Adw.ActionRow({
      title: 'Extension UUID',
      subtitle: readMetadataText(metadata, 'uuid', 'lyric-overlay@bayuzzs.github.io'),
    }),
  );

  page.add(shortcutGroup);
  page.add(playerGroup);
  page.add(aboutGroup);
  return page;
}

/**
 * @param {any} settings
 * @param {ConnectionList} connections
 * @param {string} key
 * @param {string} title
 * @param {string} subtitle
 * @param {readonly string[]} values
 * @param {readonly string[]} labels
 * @returns {any}
 */
function createStringComboRow(settings, connections, key, title, subtitle, values, labels) {
  const row = new Adw.ComboRow({
    title,
    subtitle,
    model: new Gtk.StringList({ strings: [...labels] }),
  });

  const initialIdx = values.indexOf(settings.get_string(key));
  if (initialIdx !== -1) {
    row.selected = initialIdx;
  }

  connections.push([
    row,
    row.connect('notify::selected', () => {
      const value = values[row.selected];
      if (value !== undefined && settings.get_string(key) !== value) {
        settings.set_string(key, value);
      }
    }),
  ]);
  connections.push([
    settings,
    settings.connect(`changed::${key}`, () => {
      const idx = values.indexOf(settings.get_string(key));
      if (idx !== -1 && row.selected !== idx) {
        row.selected = idx;
      }
    }),
  ]);

  return row;
}

/**
 * @param {any} settings
 * @param {string} key
 * @param {string} title
 * @param {string} subtitle
 * @returns {any}
 */
function createSwitchRow(settings, key, title, subtitle) {
  const row = new Adw.SwitchRow({ title, subtitle });
  settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
  return row;
}

/**
 * @param {any} settings
 * @param {string} key
 * @param {string} title
 * @param {string} subtitle
 * @param {number} lower
 * @param {number} upper
 * @param {number} step
 * @param {number} pageStep
 * @returns {any}
 */
function createSpinRow(settings, key, title, subtitle, lower, upper, step, pageStep) {
  const row = new Adw.SpinRow({
    title,
    subtitle,
    adjustment: new Gtk.Adjustment({
      lower,
      upper,
      step_increment: step,
      page_increment: pageStep,
      value: settings.get_int(key),
    }),
  });
  settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
  return row;
}

/**
 * @param {any} settings
 * @param {ConnectionList} connections
 * @param {string} key
 * @param {string} title
 * @param {string} defaultAccel
 * @returns {any}
 */
function createShortcutRow(settings, connections, key, title, defaultAccel) {
  const row = new Adw.EntryRow({
    title,
    show_apply_button: true,
  });
  row.text = settings.get_strv(key)[0] ?? '';

  const resetButton = new Gtk.Button({
    icon_name: 'edit-undo-symbolic',
    valign: Gtk.Align.CENTER,
    tooltip_text: `Reset to ${defaultAccel}`,
  });
  connections.push([
    resetButton,
    resetButton.connect('clicked', () => {
      settings.set_strv(key, [defaultAccel]);
    }),
  ]);
  row.add_suffix(resetButton);

  connections.push([
    row,
    row.connect('apply', () => {
      const accel = row.text.trim();
      settings.set_strv(key, accel === '' ? [] : [accel]);
    }),
  ]);
  connections.push([
    settings,
    settings.connect(`changed::${key}`, () => {
      const current = settings.get_strv(key)[0] ?? '';
      if (row.text !== current) {
        row.text = current;
      }
    }),
  ]);

  return row;
}

/**
 * @returns {number}
 */
function clearLocalLyricsCache() {
  const cacheBase = GLib.get_user_cache_dir();
  if (typeof cacheBase !== 'string' || cacheBase === '') {
    return 0;
  }

  let removed = 0;
  for (const parts of CACHE_SUBDIRS) {
    const dir = Gio.File.new_for_path(GLib.build_filenamev([cacheBase, ...parts]));
    let enumerator;
    try {
      enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    } catch {
      continue;
    }

    try {
      let info;
      while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name?.();
        if (typeof name !== 'string') {
          continue;
        }
        try {
          dir.get_child(name).delete(null);
          removed += 1;
        } catch {
          // ignore individual deletion errors
        }
      }
    } finally {
      try {
        enumerator.close(null);
      } catch {
        // ignore close error
      }
    }
  }
  return removed;
}

/**
 * @param {string} hex
 * @returns {InstanceType<typeof Gdk.RGBA>}
 */
function rgbaFromHex(hex) {
  const rgba = new Gdk.RGBA();
  const normalized = isHexColor(hex) ? hex.trim() : DEFAULT_CUSTOM_TEXT_COLOR;
  if (!rgba.parse(normalized)) {
    rgba.parse(DEFAULT_CUSTOM_TEXT_COLOR);
  }
  return rgba;
}

/**
 * @param {{ red: number, green: number, blue: number }} rgba
 * @returns {string}
 */
function hexFromRgba(rgba) {
  const toHex = (/** @type {number} */ channel) =>
    Math.min(255, Math.max(0, Math.round(channel * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function readMetadataText(metadata, key, fallback) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {any} settings
 * @returns {string}
 */
function buildDiagnosticsMarkdown(metadata, settings) {
  return [
    '## GNOME Lyric Overlay diagnostics',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Version | ${readMetadataText(metadata, 'version-name', '0.1.0')} |`,
    `| UUID | ${readMetadataText(metadata, 'uuid', 'lyric-overlay@bayuzzs.github.io')} |`,
    `| Display mode | ${settings.get_string('display-mode')} |`,
    `| Lyrics visible | ${settings.get_boolean('lyrics-visible') ? 'yes' : 'no'} |`,
    `| Floating locked | ${settings.get_boolean('floating-locked') ? 'yes' : 'no'} |`,
    `| Floating lines | ${settings.get_int('floating-lines')} |`,
    `| Floating bg opacity | ${settings.get_int('floating-bg-opacity')}% |`,
    `| Floating font size | ${settings.get_int('floating-font-size')}px |`,
    `| Hide fullscreen | ${settings.get_boolean('floating-hide-fullscreen') ? 'yes' : 'no'} |`,
    `| Hide paused | ${settings.get_boolean('floating-hide-paused') ? 'yes' : 'no'} |`,
    `| Panel position | ${settings.get_string('panel-position')} (${settings.get_int('panel-index')}) |`,
    `| Lyrics offset | ${settings.get_int('lyrics-offset-ms')} ms |`,
    `| Browser service | ${settings.get_string('browser-player-service')} |`,
    `| Cache enabled | ${settings.get_boolean('cache-enabled') ? 'yes' : 'no'} |`,
  ].join('\n');
}
