#!/bin/bash
# Install all icon assets into Android res folders
DENSITIES="mdpi hdpi xhdpi xxhdpi xxxhdpi"
for D in $DENSITIES; do
  cp icons/$D/ic_launcher.png           android/app/src/main/res/mipmap-$D/ic_launcher.png
  cp icons/$D/ic_launcher_round.png     android/app/src/main/res/mipmap-$D/ic_launcher_round.png
  cp icons/$D/ic_launcher_foreground.png android/app/src/main/res/mipmap-$D/ic_launcher_foreground.png
  cp icons/$D/ic_launcher_background.png android/app/src/main/res/mipmap-$D/ic_launcher_background.png
done
# Replace adaptive icon XMLs (these override PNGs on Android 8+)
cp icons/ic_launcher.xml       android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
cp icons/ic_launcher_round.xml android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
echo "✅ Icons installed"
