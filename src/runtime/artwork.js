import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

/**
 * @import { LifecycleRegistry } from './lifecycle.js'
 * @import { RuntimeLogger } from './logger.js'
 *
 * @typedef {(artUri: string | null) => void} ArtworkResolvedCallback
 */

const ART_CACHE_DIR_PARTS = ['lyric-overlay', 'art-v1'];
const ART_TIMEOUT_SECONDS = 8;
const MAX_ART_BYTES = 5 * 1024 * 1024;
const USER_AGENT = 'lyric-overlay/0.1.0 (+https://github.com/bayuzzs/gnome-lyric-overlay)';
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export class ArtworkLoader {
  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {RuntimeLogger | null} */
  #logger;

  /** @type {any} */
  #session;

  /** @type {boolean} */
  #enabled = true;

  /** @type {number} */
  #generation = 0;

  /** @type {string | null} */
  #lastUrl = null;

  /** @type {string | null} */
  #lastUri = null;

  /** @type {string | null} */
  #cacheDirPath = null;

  /** @type {boolean} */
  #dirReady = false;

  /**
   * @param {LifecycleRegistry} lifecycle
   * @param {{ logger?: RuntimeLogger | undefined }} [options]
   */
  constructor(lifecycle, options = {}) {
    this.#lifecycle = lifecycle;
    this.#logger = options.logger ?? null;
    this.#session = new Soup.Session({
      user_agent: USER_AGENT,
      timeout: ART_TIMEOUT_SECONDS,
    });

    this.#lifecycle.add(() => {
      this.#enabled = false;
      try {
        this.#session?.abort?.();
      } catch {
        // already aborted
      }
      this.#session = null;
    });
  }

  /**
   * @returns {string | null}
   */
  currentUri() {
    return this.#lastUri;
  }

  /**
   * Resolves an MPRIS `artUrl` (`file://` or `http(s)://`) to a local `file://`
   * URI usable by St CSS `background-image`.
   *
   * @param {string | null | undefined} artUrl
   * @param {ArtworkResolvedCallback} onResolved
   * @returns {void}
   */
  resolve(artUrl, onResolved) {
    if (!this.#enabled) {
      return;
    }

    const normalized = typeof artUrl === 'string' && artUrl.trim() !== '' ? artUrl.trim() : null;
    if (normalized === this.#lastUrl) {
      return;
    }

    this.#generation += 1;
    const generation = this.#generation;
    this.#lastUrl = normalized;

    if (normalized === null) {
      this.#lastUri = null;
      onResolved(null);
      return;
    }

    if (normalized.startsWith('file://')) {
      this.#lastUri = normalized;
      onResolved(normalized);
      return;
    }

    if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
      this.#lastUri = null;
      onResolved(null);
      return;
    }

    const targetFile = this.#cacheFileForUrl(normalized);
    if (targetFile === null) {
      this.#lastUri = null;
      onResolved(null);
      return;
    }

    if (targetFile.query_exists(null)) {
      const uri = targetFile.get_uri();
      this.#lastUri = uri;
      onResolved(uri);
      return;
    }

    // Clear stale cover while fetching the new track's artwork
    this.#lastUri = null;
    onResolved(null);

    const message = Soup.Message.new('GET', normalized);
    if (message === null) {
      return;
    }

    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    this.#session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} result
       * @returns {void}
       */
      (_source, result) => {
        if (!this.#enabled || cancellable.is_cancelled?.() === true) {
          return;
        }
        if (this.#generation !== generation) {
          return;
        }

        try {
          const bytes = this.#session.send_and_read_finish(result);
          const status = message.get_status?.() ?? message.status_code ?? 0;
          if (status < 200 || status >= 300 || !bytes) {
            return;
          }
          const size = typeof bytes.get_size === 'function' ? bytes.get_size() : 0;
          if (size <= 0 || size > MAX_ART_BYTES) {
            return;
          }

          this.#writeArtBytes(targetFile, bytes, generation, onResolved);
        } catch (error) {
          this.#logger?.debug('artwork-fetch-failed', { error: String(error) });
        }
      },
    );
  }

  /**
   * @param {any} targetFile
   * @param {any} bytes
   * @param {number} generation
   * @param {ArtworkResolvedCallback} onResolved
   * @returns {void}
   */
  #writeArtBytes(targetFile, bytes, generation, onResolved) {
    const tempFile = Gio.File.new_for_path(
      `${targetFile.get_path()}.tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    );
    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    tempFile.replace_contents_bytes_async(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} writeResult
       * @returns {void}
       */
      (_source, writeResult) => {
        if (!this.#enabled || cancellable.is_cancelled?.() === true) {
          return;
        }

        try {
          tempFile.replace_contents_finish(writeResult);
          tempFile.move(targetFile, Gio.FileCopyFlags.OVERWRITE, null, null);
          if (this.#generation !== generation) {
            return;
          }
          const uri = targetFile.get_uri();
          this.#lastUri = uri;
          onResolved(uri);
        } catch {
          try {
            tempFile.delete(null);
          } catch {
            // ignore cleanup failure
          }
        }
      },
    );
  }

  /**
   * @param {string} url
   * @returns {any}
   */
  #cacheFileForUrl(url) {
    if (this.#cacheDirPath === null) {
      const base = GLib.get_user_cache_dir();
      if (typeof base !== 'string' || base === '') {
        return null;
      }
      this.#cacheDirPath = GLib.build_filenamev([base, ...ART_CACHE_DIR_PARTS]);
    }

    const dir = Gio.File.new_for_path(this.#cacheDirPath);
    if (!this.#dirReady) {
      try {
        dir.make_directory_with_parents(null);
      } catch {
        // already exists or inaccessible
      }
      this.#dirReady = true;
    }

    return dir.get_child(`${hashString(url)}.img`);
  }
}

/**
 * @param {string} input
 * @returns {string}
 */
function hashString(input) {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
