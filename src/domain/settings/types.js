/**
 * @typedef {'floating' | 'panel'} DisplayMode
 * @typedef {'left' | 'center' | 'right'} PanelPosition
 * @typedef {'left' | 'center' | 'right'} TextAlign
 * @typedef {'track' | 'idle' | 'hidden'} FallbackMode
 * @typedef {'auto' | 'spotify' | 'youtube-music' | 'apple-music' | 'generic'} BrowserPlayerService
 * @typedef {'default' | 'system' | 'white' | 'black' | 'custom'} TextColorMode
 * @typedef {1 | 2 | 3} FloatingLineCount
 *
 * @typedef {Readonly<{
 *   displayMode?: unknown,
 *   lyricsVisible?: unknown,
 *   fallbackMode?: unknown,
 *   floatingLocked?: unknown,
 *   floatingLines?: unknown,
 *   floatingXRatio?: unknown,
 *   floatingYRatio?: unknown,
 *   floatingMonitorIndex?: unknown,
 *   floatingMaxWidth?: unknown,
 *   floatingPreserveWidth?: unknown,
 *   floatingShowVinyl?: unknown,
 *   floatingShowTrackInfo?: unknown,
 *   floatingShowControls?: unknown,
 *   floatingShowProgress?: unknown,
 *   floatingFontSize?: unknown,
 *   floatingBgOpacity?: unknown,
 *   floatingAnimate?: unknown,
 *   floatingHideFullscreen?: unknown,
 *   floatingHidePaused?: unknown,
 *   panelPosition?: unknown,
 *   panelIndex?: unknown,
 *   panelMaxWidth?: unknown,
 *   textAlign?: unknown,
 *   textColorMode?: unknown,
 *   customTextColor?: unknown,
 *   secondaryOpacity?: unknown,
 *   textShadowEnabled?: unknown,
 *   lyricsOffsetMs?: unknown,
 *   playerPriority?: unknown,
 *   browserPlayerService?: unknown,
 *   cacheEnabled?: unknown,
 *   debugLogging?: unknown,
 * }>} RawSettings
 *
 * @typedef {Readonly<{
 *   displayMode: DisplayMode,
 *   lyricsVisible: boolean,
 *   fallbackMode: FallbackMode,
 *   floatingLocked: boolean,
 *   floatingLines: FloatingLineCount,
 *   floatingXRatio: number,
 *   floatingYRatio: number,
 *   floatingMonitorIndex: number,
 *   floatingMaxWidth: number,
 *   floatingPreserveWidth: boolean,
 *   floatingShowVinyl: boolean,
 *   floatingShowTrackInfo: boolean,
 *   floatingShowControls: boolean,
 *   floatingShowProgress: boolean,
 *   floatingFontSize: number,
 *   floatingBgOpacity: number,
 *   floatingAnimate: boolean,
 *   floatingHideFullscreen: boolean,
 *   floatingHidePaused: boolean,
 *   panelPosition: PanelPosition,
 *   panelIndex: number,
 *   panelMaxWidth: number,
 *   textAlign: TextAlign,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   secondaryOpacity: number,
 *   textShadowEnabled: boolean,
 *   lyricsOffsetMs: number,
 *   playerPriority: readonly string[],
 *   browserPlayerService: BrowserPlayerService,
 *   cacheEnabled: boolean,
 *   debugLogging: boolean,
 * }>} LyricOverlaySettings
 */

export {};
