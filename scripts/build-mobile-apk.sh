#!/usr/bin/env bash
# Build completo del APK debug del asistente IA (Capacitor + Gradle)
# Uso: yarn apk:debug
#      yarn apk:debug -- --skip-install
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_INSTALL=false
SKIP_WEB_BUILD=false
GRADLE_TASK="assembleDebug"

for arg in "$@"; do
	case "$arg" in
		--skip-install) SKIP_INSTALL=true ;;
		--skip-web-build) SKIP_WEB_BUILD=true ;;
		--release) GRADLE_TASK="assembleRelease" ;;
		-h | --help)
			cat <<'EOF'
Uso: yarn apk:debug [-- opciones]

Opciones:
  --skip-install     No ejecuta yarn install
  --skip-web-build   Solo sincroniza Capacitor y compila Gradle (web ya construida)
  --release          Compila APK release (requiere firma configurada)
  -h, --help         Muestra esta ayuda

Requisitos: yarn, JDK 17+, Android SDK (ANDROID_HOME), PUBLIC_MOBILE_APP_TOKEN en .env
EOF
			exit 0
			;;
	esac
done

log() { echo "[apk] $*"; }
fail() { echo "[apk] ERROR: $*" >&2; exit 1; }

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || fail "Falta '$1' en PATH"
}

load_mobile_token_from_env_file() {
	if [ -n "${PUBLIC_MOBILE_APP_TOKEN:-}" ]; then return; fi
	[ -f .env ] || fail "No hay PUBLIC_MOBILE_APP_TOKEN y no existe .env"
	local line
	line="$(grep -E '^PUBLIC_MOBILE_APP_TOKEN=' .env | tail -1 || true)"
	[ -n "$line" ] || fail "Añade PUBLIC_MOBILE_APP_TOKEN=gl_mob_... a .env (genera con: yarn token:mobile)"
	# shellcheck disable=SC2163
	export "${line?}"
}

check_android_sdk() {
	if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
		fail "Define ANDROID_HOME (Android Studio → SDK). Ej: export ANDROID_HOME=\$HOME/Android/Sdk"
	fi
	local sdk="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
	[ -d "$sdk" ] || fail "ANDROID_HOME no apunta a un directorio válido: $sdk"
	export ANDROID_HOME="$sdk"
	export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$ANDROID_HOME/cmdline-tools/latest/bin"
}

ensure_android_project() {
	if [ ! -d android ]; then
		log "Creando proyecto Android (npx cap add android)..."
		yarn exec cap add android
	fi
}

require_cmd yarn
require_cmd java
load_mobile_token_from_env_file
check_android_sdk

if [ "$SKIP_INSTALL" = false ]; then
	log "Instalando dependencias (yarn)..."
	yarn install --frozen-lockfile 2>/dev/null || yarn install
fi

ensure_android_project

if [ "$SKIP_WEB_BUILD" = false ]; then
	log "Build web SvelteKit (yarn build)..."
	yarn build
	log "Sincronizando Capacitor..."
	yarn exec cap sync android
else
	log "Sincronizando Capacitor (sin rebuild web)..."
	yarn exec cap sync android
fi

log "Compilando APK ($GRADLE_TASK)..."
(cd android && chmod +x gradlew && ./gradlew "$GRADLE_TASK")

APK_DIR="android/app/build/outputs/apk"
if [ "$GRADLE_TASK" = "assembleDebug" ]; then
	APK_PATH="$APK_DIR/debug/app-debug.apk"
else
	APK_PATH="$APK_DIR/release/app-release-unsigned.apk"
fi

[ -f "$APK_PATH" ] || fail "No se generó el APK en $APK_PATH"

log "Listo."
echo ""
echo "  APK: $ROOT_DIR/$APK_PATH"
echo ""
echo "  Instalar en dispositivo USB:"
echo "    adb install -r $APK_PATH"
echo ""
