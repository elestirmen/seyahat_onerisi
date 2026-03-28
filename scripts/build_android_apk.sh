#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android_app"

BUILD_TYPE="${1:-debug}"

case "$BUILD_TYPE" in
  debug)
    GRADLE_TASK=":app:assembleDebug"
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    ;;
  release)
    GRADLE_TASK=":app:assembleRelease"
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    ;;
  *)
    echo "Usage: $0 [debug|release]" >&2
    exit 1
    ;;
esac

find_sdk_dir() {
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "${ANDROID_SDK_ROOT}" ]; then
    printf "%s\n" "${ANDROID_SDK_ROOT}"
    return 0
  fi

  if [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}" ]; then
    printf "%s\n" "${ANDROID_HOME}"
    return 0
  fi

  for candidate in \
    "$HOME/Android/Sdk" \
    "$HOME/Library/Android/sdk"
  do
    if [ -d "$candidate" ]; then
      printf "%s\n" "$candidate"
      return 0
    fi
  done

  return 1
}

find_java_cmd() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    printf "%s\n" "${JAVA_HOME}/bin/java"
    return 0
  fi

  if command -v java >/dev/null 2>&1; then
    command -v java
    return 0
  fi

  return 1
}

JAVA_CMD="$(find_java_cmd || true)"
if [ -z "$JAVA_CMD" ]; then
  cat >&2 <<'EOF'
Java bulunamadi. Android build icin JDK 17 gerekli.

Ornek:
  export JAVA_HOME=/path/to/jdk-17
  export PATH="$JAVA_HOME/bin:$PATH"
EOF
  exit 1
fi

JAVA_MAJOR="$("$JAVA_CMD" -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n1)"
if [ "$JAVA_MAJOR" != "17" ]; then
  echo "JDK 17 gerekli. Bulunan Java major version: ${JAVA_MAJOR:-unknown}" >&2
  exit 1
fi

SDK_DIR="$(find_sdk_dir || true)"
if [ -z "$SDK_DIR" ]; then
  cat >&2 <<'EOF'
Android SDK bulunamadi.

Sunucu yerine yerel bilgisayarinizda build alin. Asagidaki degiskenlerden birini ayarlayin:
  export ANDROID_SDK_ROOT=/path/to/Android/Sdk
  export ANDROID_HOME=/path/to/Android/Sdk

Gerekli paketler:
  - Android SDK Platform 34
  - Android SDK Build-Tools 34.0.0
  - Android SDK Platform-Tools
EOF
  exit 1
fi

SDK_DIR_NORMALIZED="$(printf '%s' "$SDK_DIR" | sed 's#\\#/#g')"
printf 'sdk.dir=%s\n' "$SDK_DIR_NORMALIZED" > "$ANDROID_DIR/local.properties"

(
  cd "$ANDROID_DIR"
  ./gradlew "$GRADLE_TASK"
)

if [ ! -f "$APK_PATH" ]; then
  echo "Build tamamlandi fakat APK bulunamadi: $APK_PATH" >&2
  exit 1
fi

echo "APK hazir: $APK_PATH"
