/**
 * @typedef {'Playing' | 'Paused' | 'Stopped'} PlaybackStatus
 * @typedef {'Previous' | 'PlayPause' | 'Next'} PlaybackAction
 *
 * @typedef {Readonly<{
 *   busName: string,
 *   title: string,
 *   artist: string,
 *   album: string,
 *   durationMs: number | null,
 *   trackId: string | null,
 *   url: string | null,
 *   artUrl?: string | null,
 *   playbackStatus: PlaybackStatus,
 * }>} PlayerSnapshot
 */

export {};
