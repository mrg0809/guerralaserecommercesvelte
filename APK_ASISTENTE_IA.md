# APK — Asistente IA Guerra Láser

Guía para generar e instalar el APK de prueba del chat IA (Capacitor + Android).

## Resumen rápido

```bash
# 1. Dependencias (solo yarn — NO uses npm install --legacy-peer-deps)
yarn install

# 2. Token móvil (una vez; guarda el valor en .env y Vercel)
yarn token:mobile

# 3. Variable en .env
# PUBLIC_MOBILE_APP_TOKEN=gl_mob_...

# 4. Android SDK en PATH
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 5. Un solo comando → APK debug
yarn apk:debug

# 6. Instalar en teléfono
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ¿Yarn o npm? ¿Hace falta `--legacy-peer-deps`?

**Usa solo Yarn** en este proyecto (`yarn.lock`).

| Comando | ¿Necesario? |
|---------|-------------|
| `yarn install` | Sí, para instalar dependencias |
| `npm install --legacy-peer-deps` | **No** — es exclusivo de npm |

`--legacy-peer-deps` sirve cuando npm se queja de peer dependencies. **Yarn no usa esa bandera.** Si `yarn install` fallara por peers (poco habitual aquí), se resuelve con `resolutions` en `package.json` o actualizando paquetes, no mezclando npm.

**No mezcles** `npm install` y `yarn install` en el mismo repo: puede desincronizar lockfiles.

---

## Cómo funciona la app móvil

El APK **no embebe toda la UI compilada** para uso normal. Capacitor abre un WebView apuntando a:

```
https://guerralaser.com/mobile/asistente
```

(configurado en `capacitor.config.ts` → `server.url`)

Implicaciones:

1. **Vercel debe estar desplegado** con la última versión del asistente.
2. **`PUBLIC_MOBILE_APP_TOKEN` debe existir en Vercel** (Environment Variables) y haberse hecho redeploy después de añadirla.
3. El token en tu `.env` local sirve para el **build web** del script, pero la app en el teléfono usa el token **del build desplegado en guerralaser.com**.

Auth móvil: header `X-App-Token` + selector **“¿Quién eres?”** (`ai_team_members`).

---

## Requisitos previos

### Software

- **Node.js 20+**
- **Yarn** (Classic v1 o Berry; el repo usa `yarn.lock`)
- **Android Studio** (instala Android SDK, platform-tools, build-tools)
- **JDK 17** (Gradle/Android lo requieren)

### Variables de entorno del sistema

Añade a `~/.zshrc` o `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

Verifica:

```bash
java -version    # 17+
adb version      # Android Debug Bridge
echo $ANDROID_HOME
```

### Proyecto Supabase + Vercel

1. Migraciones del asistente aplicadas (`database/migrations/20260624000000_*.sql`, etc.).
2. Tabla `mobile_app_tokens` con un token activo.
3. Miembros en `/admin/asistente/equipo`.
4. En **Vercel** → Settings → Environment Variables:
   - `PUBLIC_MOBILE_APP_TOKEN` = `gl_mob_...`
5. **Redeploy** en Vercel tras cambiar variables.

---

## Paso 1 — Generar token móvil

```bash
yarn token:mobile
```

Salida esperada: un token `gl_mob_...` (solo se muestra una vez).

1. Cópialo a `.env`:
   ```
   PUBLIC_MOBILE_APP_TOKEN=gl_mob_xxxxxxxx
   ```
2. Cópialo también a **Vercel** (misma variable).
3. Redeploy en Vercel.

El script desactiva tokens anteriores e inserta uno nuevo hasheado en Supabase.

---

## Paso 2 — Instalar dependencias

```bash
cd /ruta/al/proyecto/guerralaserecommercesvelte
yarn install
```

Primera vez con Capacitor: si no existe la carpeta `android/`, el script de build la crea con `cap add android`.

---

## Paso 3 — Generar APK (un comando)

```bash
yarn apk:debug
```

El script `scripts/build-mobile-apk.sh` hace en orden:

1. Comprueba `yarn`, `java`, `ANDROID_HOME`
2. Lee `PUBLIC_MOBILE_APP_TOKEN` de `.env` si no está exportada
3. `yarn install` (respeta lockfile)
4. `yarn build` (SvelteKit → `.vercel/output/static`)
5. `yarn exec cap sync android`
6. `./gradlew assembleDebug`

**APK generado:**

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Opciones del script

```bash
yarn apk:debug -- --skip-install      # no vuelve a yarn install
yarn apk:debug -- --skip-web-build    # solo cap sync + gradle
yarn apk:debug -- --release           # APK release (sin firmar; ver sección abajo)
yarn apk:debug -- --help
```

---

## Paso 4 — Instalar en el teléfono

### USB (recomendado)

1. Activa **Opciones de desarrollador** y **Depuración USB** en Android.
2. Conecta el cable y acepta la autorización RSA.
3. Instala:

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Sin cable

Copia `app-debug.apk` al teléfono (Drive, Telegram, etc.), ábrelo e instala. Puede pedir permitir instalación de fuentes desconocidas.

---

## Paso 5 — Probar

1. Abre **Guerra Láser Asistente**.
2. Debe cargar la interfaz oscura del chat.
3. Elige tu nombre en **“¿Quién eres?”** (se guarda en el dispositivo).
4. Prueba:
   - Chat de conocimiento (canales, RAG, búsqueda web)
   - Modo cotización (parse → editor → WhatsApp → PDF)

Si ves **401 / no autorizado**: el token en Vercel no coincide con el activo en Supabase o falta redeploy.

---

## Probar cambios locales (sin desplegar Vercel)

Edita temporalmente `capacitor.config.ts`:

```ts
server: {
  url: 'http://192.168.1.XX:5173/mobile/asistente',  // IP de tu PC en la LAN
  cleartext: true
}
```

En otra terminal:

```bash
yarn dev --host
yarn apk:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Teléfono y PC en la **misma Wi‑Fi**. Cuando termines, restaura:

```ts
server: {
  url: 'https://guerralaser.com/mobile/asistente',
  cleartext: false
}
```

---

## APK release (distribución interna)

El debug APK basta para pruebas del equipo. Para release firmado:

1. Crea un keystore (una vez).
2. Configura `android/app/build.gradle` con `signingConfigs`.
3. Ejecuta `yarn apk:debug -- --release` (genera `app-release-unsigned.apk` hasta que configures firma).

Pide ayuda si necesitas el flujo release completo con keystore.

---

## Solución de problemas

| Problema | Qué revisar |
|----------|-------------|
| `Define PUBLIC_MOBILE_APP_TOKEN` | Falta en `.env` → `yarn token:mobile` |
| `ANDROID_HOME no apunta...` | Instala Android Studio; exporta `ANDROID_HOME` |
| `./gradlew: Permission denied` | El script ya hace `chmod +x gradlew` |
| Pantalla en blanco | Internet; URL en `capacitor.config.ts`; Vercel caído |
| APIs 401 | Token en Vercel + redeploy; token activo en Supabase |
| Cambios no aparecen | App carga Vercel remoto → **despliega** antes de probar |
| `yarn install` falla | No uses npm; revisa versión de Node (20+) |
| Mezcla npm/yarn | Borra `node_modules` y solo `yarn install` |

---

## Referencias en el repo

| Archivo | Descripción |
|---------|-------------|
| `capacitor.config.ts` | URL remota del WebView |
| `scripts/build-mobile-apk.sh` | Build completo APK |
| `scripts/create-mobile-app-token.ts` | Genera token Supabase |
| `src/routes/mobile/asistente/` | Ruta móvil del asistente |
| `ASISTENTE_IA_README.md` | Documentación general del asistente |

---

## Comandos útiles

```bash
yarn dev                          # web local
yarn build                        # solo build web
yarn exec cap sync android        # solo sync Capacitor
cd android && ./gradlew assembleDebug   # solo Gradle
yarn token:mobile                 # nuevo token móvil
yarn apk:debug                    # todo en uno
```
