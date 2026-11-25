import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { resolveMonitorIndex } from '../domain/display/floating-position.js';
import { applyLyricsOffset } from '../domain/display/lyrics-offset.js';
import {
  displayStateFromLookup,
  displayStateFromSyncedPosition,
} from '../domain/display/lyrics-state.js';
import { displayStateFromPlayer } from '../domain/display/player-state.js';
import { getInterpolatedClockPosition, updateSyncedClock } from '../domain/display/sync-clock.js';
import { shouldPollSyncedLyrics } from '../domain/display/sync-polling.js';
import { updateStagnantSyncedPositionEstimate } from '../domain/display/sync-position-estimator.js';
import {
  shouldHoldLowConfidenceSyncedPosition,
  shouldUseRelativeSyncedLyricsPosition,
  shouldUseSyncedLyricsPosition,
} from '../domain/display/sync-position-policy.js';
import { buildFloatingViewModel, buildPanelViewModel } from '../domain/display/view-model.js';
import { selectActivePlayer } from '../domain/mpris/selection.js';
import {
  shouldRefreshPlayerSelection,
  shouldRefreshSyncedLyrics,
  shouldRepositionPanelIndicator,
  shouldSwitchDisplayMode,
} from '../domain/settings/change.js';
import { normalizePanelIndex, normalizePanelPosition } from '../domain/settings/normalize.js';
import { FloatingOverlay } from '../shell/floating-overlay.js';
import { PanelLyricIndicator } from '../shell/panel-indicator.js';
import { TrayIndicator } from '../shell/tray-indicator.js';
import { ArtworkLoader } from './artwork.js';
import { KeybindingManager } from './keybindings.js';
import { LifecycleRegistry } from './lifecycle.js';
import { LyricsCache } from './lyrics/cache.js';
import { LrclibProvider } from './lyrics/lrclib.js';
import { LyricsService } from './lyrics/service.js';
import { RuntimeLogger } from './logger.js';
import { PlayerProxy } from './mpris/player.js';
import { MprisService } from './mpris/service.js';
import { StablePlayerProxy } from './mpris/stable-player.js';
import { SettingsAdapter } from './settings.js';

/**
 * @import { DisplayState, FloatingEnvironment } from '../domain/display/types.js'
 * @import { FloatingViewModel, PanelViewModel } from '../domain/display/view-model.js'
 * @import { LyricsProviderResult } from '../domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../domain/mpris/types.js'
 * @import { LyricOverlaySettings } from '../domain/settings/types.js'
 * @import { StagnantSyncedPositionEstimate } from '../domain/display/sync-position-estimator.js'
 * @import { SyncedClockState } from '../domain/display/sync-clock.js'
 * @import { GSettingsBackend } from './settings.js'
 *
 * @typedef {Readonly<{
 *   uuid: string,
 *   getSettings(): GSettingsBackend,
 *   openPreferences(): void,
 * }>} ExtensionHandle
 *
 * @typedef {Readonly<{
 *   render(viewModel: PanelViewModel): void,
 *   setClickAction?(callback: (() => void) | null): void,
 *   destroy(): void,
 * }>} PanelIndicatorHandle
 *
 * @typedef {Readonly<{
 *   render(viewModel: FloatingViewModel): void,
 *   updateProgress(positionMs: number | null, durationMs: number | null): void,
 *   reposition(): void,
 *   setPositionCommittedHandler(
 *     callback: ((xRatio: number, yRatio: number, monitorIndex: number) => void) | null,
 *   ): void,
 *   setWidthCommittedHandler(
 *     callback:
 *       | ((width: number, xRatio: number, yRatio: number, monitorIndex: number) => void)
 *       | null,
 *   ): void,
 *   setPlaybackActionHandler(
 *     callback: ((action: import('../domain/mpris/types.js').PlaybackAction) => void) | null,
 *   ): void,
 *   setSeekCommittedHandler(callback: ((positionMs: number) => void) | null): void,
 *   destroy(): void,
 * }>} FloatingOverlayHandle
 *
 * @typedef {{
 *   proxy: StablePlayerProxy,
 *   lifecycle: LifecycleRegistry,
 * }} TrackedProxy
 */

