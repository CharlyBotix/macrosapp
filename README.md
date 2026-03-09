# macros.

Personal macro tracking Android app built with Capacitor.

## First time setup (in GitHub Codespace)

```bash
npm install
bash build.sh
```

Then right-click `macros-latest.apk` in the file explorer → Download.

## Updating the app

1. Edit `MacrosAPK.html`
2. Run `bash update.sh`
3. Download the new `macros-latest.apk`

## Stack

- Single-file PWA (`MacrosAPK.html`)
- Capacitor 7 for Android packaging
- `@capacitor/local-notifications` for reminders
- `@capacitor/status-bar` for safe area handling
- Data stored in device localStorage
