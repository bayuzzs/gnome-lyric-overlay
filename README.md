# GNOME Lyric Overlay

A native GNOME Shell extension (GNOME Shell 46–51) that displays synchronized live lyrics from MPRIS-compatible music players as either a **Floating Desktop Overlay** or a **Fixed Top-Bar Indicator**.

## Features

- **Dual Display Mode**: Switch seamlessly between **Floating Overlay** (always-on-top on Wayland) and **Fixed Top Bar** via tray menu or keyboard shortcut.
- **3-Tier Floating Player Card**:
  - **Top**: GPU-spinning vinyl record with circular album cover art (cached locally) + song title, artist, and album name.
  - **Middle**: Full-width clipped lyrics conveyor with **1, 2, or 3 configurable lines** and smooth bottom-to-top vertical glide transitions (`EASE_OUT_CUBIC`).
  - **Bottom**: Centered MPRIS playback controls (`Previous`, `Play/Pause`, `Next`).
- **Fixed Width + Live Edge Resizing**: Preserves overlay width to eliminate horizontal layout shifting; drag the left or right edges directly on screen (`↔` cursor) to resize between `280px` and `1600px` without opening Preferences.
- **Drag & Relative Monitor Positioning**: Drag freely when unlocked; saves relative monitor coordinates (`x-ratio` / `y-ratio`) with automatic workarea clamping and quick presets (`Bottom Center`, `Top Center`, `Bottom Left`, `Bottom Right`, `Center`).
- **Lock / Click-Through Mode**: When locked, pointer clicks pass directly through to windows underneath.
- **Smart Auto-Hide**: Always hides when idle or in GNOME Overview, with configurable auto-hide during fullscreen windows (on by default) and while paused.
- **Flexible Visuals**: Background opacity slider (`0%` pure subtitle text with drop shadow up to `100%` dark translucent pill), configurable font size, active/secondary colors, alignment, and toggles for vinyl, track info, and playback controls.
- **Global Keyboard Shortcuts**:
  - `<Super><Alt>m` — Switch Floating ↔ Top Bar
  - `<Super><Alt>l` — Toggle Lock (Click-through)
  - `<Super><Alt>h` — Toggle Show / Hide Lyrics
- **MPRIS & LRCLIB Core**: Supports Spotify Desktop, Spotify Web, YouTube Music Web, Apple Music Web, Firefox/Chromium, and generic MPRIS players, with local JSON/artwork cache and a **Clear Cache** button in Preferences.

## Development & Installation

Requirements: GNOME Shell 46–51, Node.js 22+, `glib-compile-schemas`, `zip`, `unzip`.

```bash
npm install
npm run verify
npm run install:local
gnome-extensions enable lyric-overlay@bayuzzs.github.io
```

Open preferences:

```bash
gnome-extensions prefs lyric-overlay@bayuzzs.github.io
```

On Wayland, log out and log back in once after first install so GNOME Shell loads the newly installed extension.

## Credits & License

Licensed under the [MIT License](LICENSE).

MPRIS player profile/stability handling, interpolated sync clock, and LRCLIB lookup/cache modules are adapted from [gnome-lyricbar](https://github.com/fikrilal/gnome-lyricbar) (MIT License, Copyright (c) 2026 Ahmad Fikril).