const POSITION_POLL_INTERVAL_MS = 500;
const SYNC_TICK_INTERVAL_MS = 100;
const FIREFOX_STAGNANT_POSITION_THRESHOLD_MS = 2_500;

export class LyricOverlayController {
  /** @type {ExtensionHandle} */
  #extension;

  /** @type {PanelIndicatorHandle | null} */
  #panelIndicator = null;

  /** @type {(() => void) | null} */
  #destroyPanelIndicator = null;

  /** @type {FloatingOverlayHandle | null} */
  #floatingOverlay = null;

  /** @type {(() => void) | null} */
  #destroyFloatingOverlay = null;

  /** @type {any | null} */
  #trayIndicator = null;

  /** @type {LifecycleRegistry | null} */
  #lifecycle = null;

  /** @type {SettingsAdapter | null} */
  #settings = null;

  /** @type {RuntimeLogger | null} */
  #logger = null;

  /** @type {LyricOverlaySettings | null} */
  #currentSettings = null;

  /** @type {DisplayState} */
  #displayState = { kind: 'idle' };

  /** @type {boolean} */
  #enabled = false;

  /** @type {boolean} */
  #overviewVisible = false;

  /** @type {any} */
  #connection = null;

  /** @type {MprisService | null} */
  #mprisService = null;

  /** @type {Map<string, TrackedProxy>} */
  #proxies = new Map();

  /** @type {string | null} */
  #lastSelectedBusName = null;

  /** @type {LyricsService | null} */
  #lyricsService = null;

  /** @type {ArtworkLoader | null} */
  #artworkLoader = null;

  /** @type {string | null} */
  #currentArtUri = null;

  /** @type {PlayerSnapshot | null} */
  #activePlayer = null;

  /** @type {LyricsProviderResult | null} */
  #currentLookup = null;

  /** @type {number} */
  #syncSourceId = 0;

  /** @type {string | null} */
  #lastSyncedSignature = null;

  /** @type {string | null} */
  #syncPositionTrackKey = null;

  /** @type {number | null} */
  #syncPositionOffsetMs = null;

  /** @type {number | null} */
  #lastAcceptedSyncPositionMs = null;

  /** @type {StagnantSyncedPositionEstimate | null} */
  #syncPositionEstimate = null;

  /** @type {SyncedClockState | null} */
  #syncedClock = null;

  /** @type {number} */
  #lastPollTimeMs = 0;

  /**
   * @param {ExtensionHandle} extension
   */
  constructor(extension) {
    this.#extension = extension;
  }

  /**
   * @returns {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * @returns {void}
   */
  enable() {
    if (this.#enabled) {
      return;
    }

    this.#enabled = true;
    this.#lifecycle = new LifecycleRegistry();
    this.#lifecycle.addSource(
      () => this.#syncSourceId,
      (id) => GLib.source_remove(id),
    );

