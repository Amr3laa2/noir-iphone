# Building & installing Noir Mobile (iPhone) — free, no Mac, no paid account

This app uses native modules (libVLC video, NSURLSession background downloads),
so it **cannot run in Expo Go**. It must be compiled into an `.ipa` and installed
on your iPhone.

We do this **without** a paid Apple Developer account ($99/yr) and **without**
owning a Mac, using two free pieces:

1. **GitHub Actions** gives us a cloud **macOS** machine that compiles an
   **unsigned** `.ipa`.
2. **Sideloadly** (on your Windows PC) signs that `.ipa` with your **free Apple
   ID** and installs it over USB. Its background daemon re-signs every few days
   so the app doesn't die after Apple's 7-day free-account limit.

> Why not EAS Build? EAS's iOS signing step talks to the Apple Developer
> *Portal*, which only issues a signing "team" to **paid** members. A free Apple
> ID has no team there — that's the *"You have no team associated with your
> Apple account"* error. Sideloadly uses Apple's *Xcode* signing flow instead,
> which free Apple IDs are allowed to use, but it needs a prebuilt `.ipa` —
> which is exactly what the GitHub Actions job produces.

---

## A. Get the unsigned IPA (GitHub Actions — cloud, ~30 min)

One-time:

1. Push this repo to GitHub (any account; **private repo is fine** — see the
   free-minutes note at the bottom).
   ```bash
   git add .
   git commit -m "Noir Mobile"
   git remote add origin https://github.com/<you>/noir-iphone.git
   git push -u origin main
   ```

Every time you want a fresh build:

2. On GitHub: **Actions** tab → **"Build unsigned iOS IPA"** → **Run workflow**.
   (Or push a tag like `git tag v1.0.0 && git push --tags`.)
3. Wait for the green check (~20–40 min). Open the finished run and download the
   **`noir-mobile-unsigned-ipa`** artifact at the bottom — it's a `.zip`
   containing `noir-mobile-unsigned.ipa`. Unzip it on your PC.

The workflow lives in `.github/workflows/ios-ipa.yml`: it runs `expo prebuild`,
`pod install`, then `xcodebuild archive` with code-signing disabled, and zips the
resulting `.app` into a `Payload/` IPA.

---

## B. Install it (Sideloadly — Windows, USB)

1. Install [Sideloadly](https://sideloadly.io/) on Windows **and** iTunes (only
   for its USB device driver — you don't need to use iTunes itself).
2. Plug your iPhone into the PC with a cable; unlock it and tap **Trust** if
   asked.
3. Open Sideloadly:
   - **IPA**: drag in `noir-mobile-unsigned.ipa`.
   - **Apple ID**: type your free Apple ID email (an app-specific password may be
     requested if you use 2FA — create one at appleid.apple.com).
   - Click **Start**. Sideloadly signs and installs it.
4. On the iPhone: **Settings → General → VPN & Device Management →** tap your
   Apple ID → **Trust**. Launch Noir.

### Keeping it alive past 7 days
Free Apple IDs sign apps for only **7 days**. You do **not** need to rebuild on
GitHub for this — just re-sign the same `.ipa`:
- Enable Sideloadly's **auto-refresh / background daemon** (keep the PC on and
  the phone reachable on Wi-Fi), **or**
- Use [AltStore](https://altstore.io/), which auto-refreshes the same IPA over
  Wi-Fi.

Only rebuild on GitHub when the **app code changes**.

Free-account limits: max **3** sideloaded apps at once, 7-day signatures.

---

## C. First run

- Open **Settings → IPTV Account** (or the account modal) and enter your Xtream
  server URL, username, and password. Credentials are stored **only on the
  device** (SQLite) and are never logged or sent anywhere except your IPTV
  server.
- **Downloads**: tap the download icon on a movie or series episode, then watch
  progress in the **Downloads** tab. Downloads continue while backgrounded and
  survive a relaunch; finished items play fully offline.
- **Playback**: live / VOD / series stream through libVLC. Resume positions are
  remembered for VOD and series.

---

## Notes

- **GitHub free minutes**: public repos = unlimited Actions minutes. Private
  repos get 2,000 min/month, but macOS is billed **10×**, so a ~30-min build
  ≈ 300 min → about **6 builds/month** free. Because Sideloadly re-signs the
  *existing* IPA (no rebuild needed) to beat the 7-day limit, a handful of
  builds a month is plenty. Make the repo public if you want unlimited builds.
- **EAS is still configured** (`eas.json`) if you ever get a paid Apple account
  — then `eas build -p ios --profile preview` becomes the simpler route with a
  1-year signature and no weekly refresh.
- The libVLC player module is *untested* on React Native's New Architecture; it's
  isolated behind `src/components/video-player.tsx` so it can be swapped for
  `react-native-video` if it misbehaves on-device.
