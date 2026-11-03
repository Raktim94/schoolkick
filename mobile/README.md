# Mobile wrapper (not built or tested yet)

The app is a PWA under `/app/` and works in any phone browser. This folder is a Capacitor shell that loads your own server inside a native app.

Status: configuration only. No Android or iOS build has been produced or tested. iOS builds need macOS with Xcode.

1. Set `server.url` in `capacitor.config.json` to your HTTPS address.
2. `npm install && npx cap add android` (and `npx cap add ios` on macOS), then `npm run sync`.
3. Open in Android Studio or Xcode and build.

Store publication also needs signing keys, store listings and a privacy policy. Those are yours to supply.
