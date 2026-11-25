# GNOME Lyric Overlay

[![CI](https://github.com/bayuzzs/gnome-lyric-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/bayuzzs/gnome-lyric-overlay/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/bayuzzs/gnome-lyric-overlay)](https://github.com/bayuzzs/gnome-lyric-overlay/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A native GNOME Shell extension that displays synchronized live lyrics for MPRIS-compatible music players as either a **Floating Desktop Overlay** or a **Fixed Top-Bar Indicator**.

Built for **GNOME Shell 46–51**, it supports Spotify Desktop, Spotify Web, YouTube Music Web, Apple Music Web, and other MPRIS players. Lyrics are fetched from LRCLIB and cached locally alongside album cover art.

## Features

- **Dual Display Mode**: Switch seamlessly between **Floating Overlay** (always-on-top on Wayland) and **Fixed Top Bar** via the tray menu or a keyboard shortcut.
- **3-Tier Floating Player Card**:
  - **Top**: GPU-spinning vinyl record with circular album cover art + song title, artist, and album name.
  - **Middle**: Full-width clipped lyrics conveyor with **1, 2, or 3 configurable lines** and smooth bottom-to-top vertical glide transitions.
  - **Bottom**: Interactive progress seekbar with live timestamps (click or scrub to seek) + centered MPRIS playback controls (`Previous`, `Play/Pause`, `Next`).
- **Fixed Width + Live Edge Resizing**: Preserves overlay width to eliminate horizontal layout shifting; drag the left or right edge directly on screen (`↔` cursor) to resize between `280px` and `1600px` without opening Preferences.
- **Drag & Relative Monitor Positioning**: Drag freely when unlocked; saves relative monitor coordinates (`x-ratio` / `y-ratio`) with workarea clamping and quick presets (`Bottom Center`, `Top Center`, `Bottom Left`, `Bottom Right`, `Center`).
- **Lock / Click-Through Mode**: When locked, pointer clicks pass straight through to windows underneath.
- **Smart Auto-Hide**: Always hides when idle or in GNOME Overview, with optional auto-hide during fullscreen windows and while paused.
- **Customizable Appearance**: Background opacity slider (`0%` pure subtitle text with drop shadow up to `100%` dark translucent pill), font size, active/secondary colors, alignment, lyrics timing offset, and toggles for vinyl, track info, progress bar, and controls.
- **Local Cache Management**: Caches LRCLIB lyrics and cover artwork locally with a **Clear Cache** button in Preferences.

## Compatibility

| Target                | Status        |
| --------------------- | ------------- |
| GNOME Shell 46–51     | Supported     |
| Fedora / Ubuntu GNOME | Supported     |
| Spotify Desktop       | Supported     |
| Spotify Web           | Supported     |
| YouTube Music Web     | Supported     |
| Apple Music Web       | Supported     |
| Other MPRIS players   | Best effort   |
| Non-GNOME desktops    | Not supported |

## Install

Quick install (no Node.js or build tools required):

```bash
curl -fsSL https://raw.githubusercontent.com/bayuzzs/gnome-lyric-overlay/main/scripts/install.sh | bash
```

On Wayland, **log out and log back in** once after installing so GNOME Shell loads the extension (it will start automatically).

Open preferences:

```bash
gnome-extensions prefs lyric-overlay@bayuzzs.github.io
```

Update to the latest release by re-running the install command above.

Uninstall:

```bash
gnome-extensions disable lyric-overlay@bayuzzs.github.io
rm -rf ~/.local/share/gnome-shell/extensions/lyric-overlay@bayuzzs.github.io
```

## Keyboard Shortcuts

All shortcuts can be customized or disabled in Preferences:

| Shortcut        | Action                            |
| --------------- | --------------------------------- |
| `<Super><Alt>m` | Switch Floating Overlay ↔ Top Bar |
| `<Super><Alt>l` | Toggle Lock (Click-through)       |
| `<Super><Alt>h` | Toggle Show / Hide Lyrics         |

## Build from Source

Requirements: GNOME Shell 46–51, Node.js 22+, `glib-compile-schemas`, `zip`, `unzip`.

```bash
git clone https://github.com/bayuzzs/gnome-lyric-overlay.git
cd gnome-lyric-overlay
npm install
npm run verify
npm run install:local
gnome-extensions enable lyric-overlay@bayuzzs.github.io
```

The generated bundle is written to `dist/lyric-overlay@bayuzzs.github.io.zip`.

## Privacy

GNOME Lyric Overlay collects no telemetry and requires no account login. To fetch lyrics, track metadata (title, artist, album, duration) is sent to [LRCLIB](https://lrclib.net); album art URLs exposed by MPRIS are cached locally in `~/.cache/lyric-overlay/`.

## Credits & License

Licensed under the [MIT License](LICENSE).

MPRIS player profile/stability handling, interpolated sync clock, and LRCLIB lookup/cache modules are adapted from [gnome-lyricbar](https://github.com/fikrilal/gnome-lyricbar) (MIT License, Copyright (c) 2026 Ahmad Fikril).
