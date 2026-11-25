import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
  clampOverlayCoordinates,
  computeOverlayCoordinates,
  computeRatiosFromCoordinates,
  computeResizedOverlay,
  findMonitorContainingPoint,
  resolveMonitorIndex,
} from '../domain/display/floating-position.js';
import {
  buildFloatingContainerStyle,
  buildFloatingLineStyle,
  buildVinylCoverStyle,
} from '../domain/display/style.js';

/**
 * @import { FloatingViewModel } from '../domain/display/view-model.js'
 * @import { PlaybackAction } from '../domain/mpris/types.js'
 *
 * @typedef {(xRatio: number, yRatio: number, monitorIndex: number) => void} PositionCommittedCallback
 * @typedef {(width: number, xRatio: number, yRatio: number, monitorIndex: number) => void} WidthCommittedCallback
 * @typedef {(action: PlaybackAction) => void} PlaybackActionCallback
 */

const LINE_TRANSITION_MS = 320;
const VINYL_COVER_SIZE_PX = 30;
const VINYL_SPIN_DURATION_MS = 12_000;
const VINYL_SPIN_TRANSITION_NAME = 'lyric-overlay-vinyl-spin';
const MIN_OVERLAY_WIDTH = 280;
const MAX_OVERLAY_WIDTH = 1600;

