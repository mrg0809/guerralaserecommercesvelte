#!/usr/bin/env bash
# Build APK del asistente móvil (requiere Android SDK + Capacitor instalado)
set -euo pipefail

if [ -z "${PUBLIC_MOBILE_APP_TOKEN:-}" ]; then
  echo "Define PUBLIC_MOBILE_APP_TOKEN antes del build"
  exit 1
fi

npm run build
npx cap sync android

echo ""
echo "Para compilar APK (requiere Android SDK):"
echo "  cd android && ./gradlew assembleDebug"
echo "  APK: android/app/build/outputs/apk/debug/app-debug.apk"