    const gsettings = this.#extension.getSettings();
    this.#settings = new SettingsAdapter(gsettings, this.#lifecycle);
    this.#currentSettings = this.#settings.read();
    this.#logger = new RuntimeLogger(
      'LyricOverlay',
      () => this.#currentSettings?.debugLogging === true,
    );
    this.#logger.debug('controller-enable', {
      uuid: this.#extension.uuid,
      displayMode: this.#currentSettings.displayMode,
    });

    this.#overviewVisible = Main.overview.visible === true;
    this.#watchShellEnvironment();

    this.#settings.subscribe((settings) => {
      const previous = this.#currentSettings;
      this.#currentSettings = settings;
      this.#logger?.debug('settings-changed', {
        displayMode: settings.displayMode,
        floatingLocked: settings.floatingLocked,
        lyricsVisible: settings.lyricsVisible,
      });

      if (previous !== null && shouldSwitchDisplayMode(previous, settings)) {
        this.#mountActiveDisplay();
      } else if (previous !== null && shouldRepositionPanelIndicator(previous, settings)) {
        this.#replacePanelIndicator();
      }

      if (previous !== null && shouldRefreshPlayerSelection(previous, settings)) {
        this.#refreshSelection();
        return;
      }

      if (previous !== null && shouldRefreshSyncedLyrics(previous, settings)) {
        this.#refreshSyncedPosition();
      }

      if (
        previous !== null &&
        (previous.floatingShowProgress !== settings.floatingShowProgress ||
          previous.displayMode !== settings.displayMode)
      ) {
        this.#updateSyncLoop();
      }

      this.#refreshDisplay();
    });

    const keybindings = new KeybindingManager(gsettings, this.#lifecycle, {
      logger: this.#logger.child('keys'),
    });
    keybindings.register({
      onToggleMode: () => this.#settings?.toggleDisplayMode(),
      onToggleLock: () => this.#settings?.toggleFloatingLocked(),
      onToggleVisible: () => this.#settings?.toggleLyricsVisible(),
    });

    this.#artworkLoader = new ArtworkLoader(this.#lifecycle, {
      logger: this.#logger.child('art'),
    });
    this.#mountTrayIndicator(gsettings);
    this.#mountActiveDisplay();
    this.#startLyricsService();
    this.#startMprisDiscovery();
  }

  /**
   * @returns {void}
   */
  disable() {
    if (!this.#enabled) {
      return;
    }

    this.#enabled = false;
    this.#logger?.debug('controller-disable');
    const lifecycle = this.#lifecycle;
    this.#lifecycle = null;
    this.#settings = null;
    this.#currentSettings = null;
    this.#mprisService = null;
    this.#connection = null;
    this.#proxies.clear();
    this.#lastSelectedBusName = null;
    this.#lyricsService = null;
    this.#artworkLoader = null;
    this.#currentArtUri = null;
    this.#activePlayer = null;
    this.#currentLookup = null;
    this.#stopSyncLoop();
    this.#displayState = { kind: 'idle' };
    lifecycle?.dispose();
    this.#panelIndicator = null;
    this.#destroyPanelIndicator = null;
    this.#floatingOverlay = null;
    this.#destroyFloatingOverlay = null;
    this.#trayIndicator = null;
    this.#logger = null;
  }

  /**
   * @returns {void}
   */
  #watchShellEnvironment() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    const showingId = Main.overview.connect('showing', () => {
      this.#overviewVisible = true;
      this.#render();
    });
    lifecycle.addSignal(
      () => Main.overview,
      () => showingId,
    );

    const hiddenId = Main.overview.connect('hidden', () => {
      this.#overviewVisible = false;
      this.#render();
    });
    lifecycle.addSignal(
      () => Main.overview,
      () => hiddenId,
    );

    const fullscreenId = global.display.connect('in-fullscreen-changed', () => {
      this.#render();
    });
    lifecycle.addSignal(
      () => global.display,
      () => fullscreenId,
    );

    const monitorsId = Main.layoutManager.connect('monitors-changed', () => {
      this.#floatingOverlay?.reposition();
      this.#render();
    });
    lifecycle.addSignal(
      () => Main.layoutManager,
      () => monitorsId,
    );
  }

  /**
   * @param {GSettingsBackend} gsettings
   * @returns {void}
   */
  #mountTrayIndicator(gsettings) {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null || this.#trayIndicator !== null) {
      return;
    }

    const tray = new TrayIndicator(gsettings, this.#extension);
    let destroyed = false;
    this.#trayIndicator = tray;
    Main.panel.addToStatusArea(`${this.#extension.uuid}-tray`, tray, 0, 'right');

    lifecycle.add(() => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      tray.destroy();
      if (this.#trayIndicator === tray) {
        this.#trayIndicator = null;
      }
    });
  }

  /**
   * Mounts whichever display surface matches `displayMode` and tears down the other.
   *
   * @returns {void}
   */
  #mountActiveDisplay() {
    if (!this.#enabled || this.#currentSettings === null) {
      return;
    }

    if (this.#currentSettings.displayMode === 'panel') {
      this.#unmountFloatingOverlay();
      this.#mountPanelIndicator();
    } else {
      this.#unmountPanelIndicator();
      this.#mountFloatingOverlay();
    }

    this.#render();
  }

  /**
   * @returns {void}
   */
  #mountFloatingOverlay() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null || this.#floatingOverlay !== null) {
      return;
    }

    const overlay = /** @type {FloatingOverlayHandle} */ (new FloatingOverlay());
    overlay.setPositionCommittedHandler((xRatio, yRatio, monitorIndex) => {
      this.#settings?.setFloatingPosition(xRatio, yRatio, monitorIndex);
    });
    overlay.setWidthCommittedHandler((width, xRatio, yRatio, monitorIndex) => {
      this.#settings?.setFloatingWidthAndPosition(width, xRatio, yRatio, monitorIndex);
    });
    overlay.setPlaybackActionHandler((action) => {
      this.#invokePlaybackAction(action);
    });
    overlay.setSeekCommittedHandler((positionMs) => {
      this.#seekTo(positionMs);
    });

    Main.layoutManager.uiGroup.add_child(overlay);

    let destroyed = false;
    this.#floatingOverlay = overlay;
    this.#destroyFloatingOverlay = () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      try {
        Main.layoutManager.uiGroup.remove_child(overlay);
      } catch {
        // already removed
      }
      overlay.destroy();
      if (this.#floatingOverlay === overlay) {
        this.#floatingOverlay = null;
      }
    };
    lifecycle.add(this.#destroyFloatingOverlay);
  }

  /**
   * @returns {void}
   */
  #unmountFloatingOverlay() {
    this.#destroyFloatingOverlay?.();
    this.#destroyFloatingOverlay = null;
  }

  /**
   * @returns {void}
   */
  #mountPanelIndicator() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null || this.#currentSettings === null || this.#panelIndicator !== null) {
      return;
    }

    const indicator = /** @type {PanelIndicatorHandle} */ (new PanelLyricIndicator());
    indicator.setClickAction?.(() => {
      this.#extension.openPreferences();
    });

    let destroyed = false;
    this.#panelIndicator = indicator;
    this.#destroyPanelIndicator = () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      indicator.destroy();
      if (this.#panelIndicator === indicator) {
        this.#panelIndicator = null;
      }
    };

    Main.panel.addToStatusArea(
      this.#extension.uuid,
      indicator,
      normalizePanelIndex(this.#currentSettings.panelIndex),
      normalizePanelPosition(this.#currentSettings.panelPosition),
    );
    lifecycle.add(this.#destroyPanelIndicator);
  }

  /**
   * @returns {void}
   */
  #unmountPanelIndicator() {
    this.#destroyPanelIndicator?.();
    this.#destroyPanelIndicator = null;
  }

  /**
   * @returns {void}
   */
  #replacePanelIndicator() {
    if (!this.#enabled || this.#currentSettings?.displayMode !== 'panel') {
      return;
    }
    this.#unmountPanelIndicator();
    this.#mountPanelIndicator();
    this.#render();
  }

  /**
   * @returns {void}
   */
  #startLyricsService() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    const logger = this.#logger?.child('lyrics');
    const provider = new LrclibProvider(lifecycle, { logger: logger?.child('lrclib') });
    const cache = new LyricsCache(
      lifecycle,
      () => ({
        cacheEnabled: this.#currentSettings?.cacheEnabled ?? true,
      }),
      { logger: logger?.child('cache') },
    );

    this.#lyricsService = new LyricsService(lifecycle, provider, cache, {
      getBrowserPlayerService: () => this.#currentSettings?.browserPlayerService ?? 'auto',
      logger,
    });
    this.#lyricsService.onLookupChanged((player, lookup) => {
      if (!this.#enabled) {
        return;
      }
      this.#activePlayer = player;
      this.#currentLookup = lookup;
      this.#refreshDisplay();
      this.#updateSyncLoop();
    });
  }

  /**
   * @returns {void}
   */
  #startMprisDiscovery() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    this.#connection = Gio.DBus.session;
    this.#mprisService = new MprisService(this.#connection, lifecycle, {
      logger: this.#logger?.child('mpris'),
    });
    this.#mprisService.onPlayersChanged((names) => {
      this.#syncPlayers(names);
    });
    this.#mprisService.start();
  }

  /**
   * @param {readonly string[]} names
   * @returns {void}
   */
  #syncPlayers(names) {
    if (!this.#enabled || this.#lifecycle === null || this.#connection === null) {
      return;
    }

    const next = new Set(names);
    for (const [busName, tracked] of this.#proxies) {
      if (!next.has(busName)) {
        tracked.lifecycle.dispose();
        this.#proxies.delete(busName);
      }
    }

    for (const busName of names) {
      if (!this.#proxies.has(busName)) {
        this.#registerProxy(busName);
      }
    }

    this.#refreshSelection();
  }

  /**
   * @param {string} busName
   * @returns {void}
   */
  #registerProxy(busName) {
    const parent = this.#lifecycle;
    if (parent === null || this.#connection === null) {
      return;
    }

    const child = new LifecycleRegistry();
    parent.add(child);

    const rawProxy = new PlayerProxy(this.#connection, busName, child, {
      logger: this.#logger?.child('player'),
    });
    const proxy = new StablePlayerProxy(rawProxy, child, {
      getBrowserPlayerService: () => this.#currentSettings?.browserPlayerService ?? 'auto',
      logger: this.#logger?.child('player') ?? null,
      schedule: scheduleTimeout,
    });
    proxy.onSnapshot(() => {
      this.#refreshPeerPlayerProperties(proxy.busName);
      this.#refreshSelection();
    });
    this.#proxies.set(busName, { proxy, lifecycle: child });
    proxy.start();
  }

  /**
   * @param {string} sourceBusName
   * @returns {void}
   */
  #refreshPeerPlayerProperties(sourceBusName) {
    for (const [busName, tracked] of this.#proxies) {
      if (busName !== sourceBusName) {
        tracked.proxy.refreshProperties();
      }
    }
  }

  /**
   * @returns {void}
   */
  #refreshSelection() {
    if (!this.#enabled || this.#currentSettings === null) {
      return;
    }

    /** @type {PlayerSnapshot[]} */
    const snapshots = [];
    for (const tracked of this.#proxies.values()) {
      const snapshot = tracked.proxy.snapshot();
      if (snapshot !== null) {
        snapshots.push(snapshot);
      }
    }

    const active = selectActivePlayer(
      snapshots,
      this.#lastSelectedBusName,
      this.#currentSettings.playerPriority,
    );

    if (active !== null) {
      this.#lastSelectedBusName = active.busName;
    }

    this.#activePlayer = active;
    this.#artworkLoader?.resolve(active?.artUrl ?? null, (artUri) => {
      if (!this.#enabled) {
        return;
      }
      this.#currentArtUri = artUri;
      this.#render();
    });
    if (this.#lyricsService !== null) {
      this.#lyricsService.setActivePlayer(active);
    } else {
      this.#refreshDisplay();
    }
    this.#updateSyncLoop();
  }

  /**
   * @param {import('../domain/mpris/types.js').PlaybackAction} action
   * @returns {void}
   */
  #invokePlaybackAction(action) {
    if (!this.#enabled || this.#activePlayer === null) {
      return;
    }
    const tracked = this.#proxies.get(this.#activePlayer.busName);
    tracked?.proxy.invokeMethod(action);
  }

  /**
   * @param {number} targetPositionMs
   * @returns {void}
   */
  #seekTo(targetPositionMs) {
    const player = this.#activePlayer;
    if (!this.#enabled || player === null) {
      return;
    }

    const tracked = this.#proxies.get(player.busName);
    if (tracked === undefined) {
      return;
    }

    const nowMs = monotonicNowMs();
    const currentPosMs =
      this.#syncedClock !== null ? getInterpolatedClockPosition(this.#syncedClock, nowMs) : null;
    tracked.proxy.seekTo(player.trackId, targetPositionMs, currentPosMs);

    const trackKey = this.#buildPositionTrackKey(player, this.#currentLookup);
    this.#syncPositionOffsetMs = null;
    this.#lastAcceptedSyncPositionMs = targetPositionMs;
    this.#syncPositionEstimate = null;
    this.#syncedClock = Object.freeze({
      trackKey,
      basePositionMs: Math.max(0, targetPositionMs),
      baseTimestampMs: nowMs,
      lastSampledRawMs: Math.max(0, targetPositionMs),
      playbackStatus: player.playbackStatus,
    });
    this.#advanceSyncedLyrics(nowMs);
  }

  /**
   * @returns {void}
   */
  #refreshSyncedPosition() {
    if (this.#syncSourceId === 0) {
      return;
    }
    this.#pollSyncedPosition();
  }

  /**
   * @returns {void}
   */
  #refreshDisplay() {
    if (!this.#enabled) {
      return;
    }

    if (this.#activePlayer === null) {
      this.#displayState = displayStateFromPlayer(null);
    } else if (this.#currentLookup === null) {
      this.#displayState = displayStateFromPlayer(this.#activePlayer);
    } else {
      this.#displayState = displayStateFromLookup(this.#activePlayer, this.#currentLookup, {
        previousState: this.#displayState,
      });
    }

    this.#render();
  }

  /**
   * @returns {void}
   */
  #updateSyncLoop() {
    if (!this.#shouldTrackPosition()) {
      this.#stopSyncLoop();
      this.#syncFloatingProgress();
      return;
    }

    if (this.#syncSourceId !== 0) {
      return;
    }

    this.#resetSyncPositionOffset();
    this.#lastSyncedSignature = null;
    this.#lastPollTimeMs = monotonicNowMs();
    this.#pollSyncedPosition();
    this.#syncSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SYNC_TICK_INTERVAL_MS, () => {
      if (!this.#shouldTrackPosition()) {
        this.#syncSourceId = 0;
        this.#lastSyncedSignature = null;
        this.#resetSyncPositionOffset();
        this.#syncFloatingProgress();
        return GLib.SOURCE_REMOVE;
      }
      const nowMs = monotonicNowMs();
      if (nowMs - this.#lastPollTimeMs >= POSITION_POLL_INTERVAL_MS) {
        this.#lastPollTimeMs = nowMs;
        this.#pollSyncedPosition();
      }
      this.#advanceSyncedLyrics(nowMs);
      return GLib.SOURCE_CONTINUE;
    });
  }

  /**
   * @returns {boolean}
   */
  #shouldPollSyncedLyrics() {
    return shouldPollSyncedLyrics({
      enabled: this.#enabled,
      player: this.#activePlayer,
      lookup: this.#currentLookup,
      browserPlayerService: this.#currentSettings?.browserPlayerService ?? 'auto',
    });
  }

  /**
   * @returns {boolean}
   */
  #shouldTrackPosition() {
    if (this.#shouldPollSyncedLyrics()) {
      return true;
    }

    return (
      this.#enabled &&
      this.#activePlayer !== null &&
      this.#floatingOverlay !== null &&
      this.#currentSettings?.floatingShowProgress === true &&
      this.#resolveTrackDurationMs() !== null
    );
  }

  /**
   * @returns {number | null}
   */
  #resolveTrackDurationMs() {
    const playerDuration = this.#activePlayer?.durationMs;
    if (
      typeof playerDuration === 'number' &&
      Number.isFinite(playerDuration) &&
      playerDuration > 0
    ) {
      return playerDuration;
    }

    const lookup = this.#currentLookup;
    if (
      lookup !== null &&
      (lookup.kind === 'synced' || lookup.kind === 'plain' || lookup.kind === 'instrumental')
    ) {
      const providerDuration = lookup.track.durationMs;
      if (
        typeof providerDuration === 'number' &&
        Number.isFinite(providerDuration) &&
        providerDuration > 0
      ) {
        return providerDuration;
      }
    }

    return null;
  }

  /**
   * @returns {void}
   */
  #stopSyncLoop() {
    if (this.#syncSourceId !== 0) {
      try {
        GLib.source_remove(this.#syncSourceId);
      } catch {
        // already removed by GLib
      }
      this.#syncSourceId = 0;
    }
    this.#lastSyncedSignature = null;
    this.#resetSyncPositionOffset();
  }

  /**
   * @param {number} nowMs
   * @returns {void}
   */
  #advanceSyncedLyrics(nowMs) {
    const player = this.#activePlayer;
    if (player === null || this.#syncedClock === null) {
      return;
    }

    const interpolatedPositionMs = getInterpolatedClockPosition(this.#syncedClock, nowMs);
    const lookup = this.#currentLookup;
    if (lookup?.kind === 'synced') {
      this.#applySyncedDisplayPosition(player, lookup, interpolatedPositionMs);
    }

    if (this.#floatingOverlay !== null) {
      this.#floatingOverlay.updateProgress(interpolatedPositionMs, this.#resolveTrackDurationMs());
    }
  }

  /**
   * @param {PlayerSnapshot} player
   * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
   * @param {number} effectivePositionMs
   * @returns {void}
   */
  #applySyncedDisplayPosition(player, lookup, effectivePositionMs) {
    const offsetMs = this.#currentSettings?.lyricsOffsetMs ?? 0;
    const displayPositionMs = applyLyricsOffset(effectivePositionMs, offsetMs);
    const next = displayStateFromSyncedPosition(player, lookup, displayPositionMs);
    const signature =
      next.kind === 'lyrics'
        ? `${next.lineIndex ?? -1}\u0000${next.line}\u0000${next.nextLine ?? ''}`
        : next.kind;
    if (signature === this.#lastSyncedSignature) {
      return;
    }

    this.#lastSyncedSignature = signature;
    this.#displayState = next;
    this.#render();
  }

  /**
   * @returns {void}
   */
  #pollSyncedPosition() {
    const player = this.#activePlayer;
    const lookup = this.#currentLookup;
    if (player === null || !this.#shouldTrackPosition()) {
      return;
    }

    const tracked = this.#proxies.get(player.busName);
    if (tracked === undefined) {
      return;
    }

    tracked.proxy.readPosition((positionMs) => {
      if (
        !this.#shouldTrackPosition() ||
        this.#activePlayer !== player ||
        this.#currentLookup !== lookup ||
        positionMs === null
      ) {
        return;
      }

      const effectivePositionMs =
        lookup?.kind === 'synced'
          ? this.#resolveSyncedPosition(player, lookup, positionMs)
          : Math.max(0, positionMs);
      if (effectivePositionMs === null) {
        return;
      }

      const nowMs = monotonicNowMs();
      const trackKey = this.#buildPositionTrackKey(player, lookup);
      this.#syncedClock = updateSyncedClock(this.#syncedClock, {
        trackKey,
        rawPositionMs: effectivePositionMs,
        nowMs,
        playbackStatus: player.playbackStatus,
      });

      this.#advanceSyncedLyrics(nowMs);
    });
  }

  /**
   * @param {PlayerSnapshot} player
   * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
   * @param {number} rawPositionMs
   * @returns {number | null}
   */
  #resolveSyncedPosition(player, lookup, rawPositionMs) {
    const options = {
      browserPlayerService: this.#currentSettings?.browserPlayerService ?? 'auto',
      hasAcceptedSyncedPosition: this.#lastAcceptedSyncPositionMs !== null,
      hasPreviousSyncedLine: this.#lastSyncedSignature !== null,
      trackDurationMs: lookup.track.durationMs,
    };
    const trackKey = this.#buildSyncPositionTrackKey(player, lookup);

    if (this.#syncPositionTrackKey !== trackKey) {
      this.#syncPositionTrackKey = trackKey;
      this.#syncPositionOffsetMs = null;
      this.#lastAcceptedSyncPositionMs = null;
      this.#syncPositionEstimate = null;
      this.#lastSyncedSignature = null;
    }

    if (this.#syncPositionOffsetMs !== null) {
      const normalizedPositionMs = rawPositionMs - this.#syncPositionOffsetMs;
      if (shouldUseSyncedLyricsPosition(player, normalizedPositionMs, options)) {
        return this.#acceptSyncedPosition(normalizedPositionMs);
      }
      return null;
    }

    if (shouldHoldLowConfidenceSyncedPosition(player, rawPositionMs, options)) {
      const estimate = updateStagnantSyncedPositionEstimate(this.#syncPositionEstimate, {
        canEstimate: true,
        lastAcceptedPositionMs: this.#lastAcceptedSyncPositionMs,
        nowMs: monotonicNowMs(),
        rawPositionMs,
        thresholdMs: FIREFOX_STAGNANT_POSITION_THRESHOLD_MS,
        trackKey,
      });
      this.#syncPositionEstimate = estimate.state;
      if (estimate.estimated && estimate.positionMs !== null) {
        return estimate.positionMs;
      }
      return null;
    }

    if (shouldUseSyncedLyricsPosition(player, rawPositionMs, options)) {
      return this.#acceptSyncedPosition(rawPositionMs);
    }

    if (shouldUseRelativeSyncedLyricsPosition(player, rawPositionMs, options)) {
      this.#syncPositionOffsetMs = rawPositionMs;
      return this.#acceptSyncedPosition(0);
    }

    return null;
  }

  /**
   * @param {number} positionMs
   * @returns {number}
   */
  #acceptSyncedPosition(positionMs) {
    this.#lastAcceptedSyncPositionMs = positionMs;
    this.#syncPositionEstimate = null;
    return positionMs;
  }

  /**
   * @param {PlayerSnapshot} player
   * @param {LyricsProviderResult | null} lookup
   * @returns {string}
   */
  #buildPositionTrackKey(player, lookup) {
    if (lookup?.kind === 'synced') {
      return this.#buildSyncPositionTrackKey(player, lookup);
    }
    return [player.busName, player.title, player.artist].join('\u0000');
  }

  /**
   * @param {PlayerSnapshot} player
   * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
   * @returns {string}
   */
  #buildSyncPositionTrackKey(player, lookup) {
    return [
      player.busName,
      player.title,
      player.artist,
      lookup.track.trackName,
      lookup.track.artistName,
    ].join('\u0000');
  }

  /**
   * @returns {void}
   */
  #resetSyncPositionOffset() {
    this.#syncPositionTrackKey = null;
    this.#syncPositionOffsetMs = null;
    this.#lastAcceptedSyncPositionMs = null;
    this.#syncPositionEstimate = null;
    this.#syncedClock = null;
    this.#lastPollTimeMs = 0;
  }

  /**
   * @returns {FloatingEnvironment}
   */
  #readFloatingEnvironment() {
    const monitors = Main.layoutManager.monitors ?? [];
    const monitorIndex = resolveMonitorIndex(
      this.#currentSettings?.floatingMonitorIndex ?? -1,
      Main.layoutManager.primaryIndex ?? 0,
      monitors.length,
    );

    let inFullscreen = false;
    try {
      if (monitors.length > 0) {
        inFullscreen = global.display.get_monitor_in_fullscreen(monitorIndex) === true;
      }
    } catch {
      inFullscreen = false;
    }

    return {
      overviewVisible: this.#overviewVisible,
      inFullscreen,
      playbackStatus: this.#activePlayer?.playbackStatus ?? null,
      artUri: this.#currentArtUri,
      trackTitle: this.#activePlayer?.title ?? null,
      trackArtist: this.#activePlayer?.artist ?? null,
      trackAlbum: this.#activePlayer?.album ?? null,
    };
  }

  /**
   * @returns {void}
   */
  #syncFloatingProgress() {
    if (this.#floatingOverlay === null) {
      return;
    }

    const durationMs = this.#resolveTrackDurationMs();
    const positionMs =
      this.#syncedClock !== null
        ? getInterpolatedClockPosition(this.#syncedClock, monotonicNowMs())
        : null;
    this.#floatingOverlay.updateProgress(positionMs, durationMs);
  }

  /**
   * @returns {void}
   */
  #render() {
    if (!this.#currentSettings) {
      return;
    }

    if (this.#floatingOverlay !== null) {
      const viewModel = buildFloatingViewModel(
        this.#displayState,
        this.#currentSettings,
        this.#readFloatingEnvironment(),
      );
      this.#floatingOverlay.render(viewModel);
      this.#syncFloatingProgress();
      return;
    }

    if (this.#panelIndicator !== null) {
      const viewModel = buildPanelViewModel(this.#displayState, this.#currentSettings);
      this.#panelIndicator.render(viewModel);
    }
  }
}

/**
 * @param {() => void} callback
 * @param {number} delayMs
 * @returns {() => void}
 */
function scheduleTimeout(callback, delayMs) {
  let sourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
    sourceId = 0;
    callback();
    return GLib.SOURCE_REMOVE;
  });

  return () => {
    if (sourceId === 0) {
      return;
    }
    GLib.source_remove(sourceId);
    sourceId = 0;
  };
}

/**
 * @returns {number}
 */
function monotonicNowMs() {
  return Math.floor(GLib.get_monotonic_time() / 1000);
}
