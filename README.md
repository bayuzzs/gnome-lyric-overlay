<div align="center">

# 💿 GNOME Lyric Overlay

**Live synchronized lyrics for GNOME Shell — as a floating vinyl player card or a minimal top-bar indicator.**

[![CI](https://github.com/bayuzzs/gnome-lyric-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/bayuzzs/gnome-lyric-overlay/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/bayuzzs/gnome-lyric-overlay)](https://github.com/bayuzzs/gnome-lyric-overlay/releases/latest)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-46--51-4a86cf?logo=gnome&logoColor=white)](#compatibility)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#features) · [Quick Install](#quick-install) · [Controls](#controls--shortcuts) · [Customization](#customization) · [Compatibility](#compatibility) · [Build from Source](#build-from-source)

</div>

<!-- Drop your demo GIF, video, or screenshot here once recorded:
<p align="center">
  <img src="assets/demo.gif" alt="GNOME Lyric Overlay demo" width="760" />
</p>
-->

---

## Features

### 3-Tier Floating Player Card

- **Spinning Vinyl & Track Header** — GPU-accelerated spinning vinyl record displaying the current track's album artwork alongside song title, artist, and album name.
- **Smooth Clipped Lyrics Conveyor** — Displays **1, 2, or 3 synchronized lines** with fluid bottom-to-top vertical glide transitions and preserved width so lines never jump or shift horizontally.
- **Interactive Seekbar & Playback Controls** — Click or scrub the progress bar to seek with live timestamps, plus centered `Previous`, `Play/Pause`, and `Next` MPRIS controls.

### Built for Daily Workflow

- **Floating ↔ Top Bar Dual Mode** — Switch instantaneously between an always-on-top floating overlay and a compact GNOME top-bar indicator via the tray menu or a keyboard shortcut.
- **Live Edge Resizing** — Hover the left or right edge of the overlay (`↔` cursor) and drag directly on screen to resize between `280px` and `1600px` without opening Preferences.
- **Drag & Relative Monitor Positioning** — Move the overlay anywhere on screen; saves monitor-relative coordinates (`x`/`y` ratios) with automatic workarea clamping and 5 quick position presets.
- **True Click-Through Lock Mode** — Lock the overlay so pointer events pass straight through to windows underneath — keep coding or browsing right behind your lyrics.
- **Smart Auto-Hide** — Automatically hides when idle or in GNOME Overview, with optional auto-hide for fullscreen windows and paused playback.
- **No Login Required** — Reads playback state locally over MPRIS D-Bus, fetches synced lyrics from [LRCLIB](https://lrclib.net), and caches both lyrics and cover art locally.

---

## Quick Install

Install the latest release in one command (no Node.js or build tools required):

```bash
curl -fsSL https://raw.githubusercontent.com/bayuzzs/gnome-lyric-overlay/main/scripts/install.sh | bash
```

> [!NOTE]
> On **Wayland**, log out and log back in once after installing so GNOME Shell loads the new extension. The installer pre-enables it automatically.

Open preferences anytime:

```bash
gnome-extensions prefs lyric-overlay@bayuzzs.github.io
```

To **update** to the latest release, simply re-run the install command above.

<details>
<summary>Uninstall</summary>

```bash
gnome-extensions disable lyric-overlay@bayuzzs.github.io
rm -rf ~/.local/share/gnome-shell/extensions/lyric-overlay@bayuzzs.github.io
rm -rf ~/.cache/lyric-overlay
```

</details>

---

## Controls & Shortcuts

### On-Screen Interactions (Floating Mode)

| Interaction              | Action                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| **Drag card**            | Reposition overlay anywhere on the monitor (when unlocked)          |
| **Drag left/right edge** | Live-resize overlay width (`280px–1600px`)                          |
| **Click / drag seekbar** | Seek track position (uses MPRIS `SetPosition` with `Seek` fallback) |
| **Playback buttons**     | Previous track, Play/Pause, Next track                              |
| **Top-bar tray icon**    | Quick toggle for Mode, Lock, Visibility, and Preferences            |

### Global Keyboard Shortcuts

All shortcuts can be remapped or disabled in Preferences:

| Shortcut        | Action                            |
| --------------- | --------------------------------- |
| `<Super><Alt>m` | Switch Floating Overlay ↔ Top Bar |
| `<Super><Alt>l` | Toggle Lock (Click-through mode)  |
| `<Super><Alt>h` | Toggle Show / Hide Lyrics         |

---

## Customization

Everything is configurable through the native GTK4 / Libadwaita Preferences window:

| Page           | Configurable Options                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Display**    | Display mode, lyric line count (`1–3`), position presets, target monitor, width (`280–1600px`), fixed-width toggle, top-bar placement & max width, fallback mode                                                                           |
| **Appearance** | Background opacity (`0%` pure subtitle text with drop shadow → `100%` translucent card), font size (`12–36px`), text color & secondary line opacity, alignment, glide animation, toggles for vinyl, track info, progress bar, and controls |
| **Behavior**   | Timing offset (`-5000ms` to `+5000ms`), auto-hide on fullscreen / pause, player priority, browser service mode, global shortcuts, local cache & **Clear Cache**                                                                            |

---

## Compatibility

| Target                 | Status         |
| ---------------------- | -------------- |
| GNOME Shell 46–51      | ✅ Supported   |
| Wayland & X11          | ✅ Supported   |
| Fedora / Ubuntu / Arch | ✅ Supported   |
| Spotify Desktop        | ✅ Supported   |
| Spotify Web            | ✅ Supported   |
| YouTube Music Web      | ✅ Supported   |
| Apple Music Web        | ✅ Supported   |
| Other MPRIS players    | 🟡 Best effort |
| Non-GNOME desktops     | ❌ Unsupported |

---

## Privacy & Local Cache

- **Zero telemetry & zero accounts** — No analytics, no Spotify credentials, and no window/browser scraping.
- **External requests** — Track metadata (`title`, `artist`, `album`, `duration`) is queried against [LRCLIB](https://lrclib.net) to fetch synchronized `.lrc` lyrics; cover artwork URLs provided by MPRIS are fetched only to render the vinyl disc.
- **Local storage** — Lyrics and cover art are cached under `~/.cache/lyric-overlay/` and can be wiped anytime via **Preferences → Behavior → Clear Cache**.

---

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

`npm run verify` runs metadata & GSettings schema validation, architecture boundary checks, Prettier, ESLint, TypeScript typechecking, the Vitest suite, and builds `dist/lyric-overlay@bayuzzs.github.io.zip`.

---

## License

Released under the [MIT License](LICENSE).
