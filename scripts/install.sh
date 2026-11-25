#!/usr/bin/env bash
set -euo pipefail

readonly EXTENSION_UUID="lyric-overlay@bayuzzs.github.io"
readonly REPOSITORY="bayuzzs/gnome-lyric-overlay"
readonly ASSET_NAME="${EXTENSION_UUID}.zip"
readonly EXTENSION_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

VERSION="${1:-latest}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Install failed: required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

download_file() {
  local url="$1"
  local output_path="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --connect-timeout 20 --output "$output_path" "$url"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -q -O "$output_path" "$url"
    return
  fi

  printf 'Install failed: curl or wget is required.\n' >&2
  exit 1
}

pre_enable_extension() {
  if ! command -v gsettings >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
    return 0
  fi

  gsettings set org.gnome.shell disable-user-extensions false >/dev/null 2>&1 || true

  local current next
  current="$(gsettings get org.gnome.shell enabled-extensions 2>/dev/null || echo '[]')"
  next="$(
    CURRENT_VALUE="$current" TARGET_UUID="$EXTENSION_UUID" python3 - <<'PY'
import ast, os

raw = os.environ["CURRENT_VALUE"].strip()
uuid = os.environ["TARGET_UUID"]
values = [] if raw in {"", "@as []", "[]"} else list(ast.literal_eval(raw.removeprefix("@as ")))
if uuid not in values:
    values.append(uuid)
print("[" + ", ".join(repr(v) for v in values) + "]")
PY
  )"
  gsettings set org.gnome.shell enabled-extensions "$next" >/dev/null 2>&1 || true
}

build_bundle_from_main() {
  local work_dir="$1"
  local zip_out="$2"

  require_command tar
  require_command zip

  local tarball="${work_dir}/main.tar.gz"
  printf 'Release asset unavailable; building bundle from main branch...\n'
  download_file "https://github.com/${REPOSITORY}/archive/refs/heads/main.tar.gz" "$tarball"
  tar -xzf "$tarball" -C "$work_dir"

  local repo_dir
  repo_dir="$(find "$work_dir" -maxdepth 1 -type d -name 'gnome-lyric-overlay-*' | head -n 1)"
  if [[ -z "$repo_dir" ]]; then
    printf 'Install failed: could not unpack repository archive.\n' >&2
    exit 1
  fi

  local stage="${work_dir}/stage"
  mkdir -p "$stage/src"
  cp "$repo_dir/metadata.json" "$repo_dir/extension.js" "$repo_dir/prefs.js" "$repo_dir/stylesheet.css" "$stage/"
  cp -r "$repo_dir/schemas" "$stage/"
  cp -r "$repo_dir/src/shell" "$repo_dir/src/runtime" "$repo_dir/src/domain" "$stage/src/"
  rm -f "$stage/schemas/gschemas.compiled"
  rm -f "$stage/src/domain"/*/types.js

  (cd "$stage" && zip -qr "$zip_out" .)
}

require_command gnome-shell
require_command gnome-extensions

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

zip_path="${tmp_dir}/${ASSET_NAME}"

if [[ "$VERSION" == "latest" ]]; then
  download_url="https://github.com/${REPOSITORY}/releases/latest/download/${ASSET_NAME}"
else
  download_url="https://github.com/${REPOSITORY}/releases/download/${VERSION}/${ASSET_NAME}"
fi

printf 'Downloading GNOME Lyric Overlay (%s)...\n' "$VERSION"
if ! download_file "$download_url" "$zip_path" 2>/dev/null; then
  build_bundle_from_main "$tmp_dir" "$zip_path"
fi

if gnome-extensions info "$EXTENSION_UUID" >/dev/null 2>&1; then
  gnome-extensions disable "$EXTENSION_UUID" >/dev/null 2>&1 || true
fi

printf 'Installing %s...\n' "$EXTENSION_UUID"
gnome-extensions install --force "$zip_path"

if [[ ! -d "$EXTENSION_DIR" ]]; then
  printf 'Install failed: extension directory not created at %s\n' "$EXTENSION_DIR" >&2
  exit 1
fi

pre_enable_extension

if gnome-extensions info "$EXTENSION_UUID" >/dev/null 2>&1 && gnome-extensions enable "$EXTENSION_UUID" >/dev/null 2>&1; then
  printf '\nGNOME Lyric Overlay installed and enabled!\n'
else
  printf '\nGNOME Lyric Overlay installed!\n'
  printf 'On Wayland, log out and log back in once — it is pre-enabled and will start automatically.\n'
fi

printf 'Open preferences with:\n  gnome-extensions prefs %s\n' "$EXTENSION_UUID"
