#!/bin/bash
# ============================================================
# macros. — One-shot build script
# Run once per Codespace session to build the APK
# ============================================================
set -e

JAVA_PATH=/usr/local/sdkman/candidates/java/21.0.5-tem
SDK_PATH=/workspaces/macrosapp/android-sdk

# ── ENV ──────────────────────────────────────────────────────
export JAVA_HOME=$JAVA_PATH
export ANDROID_SDK_ROOT=$SDK_PATH
export PATH=$JAVA_HOME/bin:$SDK_PATH/cmdline-tools/latest/bin:$SDK_PATH/platform-tools:$PATH

echo "☕ $(java -version 2>&1 | head -1)"

# ── INSTALL SDK IF MISSING ────────────────────────────────────
if [ ! -d "$SDK_PATH/cmdline-tools/latest" ]; then
  echo "📦 Installing Android SDK..."
  mkdir -p $SDK_PATH/cmdline-tools
  cd $SDK_PATH/cmdline-tools
  curl -o tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q tools.zip && mv cmdline-tools latest && rm tools.zip
  cd /workspaces/macrosapp
  yes | sdkmanager --licenses > /dev/null 2>&1
  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
  echo "✅ Android SDK ready"
fi

# ── WRITE local.properties ───────────────────────────────────
echo "sdk.dir=$SDK_PATH" > android/local.properties

# ── COPY & SYNC ──────────────────────────────────────────────
echo "📋 Syncing web assets..."
mkdir -p www
cp MacrosAPK.html www/index.html
npx cap sync
bash install_icons.sh 2>/dev/null || true

# ── BUILD ────────────────────────────────────────────────────
echo "🔨 Building APK..."
cd android
./gradlew assembleDebug --quiet
cd ..

# ── OUTPUT ───────────────────────────────────────────────────
cp android/app/build/outputs/apk/debug/app-debug.apk macros-latest.apk
SIZE=$(du -sh macros-latest.apk | cut -f1)
echo ""
echo "============================================"
echo "✅ APK ready: macros-latest.apk ($SIZE)"
echo "   Right-click → Download in file explorer"
echo "============================================"
