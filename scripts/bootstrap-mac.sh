#!/usr/bin/env bash
set -euo pipefail

XCODEGEN_VERSION="2.45.4"
export PATH="$HOME/.local/bin:$PATH"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  temporary_directory="$(mktemp -d)"
  trap 'rm -rf "$temporary_directory"' EXIT
  curl -fsSL "https://github.com/yonaskolb/XcodeGen/releases/download/${XCODEGEN_VERSION}/xcodegen.zip" -o "$temporary_directory/xcodegen.zip"
  unzip -q "$temporary_directory/xcodegen.zip" -d "$temporary_directory"
  mkdir -p "$HOME/.local"
  PREFIX="$HOME/.local" bash "$temporary_directory/xcodegen/install.sh"
fi

echo "Using $(xcodegen version)"
xcodegen generate
xcodebuild -version