class FloatingOverlayBase extends St.BoxLayout {
  /** @override */
  _init() {
    super._init({
      style_class: 'lyric-overlay-floating',
      reactive: false,
      can_focus: false,
      track_hover: true,
    });

    setBoxOrientation(this, Clutter.Orientation.HORIZONTAL);

    /** @type {FloatingViewModel | null} */
    this._lastViewModel = null;
    /** @type {string} */
    this._lastCurrentText = '';
    /** @type {number} */
    this._lastLineIndex = -1;
    /** @type {string | null} */
    this._lastArtUri = null;
    /** @type {string} */
    this._lastContainerStyle = '';
    /** @type {boolean} */
    this._locked = true;
    /** @type {boolean} */
    this._chromeTracked = false;
    /** @type {any} */
    this._modalGrab = null;
    /** @type {{ dismiss(): void } | null} */
    this._stageGrab = null;

    /** @type {boolean} */
    this._dragging = false;
    /** @type {number} */
    this._dragOffsetX = 0;
    /** @type {number} */
    this._dragOffsetY = 0;

    /** @type {'left' | 'right' | null} */
    this._resizingEdge = null;
    /** @type {number} */
    this._resizeStartStageX = 0;
    /** @type {number} */
    this._resizeStartX = 0;
    /** @type {number} */
    this._resizeStartWidth = 640;
    /** @type {number} */
    this._resizeCurrentWidth = 640;
    /** @type {number} */
    this._resizeMonitorIndex = 0;

    /** @type {number} */
    this._stageCaptureId = 0;
    /** @type {Array<[any, number]>} */
    this._connections = [];
    /** @type {PositionCommittedCallback | null} */
    this._onPositionCommitted = null;
    /** @type {WidthCommittedCallback | null} */
    this._onWidthCommitted = null;
    /** @type {PlaybackActionCallback | null} */
    this._onPlaybackAction = null;

    // Left Edge Resize Handle
    this._leftResizeHandle = new St.Widget({
      style_class: 'lyric-overlay-resize-handle lyric-overlay-resize-left',
      reactive: true,
      track_hover: true,
      y_expand: true,
    });
    applyActorCursor(this._leftResizeHandle, Clutter.CursorType?.W_RESIZE);

    // Center 3-Tier Vertical Body
    this._bodyColumn = new St.BoxLayout({
      style_class: 'lyric-overlay-body',
      x_expand: true,
    });
    setBoxOrientation(this._bodyColumn, Clutter.Orientation.VERTICAL);

    // 1. Top Tier: Spinning Vinyl Disc + Song Title & Artist · Album
    this._headerRow = new St.BoxLayout({
      style_class: 'lyric-overlay-header',
      reactive: true,
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    setBoxOrientation(this._headerRow, Clutter.Orientation.HORIZONTAL);
    applyActorCursor(this._headerRow, Clutter.CursorType?.GRAB);

    this._vinylSpindle = new St.Widget({
      style_class: 'lyric-overlay-vinyl-spindle',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._vinylCover = new St.Bin({
      style_class: 'lyric-overlay-vinyl-cover',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._vinylCover.set_child(this._vinylSpindle);

    this._vinylDisc = new St.Bin({
      style_class: 'lyric-overlay-vinyl-disc',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._vinylDisc.set_child(this._vinylCover);
    this._vinylDisc.set_pivot_point(0.5, 0.5);

    this._trackMetaBox = new St.BoxLayout({
      style_class: 'lyric-overlay-track-meta',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    setBoxOrientation(this._trackMetaBox, Clutter.Orientation.VERTICAL);

    this._trackTitleLabel = createSingleLineMetaLabel('lyric-overlay-track-title');
    this._trackSubLabel = createSingleLineMetaLabel('lyric-overlay-track-subtitle');
    this._trackMetaBox.add_child(this._trackTitleLabel);
    this._trackMetaBox.add_child(this._trackSubLabel);

    this._headerRow.add_child(this._vinylDisc);
    this._headerRow.add_child(this._trackMetaBox);

    // 2. Middle Tier: Full-width Clipped Lyrics Conveyor (bottom -> top glide)
    this._lyricsViewport = new St.BoxLayout({
      style_class: 'lyric-overlay-lyrics-viewport',
      reactive: true,
      clip_to_allocation: true,
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    setBoxOrientation(this._lyricsViewport, Clutter.Orientation.VERTICAL);
    applyActorCursor(this._lyricsViewport, Clutter.CursorType?.GRAB);

    this._lyricsTrack = new St.BoxLayout({
      style_class: 'lyric-overlay-lyrics-track',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    setBoxOrientation(this._lyricsTrack, Clutter.Orientation.VERTICAL);

    this._prevLabel = createFloatingLabel('lyric-overlay-line-secondary');
    this._currentLabel = createFloatingLabel('lyric-overlay-line-current');
    this._nextLabel = createFloatingLabel('lyric-overlay-line-secondary');

    this._lyricsTrack.add_child(this._prevLabel);
    this._lyricsTrack.add_child(this._currentLabel);
    this._lyricsTrack.add_child(this._nextLabel);
    this._lyricsViewport.add_child(this._lyricsTrack);

    // 3. Bottom Tier: Centered Playback Controls (Prev / Play-Pause / Next)
    this._controlsBox = new St.BoxLayout({
      style_class: 'lyric-overlay-controls',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    setBoxOrientation(this._controlsBox, Clutter.Orientation.HORIZONTAL);

    this._prevButton = this._createControlButton(
      'media-skip-backward-symbolic',
      'Previous track',
      false,
      () => this._onPlaybackAction?.('Previous'),
    );
    this._playPauseIcon = new St.Icon({
      icon_name: 'media-playback-start-symbolic',
      icon_size: 16,
    });
    this._playPauseButton = this._createControlButtonWithIcon(
      this._playPauseIcon,
      'Play or Pause',
      true,
      () => this._onPlaybackAction?.('PlayPause'),
    );
    this._nextButton = this._createControlButton(
      'media-skip-forward-symbolic',
      'Next track',
      false,
      () => this._onPlaybackAction?.('Next'),
    );

    this._controlsBox.add_child(this._prevButton);
    this._controlsBox.add_child(this._playPauseButton);
    this._controlsBox.add_child(this._nextButton);

    this._bodyColumn.add_child(this._headerRow);
    this._bodyColumn.add_child(this._lyricsViewport);
    this._bodyColumn.add_child(this._controlsBox);

    // Right Edge Resize Handle
    this._rightResizeHandle = new St.Widget({
      style_class: 'lyric-overlay-resize-handle lyric-overlay-resize-right',
      reactive: true,
      track_hover: true,
      y_expand: true,
    });
    applyActorCursor(this._rightResizeHandle, Clutter.CursorType?.E_RESIZE);

    this.add_child(this._leftResizeHandle);
    this.add_child(this._bodyColumn);
    this.add_child(this._rightResizeHandle);

    this.visible = false;

    // Drag-to-move on header & lyrics; horizontal resize on left & right edge handles
    const onDragStart = (/** @type {unknown} */ _actor, /** @type {any} */ event) =>
      this._handleDragStart(event);
    this._connect(this._headerRow, 'button-press-event', onDragStart);
    this._connect(this._lyricsViewport, 'button-press-event', onDragStart);

    this._connect(
      this._leftResizeHandle,
      'button-press-event',
      /**
       * @param {unknown} _actor
       * @param {any} event
       * @returns {boolean}
       */
      (_actor, event) => this._handleResizeStart('left', event),
    );
    this._connect(
      this._rightResizeHandle,
      'button-press-event',
      /**
       * @param {unknown} _actor
       * @param {any} event
       * @returns {boolean}
       */
      (_actor, event) => this._handleResizeStart('right', event),
    );
  }

  /**
   * @param {PositionCommittedCallback | null} callback
   * @returns {void}
   */
  setPositionCommittedHandler(callback) {
    this._onPositionCommitted = callback;
  }

  /**
   * @param {WidthCommittedCallback | null} callback
   * @returns {void}
   */
  setWidthCommittedHandler(callback) {
    this._onWidthCommitted = callback;
  }

  /**
   * @param {PlaybackActionCallback | null} callback
   * @returns {void}
   */
  setPlaybackActionHandler(callback) {
    this._onPlaybackAction = callback;
  }

  /**
   * @param {FloatingViewModel} viewModel
   * @returns {void}
   */
  render(viewModel) {
    if (
      !this._currentLabel ||
      !this._prevLabel ||
      !this._nextLabel ||
      !this._headerRow ||
      !this._vinylDisc ||
      !this._vinylCover ||
      !this._trackMetaBox ||
      !this._trackTitleLabel ||
      !this._trackSubLabel ||
      !this._lyricsViewport ||
      !this._controlsBox
    ) {
      return;
    }

    const previousText = this._lastCurrentText;
    const previousLineIndex = this._lastLineIndex;
    const textChanged =
      previousText !== '' && viewModel.currentText !== '' && previousText !== viewModel.currentText;
    const slideDirection =
      previousLineIndex >= 0 && viewModel.lineIndex >= 0 && viewModel.lineIndex < previousLineIndex
        ? -1
        : 1;

    this._lastViewModel = viewModel;
    this._lastCurrentText = viewModel.currentText;
    this._lastLineIndex = viewModel.lineIndex;
    this._locked = viewModel.locked;

    // Lock / click-through handling + Wayland shell chrome input region
    const interactive = !viewModel.locked;
    this.reactive = interactive;
    this._headerRow.reactive = interactive;
    this._lyricsViewport.reactive = interactive;
    if (this._leftResizeHandle) {
      this._leftResizeHandle.reactive = interactive;
    }
    if (this._rightResizeHandle) {
      this._rightResizeHandle.reactive = interactive;
    }
    if (this._prevButton) {
      this._prevButton.reactive = interactive;
    }
    if (this._playPauseButton) {
      this._playPauseButton.reactive = interactive;
    }
    if (this._nextButton) {
      this._nextButton.reactive = interactive;
    }

    if (viewModel.locked) {
      this.remove_style_class_name('lyric-overlay-floating-unlocked');
      this._endInteraction(false);
    } else {
      this.add_style_class_name('lyric-overlay-floating-unlocked');
    }

    if (this._resizingEdge === null) {
      const containerStyle = buildFloatingContainerStyle({
        maxWidth: viewModel.maxWidth,
        preserveWidth: viewModel.preserveWidth,
        bgOpacity: viewModel.bgOpacity,
      });
      if (containerStyle !== this._lastContainerStyle) {
        this._lastContainerStyle = containerStyle;
        this.set_style(containerStyle);
      }
      this.set_width(viewModel.preserveWidth ? viewModel.maxWidth : -1);
    }

    // Top Tier: Spinning Vinyl + Song Title / Artist · Album
    const hasTrackMeta =
      viewModel.showTrackInfo && (viewModel.trackTitle !== '' || viewModel.trackSubtitle !== '');
    this._vinylDisc.visible = viewModel.showVinyl;
    this._trackMetaBox.visible = hasTrackMeta;
    this._headerRow.visible = viewModel.showVinyl || hasTrackMeta;

    if (hasTrackMeta) {
      this._trackTitleLabel.visible = viewModel.trackTitle !== '';
      this._trackTitleLabel.set_text(viewModel.trackTitle);
      this._trackSubLabel.visible = viewModel.trackSubtitle !== '';
      this._trackSubLabel.set_text(viewModel.trackSubtitle);
    }

    if (viewModel.artUri !== this._lastArtUri) {
      this._lastArtUri = viewModel.artUri;
      this._vinylCover.set_style(buildVinylCoverStyle(viewModel.artUri, VINYL_COVER_SIZE_PX));
    }
    this._syncVinylSpin(viewModel.visible && viewModel.showVinyl && viewModel.isPlaying);

    // Middle Tier: Lyrics lines
    const commonStyle = {
      fontSize: viewModel.fontSize,
      textAlign: viewModel.textAlign,
      textColorMode: viewModel.textColorMode,
      customTextColor: viewModel.customTextColor,
      secondaryOpacity: viewModel.secondaryOpacity,
      textShadowEnabled: viewModel.textShadowEnabled,
      bgOpacity: viewModel.bgOpacity,
    };

    const showPrev = viewModel.linesCount >= 3 && viewModel.previousText !== '';
    const showNext = viewModel.linesCount >= 2 && viewModel.nextText !== '';

    updateFloatingLabel(this._prevLabel, {
      text: viewModel.previousText,
      visible: showPrev,
      align: viewModel.textAlign,
      style: buildFloatingLineStyle({ ...commonStyle, role: 'secondary' }),
    });
    updateFloatingLabel(this._currentLabel, {
      text: viewModel.currentText,
      visible: viewModel.currentText !== '',
      align: viewModel.textAlign,
      style: buildFloatingLineStyle({ ...commonStyle, role: 'current' }),
    });
    updateFloatingLabel(this._nextLabel, {
      text: viewModel.nextText,
      visible: showNext,
      align: viewModel.textAlign,
      style: buildFloatingLineStyle({ ...commonStyle, role: 'secondary' }),
    });

    // Bottom Tier: Playback controls
    this._controlsBox.visible = viewModel.showControls;
    if (this._playPauseIcon) {
      this._playPauseIcon.icon_name = viewModel.isPlaying
        ? 'media-playback-pause-symbolic'
        : 'media-playback-start-symbolic';
    }

    this.visible = viewModel.visible;
    if (!viewModel.visible && this._isInteracting()) {
      this._endInteraction(false);
    }
    this._syncChromeInputRegion(viewModel.visible && interactive);

    if (viewModel.visible && !this._isInteracting()) {
      this.reposition();
    }

    if (viewModel.visible && textChanged && viewModel.animate) {
      this._animateConveyorTransition(viewModel.fontSize, slideDirection);
    }
  }

  /**
   * Recomputes and applies clamped overlay coordinates from the latest view model.
   *
   * @returns {void}
   */
  reposition() {
    if (this._isInteracting() || this._lastViewModel === null) {
      return;
    }

    const { monitors, primaryIndex } = Main.layoutManager;
    if (!Array.isArray(monitors) || monitors.length === 0) {
      return;
    }

    const monitorIndex = resolveMonitorIndex(
      this._lastViewModel.monitorIndex,
      primaryIndex,
      monitors.length,
    );
    const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
    const { width, height } = this._measureSize(
      this._lastViewModel.maxWidth,
      this._lastViewModel.preserveWidth,
    );

    const coords = computeOverlayCoordinates({
      workArea,
      overlayWidth: width,
      overlayHeight: height,
      xRatio: this._lastViewModel.xRatio,
      yRatio: this._lastViewModel.yRatio,
    });
    this.set_position(coords.x, coords.y);
  }

  /**
   * @returns {boolean}
   */
  _isInteracting() {
    return this._dragging || this._resizingEdge !== null;
  }

  /**
   * Registers/unregisters this overlay in GNOME Shell's chrome input region so
   * playback buttons, edge resize handles, and drag gestures receive pointer
   * events over Wayland windows when unlocked, and pass clicks through when locked.
   *
   * @param {boolean} shouldTrack
   * @returns {void}
   */
  _syncChromeInputRegion(shouldTrack) {
    if (shouldTrack === this._chromeTracked) {
      return;
    }

    try {
      if (shouldTrack) {
        Main.layoutManager.trackChrome(this, {
          affectsInputRegion: true,
          trackFullscreen: false,
        });
        this._chromeTracked = true;
      } else {
        Main.layoutManager.untrackChrome(this);
        this._chromeTracked = false;
      }
    } catch {
      this._chromeTracked = false;
    }
  }

  /**
   * Smoothly spins the vinyl disc on the GPU while playing, pausing cleanly at
   * its current rotation angle when playback pauses.
   *
   * @param {boolean} shouldSpin
   * @returns {void}
   */
  _syncVinylSpin(shouldSpin) {
    if (!this._vinylDisc) {
      return;
    }

    const existing = this._vinylDisc.get_transition(VINYL_SPIN_TRANSITION_NAME);
    if (shouldSpin) {
      if (!existing) {
        const transition = new Clutter.PropertyTransition({
          property_name: 'rotation-angle-z',
          duration: VINYL_SPIN_DURATION_MS,
          repeat_count: -1,
          progress_mode: Clutter.AnimationMode.LINEAR,
        });
        transition.set_from(0);
        transition.set_to(360);
        this._vinylDisc.add_transition(VINYL_SPIN_TRANSITION_NAME, transition);
        return;
      }
      if (typeof existing.is_playing === 'function' && !existing.is_playing()) {
        existing.start();
      }
      return;
    }

    if (existing && typeof existing.pause === 'function') {
      existing.pause();
    }
  }

  /**
   * Smooth bottom-to-top (or reversed on backward seek) vertical lyric glide
   * inside the clipped lyrics viewport.
   *
   * @param {number} fontSize
   * @param {1 | -1} direction
   * @returns {void}
   */
  _animateConveyorTransition(fontSize, direction) {
    if (!this._lyricsTrack || !this._currentLabel) {
      return;
    }

    const slidePx = Math.max(16, Math.round(fontSize * 1.3));
    const track = this._lyricsTrack;
    const current = this._currentLabel;
    const incoming = direction > 0 ? this._nextLabel : this._prevLabel;

    track.remove_all_transitions();
    current.remove_all_transitions();
    incoming?.remove_all_transitions();

    track.translation_y = direction * slidePx;
    current.opacity = 110;
    if (incoming?.visible) {
      incoming.opacity = 0;
    }

    track.ease({
      translation_y: 0,
      duration: LINE_TRANSITION_MS,
      mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
    });
    current.ease({
      opacity: 255,
      duration: LINE_TRANSITION_MS,
      mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
    });
    if (incoming?.visible) {
      incoming.ease({
        opacity: 255,
        duration: LINE_TRANSITION_MS + 40,
        mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
      });
    }
  }

  /**
   * @param {string} iconName
   * @param {string} accessibleName
   * @param {boolean} isPrimary
   * @param {() => void} onClick
   * @returns {InstanceType<typeof St.Button>}
   */
  _createControlButton(iconName, accessibleName, isPrimary, onClick) {
    const icon = new St.Icon({
      icon_name: iconName,
      icon_size: isPrimary ? 16 : 14,
    });
    return this._createControlButtonWithIcon(icon, accessibleName, isPrimary, onClick);
  }

  /**
   * @param {InstanceType<typeof St.Icon>} icon
   * @param {string} accessibleName
   * @param {boolean} isPrimary
   * @param {() => void} onClick
   * @returns {InstanceType<typeof St.Button>}
   */
  _createControlButtonWithIcon(icon, accessibleName, isPrimary, onClick) {
    const button = new St.Button({
      style_class: isPrimary
        ? 'lyric-overlay-control-button lyric-overlay-control-primary'
        : 'lyric-overlay-control-button',
      reactive: true,
      can_focus: false,
      track_hover: true,
      y_align: Clutter.ActorAlign.CENTER,
      accessible_name: accessibleName,
      child: icon,
    });
    applyActorCursor(button, Clutter.CursorType?.POINTER);
    this._connect(button, 'clicked', () => {
      if (!this._locked) {
        onClick();
      }
    });
    return button;
  }

  /**
   * @param {number} maxWidth
   * @param {boolean} preserveWidth
   * @returns {{ width: number, height: number }}
   */
  _measureSize(maxWidth, preserveWidth) {
    try {
      const [, , natWidth, natHeight] = this.get_preferred_size();
      const width = preserveWidth ? maxWidth : Math.min(maxWidth, Math.max(1, Math.ceil(natWidth)));
      const height = Math.max(1, Math.ceil(natHeight));
      return { width, height };
    } catch {
      return {
        width: preserveWidth ? maxWidth : Math.max(1, Math.round(this.width || maxWidth)),
        height: Math.max(1, Math.round(this.height || 120)),
      };
    }
  }

  /**
   * @param {any} event
   * @returns {boolean}
   */
  _handleDragStart(event) {
    if (this._locked) {
      return Clutter.EVENT_PROPAGATE;
    }

    const button = typeof event?.get_button === 'function' ? event.get_button() : 0;
    if (button !== Clutter.BUTTON_PRIMARY) {
      return Clutter.EVENT_PROPAGATE;
    }

    const [stageX, stageY] = event.get_coords();
    this._dragging = true;
    this._resizingEdge = null;
    this._dragOffsetX = stageX - this.x;
    this._dragOffsetY = stageY - this.y;
    this.add_style_class_name('lyric-overlay-floating-dragging');
    applyActorCursor(this, Clutter.CursorType?.GRABBING);
    applyActorCursor(this._headerRow, Clutter.CursorType?.GRABBING);
    applyActorCursor(this._lyricsViewport, Clutter.CursorType?.GRABBING);

    this._acquireInteractionGrab();
    return Clutter.EVENT_STOP;
  }

  /**
   * @param {'left' | 'right'} edge
   * @param {any} event
   * @returns {boolean}
   */
  _handleResizeStart(edge, event) {
    if (this._locked) {
      return Clutter.EVENT_PROPAGATE;
    }

    const button = typeof event?.get_button === 'function' ? event.get_button() : 0;
    if (button !== Clutter.BUTTON_PRIMARY) {
      return Clutter.EVENT_PROPAGATE;
    }

    const [stageX, stageY] = event.get_coords();
    const { monitors, primaryIndex } = Main.layoutManager;
    const currentWidth = Math.max(
      MIN_OVERLAY_WIDTH,
      Math.round(this.width || this._lastViewModel?.maxWidth || 640),
    );

    this._resizingEdge = edge;
    this._dragging = false;
    this._resizeStartStageX = stageX;
    this._resizeStartX = this.x;
    this._resizeStartWidth = currentWidth;
    this._resizeCurrentWidth = currentWidth;
    this._resizeMonitorIndex = Array.isArray(monitors)
      ? findMonitorContainingPoint(monitors, this.x + currentWidth / 2, stageY, primaryIndex)
      : 0;

    // Ensure CSS max-width isn't constraining live set_width() during resize
    const resizeStyle = buildFloatingContainerStyle({
      maxWidth: currentWidth,
      preserveWidth: true,
      bgOpacity: this._lastViewModel?.bgOpacity ?? 55,
    });
    if (resizeStyle !== this._lastContainerStyle) {
      this._lastContainerStyle = resizeStyle;
      this.set_style(resizeStyle);
    }
    this.set_width(currentWidth);

    this.add_style_class_name('lyric-overlay-floating-dragging');
    const handle = edge === 'left' ? this._leftResizeHandle : this._rightResizeHandle;
    handle?.add_style_class_name('lyric-overlay-resize-handle-active');
    applyActorCursor(
      this,
      edge === 'left' ? Clutter.CursorType?.W_RESIZE : Clutter.CursorType?.E_RESIZE,
    );

    this._acquireInteractionGrab();
    return Clutter.EVENT_STOP;
  }

  /**
   * Acquires a Wayland-aware modal pointer grab so fast drag and edge-resize
   * motion & button-release events keep arriving even when the cursor leaves
   * the overlay bounds over other Wayland application windows.
   *
   * @returns {void}
   */
  _acquireInteractionGrab() {
    this._releaseInteractionGrab();

    try {
      const grab = Main.pushModal(this, { actionMode: Shell.ActionMode.NORMAL });
      if (grab) {
        this._modalGrab = grab;
      }
    } catch {
      this._modalGrab = null;
    }

    if (this._modalGrab === null) {
      try {
        this._stageGrab = global.stage.grab(this);
      } catch {
        this._stageGrab = null;
      }
    }

    // Listen directly on `this` (the grab root): when Clutter holds a grab on
    // `this`, captured-event dispatches starting at `this`, NOT `global.stage`.
    this._stageCaptureId = this.connect(
      'captured-event',
      /**
       * @param {unknown} _actor
       * @param {any} capturedEvent
       * @returns {boolean}
       */
      (_actor, capturedEvent) => this._handleStageEvent(capturedEvent),
    );
  }

  /**
   * @param {any} event
   * @returns {boolean}
   */
  _handleStageEvent(event) {
    if (!this._isInteracting()) {
      return Clutter.EVENT_PROPAGATE;
    }

    const eventType = typeof event?.type === 'function' ? event.type() : -1;

    if (eventType === Clutter.EventType.MOTION) {
      // Safety net: if button 1 is no longer pressed (e.g. dropped release on
      // touchpad), terminate the grab immediately so input can never stick.
      if (typeof event?.get_state === 'function') {
        const state = event.get_state();
        if ((state & Clutter.ModifierType.BUTTON1_MASK) === 0) {
          this._endInteraction(true);
          return Clutter.EVENT_PROPAGATE;
        }
      }

      const [stageX, stageY] = event.get_coords();
      if (this._resizingEdge !== null) {
        this._applyResizedWidth(stageX);
      } else {
        const rawX = stageX - this._dragOffsetX;
        const rawY = stageY - this._dragOffsetY;
        this._applyDraggedPosition(rawX, rawY, stageX, stageY);
      }
      return Clutter.EVENT_STOP;
    }

    if (
      eventType === Clutter.EventType.BUTTON_RELEASE ||
      eventType === Clutter.EventType.TOUCH_END ||
      eventType === Clutter.EventType.TOUCH_CANCEL
    ) {
      this._endInteraction(eventType !== Clutter.EventType.TOUCH_CANCEL);
      return Clutter.EVENT_STOP;
    }

    if (eventType === Clutter.EventType.KEY_PRESS) {
      const symbol = typeof event?.get_key_symbol === 'function' ? event.get_key_symbol() : 0;
      if (symbol === Clutter.KEY_Escape) {
        this._endInteraction(false);
        this.reposition();
        return Clutter.EVENT_STOP;
      }
    }

    return Clutter.EVENT_PROPAGATE;
  }

  /**
   * @param {number} stageX
   * @returns {void}
   */
  _applyResizedWidth(stageX) {
    const edge = this._resizingEdge;
    if (edge === null) {
      return;
    }

    const { monitors } = Main.layoutManager;
    if (!Array.isArray(monitors) || monitors.length === 0) {
      return;
    }

    const workArea = Main.layoutManager.getWorkAreaForMonitor(this._resizeMonitorIndex);
    const resized = computeResizedOverlay({
      edge,
      startX: this._resizeStartX,
      startWidth: this._resizeStartWidth,
      deltaX: stageX - this._resizeStartStageX,
      minWidth: MIN_OVERLAY_WIDTH,
      maxWidth: MAX_OVERLAY_WIDTH,
      workArea,
    });

    this._resizeCurrentWidth = resized.width;
    this.set_width(resized.width);
    this.set_position(resized.x, this.y);
  }

  /**
   * @param {number} rawX
   * @param {number} rawY
   * @param {number} pointerX
   * @param {number} pointerY
   * @returns {void}
   */
  _applyDraggedPosition(rawX, rawY, pointerX, pointerY) {
    const { monitors, primaryIndex } = Main.layoutManager;
    if (!Array.isArray(monitors) || monitors.length === 0) {
      this.set_position(Math.round(rawX), Math.round(rawY));
      return;
    }

    const monitorIndex = findMonitorContainingPoint(monitors, pointerX, pointerY, primaryIndex);
    const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
    const maxWidth = this._lastViewModel?.maxWidth ?? 640;
    const preserveWidth = this._lastViewModel?.preserveWidth ?? true;
    const { width, height } = this._measureSize(maxWidth, preserveWidth);

    const clamped = clampOverlayCoordinates({
      workArea,
      overlayWidth: width,
      overlayHeight: height,
      x: rawX,
      y: rawY,
    });
    this.set_position(clamped.x, clamped.y);
  }

  /**
   * @param {boolean} commit
   * @returns {void}
   */
  _endInteraction(commit) {
    if (!this._isInteracting()) {
      return;
    }

    const wasResizing = this._resizingEdge !== null;
    const committedWidth = this._resizeCurrentWidth;
    const resizeMonitorIndex = this._resizeMonitorIndex;

    this._dragging = false;
    this._resizingEdge = null;
    this._releaseInteractionGrab();
    this.remove_style_class_name('lyric-overlay-floating-dragging');
    this._leftResizeHandle?.remove_style_class_name('lyric-overlay-resize-handle-active');
    this._rightResizeHandle?.remove_style_class_name('lyric-overlay-resize-handle-active');
    applyActorCursor(this, Clutter.CursorType?.DEFAULT);
    applyActorCursor(this._headerRow, Clutter.CursorType?.GRAB);
    applyActorCursor(this._lyricsViewport, Clutter.CursorType?.GRAB);

    if (!commit) {
      if (wasResizing && this._lastViewModel !== null) {
        this.set_width(this._lastViewModel.preserveWidth ? this._lastViewModel.maxWidth : -1);
      }
      return;
    }

    const { monitors, primaryIndex } = Main.layoutManager;
    if (!Array.isArray(monitors) || monitors.length === 0) {
      return;
    }

    if (wasResizing) {
      if (typeof this._onWidthCommitted !== 'function') {
        return;
      }
      const workArea = Main.layoutManager.getWorkAreaForMonitor(resizeMonitorIndex);
      const { height } = this._measureSize(committedWidth, true);
      const ratios = computeRatiosFromCoordinates({
        workArea,
        overlayWidth: committedWidth,
        overlayHeight: height,
        x: this.x,
        y: this.y,
      });
      this._onWidthCommitted(committedWidth, ratios.xRatio, ratios.yRatio, resizeMonitorIndex);
      return;
    }

    if (typeof this._onPositionCommitted !== 'function') {
      return;
    }

    const maxWidth = this._lastViewModel?.maxWidth ?? 640;
    const preserveWidth = this._lastViewModel?.preserveWidth ?? true;
    const { width, height } = this._measureSize(maxWidth, preserveWidth);
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;
    const monitorIndex = findMonitorContainingPoint(monitors, centerX, centerY, primaryIndex);
    const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

    const ratios = computeRatiosFromCoordinates({
      workArea,
      overlayWidth: width,
      overlayHeight: height,
      x: this.x,
      y: this.y,
    });

    this._onPositionCommitted(ratios.xRatio, ratios.yRatio, monitorIndex);
  }

  /**
   * @returns {void}
   */
  _releaseInteractionGrab() {
    if (this._stageCaptureId !== 0) {
      try {
        this.disconnect(this._stageCaptureId);
      } catch {
        // already disconnected
      }
      this._stageCaptureId = 0;
    }

    if (this._modalGrab !== null) {
      try {
        Main.popModal(this._modalGrab);
      } catch {
        // modal already popped
      }
      this._modalGrab = null;
    }

    if (this._stageGrab !== null) {
      try {
        this._stageGrab.dismiss();
      } catch {
        // grab already dismissed
      }
      this._stageGrab = null;
    }
  }

  /**
   * @param {any} target
   * @param {string} signal
   * @param {(...args: any[]) => any} callback
   * @returns {void}
   */
  _connect(target, signal, callback) {
    const id = target.connect(signal, callback);
    this._connections.push([target, id]);
  }

  /** @override */
  destroy() {
    this._endInteraction(false);
    this._syncChromeInputRegion(false);
    for (const [target, id] of this._connections.splice(0)) {
      try {
        target.disconnect(id);
      } catch {
        // target already finalized
      }
    }

    this._vinylDisc?.remove_all_transitions();
    this._lyricsTrack?.remove_all_transitions();
    this._prevLabel?.remove_all_transitions();
    this._currentLabel?.remove_all_transitions();
    this._nextLabel?.remove_all_transitions();

    this._leftResizeHandle = null;
    this._rightResizeHandle = null;
    this._bodyColumn = null;
    this._vinylSpindle = null;
    this._vinylCover = null;
    this._vinylDisc = null;
    this._trackTitleLabel = null;
    this._trackSubLabel = null;
    this._trackMetaBox = null;
    this._headerRow = null;
    this._lyricsViewport = null;
    this._lyricsTrack = null;
    this._prevLabel = null;
    this._currentLabel = null;
    this._nextLabel = null;
    this._playPauseIcon = null;
    this._prevButton = null;
    this._playPauseButton = null;
    this._nextButton = null;
    this._controlsBox = null;
    this._lastViewModel = null;
    this._onPositionCommitted = null;
    this._onWidthCommitted = null;
    this._onPlaybackAction = null;
    super.destroy();
  }
}

export const FloatingOverlay = /** @type {typeof FloatingOverlayBase} */ (
  GObject.registerClass(FloatingOverlayBase)
);

/**
 * Applies a native Clutter cursor type on GNOME 50-51 (no-op on older GNOME).
 *
 * @param {InstanceType<typeof St.Widget> | null | undefined} actor
 * @param {number | undefined} cursorType
 * @returns {void}
 */
function applyActorCursor(actor, cursorType) {
  if (actor && typeof cursorType === 'number' && typeof actor.set_cursor_type === 'function') {
    actor.set_cursor_type(cursorType);
  }
}

/**
 * Supports both GNOME 48-51 (`set_orientation`) and GNOME 46-47 (`set_vertical`).
 *
 * @param {InstanceType<typeof St.BoxLayout>} box
 * @param {number} orientation
 * @returns {void}
 */
function setBoxOrientation(box, orientation) {
  if (typeof box.set_orientation === 'function') {
    box.set_orientation(orientation);
    return;
  }
  if (typeof box.set_vertical === 'function') {
    box.set_vertical(orientation === Clutter.Orientation.VERTICAL);
  }
}

/**
 * @param {string} styleClass
 * @returns {InstanceType<typeof St.Label>}
 */
function createSingleLineMetaLabel(styleClass) {
  const label = new St.Label({
    text: '',
    style_class: styleClass,
    x_expand: true,
    x_align: Clutter.ActorAlign.START,
  });

  const clutterText = label.clutter_text;
  if (clutterText) {
    clutterText.set_single_line_mode?.(true);
    clutterText.set_ellipsize?.(Pango.EllipsizeMode.END);
  }

  return label;
}

/**
 * @param {string} styleClass
 * @returns {InstanceType<typeof St.Label>}
 */
function createFloatingLabel(styleClass) {
  const label = new St.Label({
    text: '',
    style_class: styleClass,
    x_expand: true,
    x_align: Clutter.ActorAlign.FILL,
  });

  const clutterText = label.clutter_text;
  if (clutterText) {
    clutterText.set_line_wrap?.(true);
    clutterText.set_line_wrap_mode?.(Pango.WrapMode.WORD_CHAR);
    clutterText.set_ellipsize?.(Pango.EllipsizeMode.NONE);
  }

  return label;
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @param {{
 *   text: string,
 *   visible: boolean,
 *   align: import('../domain/settings/types.js').TextAlign,
 *   style: string,
 * }} props
 * @returns {void}
 */
function updateFloatingLabel(label, props) {
  label.visible = props.visible;
  if (!props.visible) {
    label.set_text('');
    return;
  }

  label.set_text(props.text);
  label.set_style(props.style);

  let actorAlign = Clutter.ActorAlign.CENTER;
  let pangoAlign = Pango.Alignment.CENTER;
  if (props.align === 'left') {
    actorAlign = Clutter.ActorAlign.START;
    pangoAlign = Pango.Alignment.LEFT;
  } else if (props.align === 'right') {
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
