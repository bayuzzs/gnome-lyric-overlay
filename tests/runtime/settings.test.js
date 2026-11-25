import { describe, expect, it } from 'vitest';

import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';
import { SettingsAdapter } from '../../src/runtime/settings.js';

describe('SettingsAdapter', () => {
  it('reads settings, subscribes with cleanup, and writes toggles/position', () => {
    /** @type {Record<string, any>} */
    const store = {
      'display-mode': 'floating',
      'lyrics-visible': true,
      'fallback-mode': 'track',
      'floating-locked': false,
      'floating-lines': 2,
      'floating-x-ratio': 0.5,
      'floating-y-ratio': 0.88,
      'floating-monitor-index': -1,
      'floating-max-width': 640,
      'floating-preserve-width': true,
      'floating-show-vinyl': true,
      'floating-show-track-info': true,
      'floating-show-controls': true,
      'floating-font-size': 18,
      'floating-bg-opacity': 55,
      'floating-animate': true,
      'floating-hide-fullscreen': true,
      'floating-hide-paused': false,
      'panel-position': 'center',
      'panel-index': 0,
      'panel-max-width': 360,
      'text-align': 'center',
      'style-text-color-type': 'default',
      'style-text-color-custom': '#ffffff',
      'style-secondary-opacity': 55,
      'style-text-shadow': true,
      'lyrics-offset-ms': 0,
      'player-priority': ['spotify'],
      'browser-player-service': 'auto',
      'cache-enabled': true,
      'debug-logging': false,
    };

    let nextId = 1;
    /** @type {Map<number, { signal: string, cb: () => void }>} */
    const listeners = new Map();

    const backend = {
      get_string: (/** @type {string} */ k) => store[k],
      set_string: (/** @type {string} */ k, /** @type {string} */ v) => {
        store[k] = v;
        return true;
      },
      get_int: (/** @type {string} */ k) => store[k],
      set_int: (/** @type {string} */ k, /** @type {number} */ v) => {
        store[k] = v;
        return true;
      },
      get_double: (/** @type {string} */ k) => store[k],
      set_double: (/** @type {string} */ k, /** @type {number} */ v) => {
        store[k] = v;
        return true;
      },
      get_strv: (/** @type {string} */ k) => store[k],
      get_boolean: (/** @type {string} */ k) => store[k],
      set_boolean: (/** @type {string} */ k, /** @type {boolean} */ v) => {
        store[k] = v;
        return true;
      },
      connect: (/** @type {string} */ signal, /** @type {() => void} */ cb) => {
        const id = nextId;
        nextId += 1;
        listeners.set(id, { signal, cb });
        return id;
      },
      disconnect: (/** @type {number} */ id) => {
        listeners.delete(id);
      },
    };

    const lifecycle = new LifecycleRegistry();
    const adapter = new SettingsAdapter(backend, lifecycle);

    expect(adapter.read().displayMode).toBe('floating');

    adapter.toggleDisplayMode();
    expect(store['display-mode']).toBe('panel');

    adapter.toggleFloatingLocked();
    expect(store['floating-locked']).toBe(true);

    adapter.toggleLyricsVisible();
    expect(store['lyrics-visible']).toBe(false);

    adapter.setFloatingPosition(0.25, 0.75, 1);
    expect(store['floating-x-ratio']).toBe(0.25);
    expect(store['floating-y-ratio']).toBe(0.75);
    expect(store['floating-monitor-index']).toBe(1);

    adapter.setFloatingWidthAndPosition(780, 0.4, 0.85, 0);
    expect(store['floating-preserve-width']).toBe(true);
    expect(store['floating-max-width']).toBe(780);
    expect(store['floating-x-ratio']).toBe(0.4);

    let fired = 0;
    adapter.subscribe(() => {
      fired += 1;
    });
    expect(listeners.size).toBeGreaterThan(20);
    for (const entry of listeners.values()) {
      if (entry.signal === 'changed::display-mode') {
        entry.cb();
      }
    }
    expect(fired).toBe(1);

    lifecycle.dispose();
    expect(listeners.size).toBe(0);
  });
});
