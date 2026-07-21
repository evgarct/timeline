#!/usr/bin/env bash
set -euo pipefail

device_id="${1:-${FORM_DEVICE_ID:-}}"
development_team="${2:-${FORM_DEVELOPMENT_TEAM:-}}"
keychain="${FORM_BUILD_KEYCHAIN:-$HOME/Library/Keychains/AnquiBuild.keychain-db}"
password_file="${FORM_BUILD_KEYCHAIN_PASSWORD_FILE:-$HOME/.config/anqui/build-keychain-password}"
derived_data="$HOME/Library/Developer/Xcode/DerivedData/FormCodexDevice"
log_directory="$HOME/Library/Logs/Form"
build_log="$log_directory/device-build.log"
app="$derived_data/Build/Products/Debug-iphoneos/Form.app"

if [[ -z "$device_id" || -z "$development_team" ]]; then
  echo "CoreDevice ID and development team are required." >&2
  exit 2
fi
if [[ ! -f "$keychain" || ! -f "$password_file" ]]; then
  echo "The remote signing keychain is not configured." >&2
  exit 3
fi

mkdir -p "$log_directory"
keychain_password="$(cat "$password_file")"
trap 'unset keychain_password' EXIT
security unlock-keychain -p "$keychain_password" "$keychain"

NSUnbufferedIO=YES xcodebuild \
  -project Form.xcodeproj \
  -scheme Form \
  -configuration Debug \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$derived_data" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$development_team" \
  CODE_SIGN_STYLE=Automatic \
  build 2>&1 | tee "$build_log"

codesign --verify --deep --strict "$app"
profile_team="$(security cms -D -i "$app/embedded.mobileprovision" 2>/dev/null | plutil -extract TeamIdentifier.0 raw -)"
if [[ "$profile_team" != "$development_team" ]]; then
  echo "Built profile team $profile_team does not match configured team $development_team." >&2
  exit 4
fi

for key in FormAuthBaseURL FormAPIBaseURL; do
  value="$(plutil -extract "$key" raw -o - "$app/Info.plist" 2>/dev/null || true)"
  if [[ ! "$value" =~ ^https://[^/]+ ]]; then
    echo "Built app has an invalid $key ('$value'). Use https:/\$()/host in xcconfig." >&2
    exit 5
  fi
done

entitlements="$(codesign -d --entitlements :- "$app" 2>/dev/null)"
if ! grep -q 'com.apple.developer.healthkit' <<<"$entitlements"; then
  echo "Signed app is missing the HealthKit entitlement." >&2
  exit 6
fi

xcrun devicectl device install app --device "$device_id" "$app"
xcrun devicectl device process launch --device "$device_id" com.evgarct.form

echo "Form was built, signed, installed, and launched successfully."
