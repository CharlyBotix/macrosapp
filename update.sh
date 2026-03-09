#!/bin/bash
# ============================================================
# macros. — Update script (run after editing MacrosAPK.html)
# ============================================================
set -e

export JAVA_HOME=/usr/local/sdkman/candidates/java/21.0.5-tem
export ANDROID_SDK_ROOT=/workspaces/macrosapp/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH

echo "📋 Syncing..."
mkdir -p www
cp MacrosAPK.html www/index.html
npx cap sync

echo "🎨 Applying icons..."
bash install_icons.sh

echo "🔨 Building APK..."
cd android && ./gradlew assembleDebug --quiet && cd ..

cp android/app/build/outputs/apk/debug/app-debug.apk macros-latest.apk
SIZE=$(du -sh macros-latest.apk | cut -f1)

echo "📤 Pushing to GitHub..."
git add -A
git commit -m "update: $(date '+%Y-%m-%d %H:%M')"
git push origin main

echo ""
echo "✅ Done — macros-latest.apk ($SIZE) ready to download"
