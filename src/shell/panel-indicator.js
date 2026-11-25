import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { buildPanelLabelStyleString } from '../domain/display/style.js';

/**
 * @import { PanelViewModel } from '../domain/display/view-model.js'
 */

class PanelLyricIndicatorBase extends PanelMenu.Button {
  /** @override */
  _init() {
    super._init(0.0, 'GNOME Lyric Overlay');

    /** @type {(() => void) | null} */
    this._clickAction = null;
    /** @type {any} */
    this._panelClickGesture = null;
    /** @type {number} */
    this._clickSignalId = 0;

    // GNOME Shell 50+ consumes clicks on PanelMenu.Button via an internal
    // Clutter.ClickGesture. Replace it when available; fall back to
    // button-press-event on GNOME Shell 46-49.
    const builtInClickGesture = Reflect.get(this, '_clickGesture');
    if (builtInClickGesture) {
      this.remove_action(builtInClickGesture);
    }

    if (typeof Clutter.ClickGesture === 'function') {
      this._panelClickGesture = new Clutter.ClickGesture();
      this._clickSignalId = this._panelClickGesture.connect('recognize', () => this._invokeClick());
      this.add_action(this._panelClickGesture);
    } else {
      this._clickSignalId = this.connect('button-press-event', () => this._invokeClick());
    }

    this._box = new St.BoxLayout({
      style_class: 'panel-status-indicators-box lyric-overlay-panel-container',
    });
    this._bin = new St.Bin({
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._label = new St.Label({
      text: '',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'lyric-overlay-panel-label',
    });
    configureSingleLineLabel(this._label);

    this._bin.set_child(this._label);
    this._box.add_child(this._bin);
    this.add_child(this._box);
    this.label_actor = this._label;
  }

  /**
   * @param {PanelViewModel} viewModel
   * @returns {void}
   */
  render(viewModel) {
    if (!this._label) {
      return;
    }

    this.visible = viewModel.visible;
    this._label.set_text(viewModel.text);
    this._label.width = viewModel.maxWidth;
    this._label.set_style(buildPanelLabelStyleString(viewModel));
    applyLabelAlignment(this._label, viewModel.textAlign);

    this._label.queue_relayout();
    this._bin?.queue_relayout();
    this._box?.queue_relayout();
  }

  /**
   * @param {(() => void) | null} callback
   * @returns {void}
   */
  setClickAction(callback) {
    this._clickAction = callback;
  }

  /**
   * @returns {boolean}
   */
  _invokeClick() {
    if (typeof this._clickAction !== 'function') {
      return Clutter.EVENT_PROPAGATE;
    }
    this._clickAction();
    return Clutter.EVENT_STOP;
  }

  /** @override */
  destroy() {
    if (this._clickSignalId !== 0) {
      try {
        if (this._panelClickGesture) {
          this._panelClickGesture.disconnect(this._clickSignalId);
        } else {
          this.disconnect(this._clickSignalId);
        }
      } catch {
        // already disconnected
      }
      this._clickSignalId = 0;
    }

    this._panelClickGesture = null;
    this._clickAction = null;
    this._label = null;
    this._bin = null;
    this._box = null;
    super.destroy();
  }
}

export const PanelLyricIndicator = /** @type {typeof PanelLyricIndicatorBase} */ (
  GObject.registerClass(PanelLyricIndicatorBase)
);

/**
 * @param {InstanceType<typeof St.Label>} label
 * @returns {void}
 */
function configureSingleLineLabel(label) {
  const clutterText = label.clutter_text;
  if (!clutterText) {
    return;
  }
  clutterText.set_single_line_mode?.(true);
  clutterText.set_ellipsize?.(Pango.EllipsizeMode.END);
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @param {import('../domain/settings/types.js').TextAlign} align
 * @returns {void}
 */
function applyLabelAlignment(label, align) {
  let actorAlign = Clutter.ActorAlign.START;
  let pangoAlign = Pango.Alignment.LEFT;
  if (align === 'center') {
    actorAlign = Clutter.ActorAlign.CENTER;
    pangoAlign = Pango.Alignment.CENTER;
  } else if (align === 'right') {
    actorAlign = Clutter.ActorAlign.END;
    pangoAlign = Pango.Alignment.RIGHT;
  }

  Reflect.set(label, 'x_align', actorAlign);
  const clutterText = label.clutter_text;
  if (clutterText) {
    clutterText.set_line_alignment?.(pangoAlign);
    Reflect.set(clutterText, 'x_align', actorAlign);
  }
}
