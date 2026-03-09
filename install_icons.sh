#!/bin/bash
# Run after `npx cap add android` to install custom icons
cp icons/mdpi.png    android/app/src/main/res/mipmap-mdpi/ic_launcher.png
cp icons/hdpi.png    android/app/src/main/res/mipmap-hdpi/ic_launcher.png
cp icons/xhdpi.png   android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
cp icons/xxhdpi.png  android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
cp icons/xxxhdpi.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

cp icons/mdpi.png    android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
cp icons/hdpi.png    android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
cp icons/xhdpi.png   android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
cp icons/xxhdpi.png  android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
cp icons/xxxhdpi.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
echo "✅ Icons installed"
