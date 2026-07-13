# Golden Fish Dash 🐟✨

A high-performance React + Vite web game built with Tailwind CSS and fully converted into a modern standalone Android application using **Capacitor**.

This project is fully automated using GitHub Actions to generate a production-ready **Android App Bundle (AAB)** ready for Google Play Console upload without requiring Android Studio locally.

---

## 🎮 Features & Gameplay

- Full score tracking and personal best (local storage persistence)
- Comprehensive shop system (skins, custom trail designs, coins)
- Leaderboard, achievements, and daily challenge
- Fake rewarded-ad simulation for an extra revival chance
- Complete audio and settings controls

---

## 🚀 Local Development

### Prerequisites

Ensure you have **Node.js** (v20+) and **pnpm** installed on your machine.

### 1. Run the Web Game Locally
To start the Vite development server for standard browser play:
```bash
pnpm install
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Build the Web App
To compile the static production assets into the `dist/` folder:
```bash
pnpm build
```

---

## 📱 Android App Development (Capacitor)

The mobile platform integration is powered by **Capacitor**.

### Synchronize Assets
Whenever you make changes to the game source and rebuild the web code, sync the changes to the native Android platform:
```bash
pnpm build
npx cap sync android
```

### Open in Android Studio
If you want to run the app on an emulator or local physical device, open the Android project:
```bash
npx cap open android
```

---

## ⚙️ GitHub Actions CI/CD (Automated AAB Build)

Every push to the `main` branch or manual trigger automatically compiles the web app, syncs with Capacitor, and packages it into an **Android App Bundle (.aab)**.

### How to Trigger the Build Manually
1. Go to the **Actions** tab on your GitHub repository.
2. Select the **Android Build** workflow on the left sidebar.
3. Click the **Run workflow** dropdown on the right and click **Run workflow**.

### Where to Download the Built AAB
1. Once the Action run completes, click on the specific run execution.
2. Scroll down to the **Artifacts** section at the bottom.
3. Click on the `app-release-aab` artifact to download your `.aab` file!

---

## ✍️ AdMob Integration Guide

Detailed code blueprints are provided in `src/game/AdPlaceholders.tsx`. To implement real AdMob:
1. Run `pnpm add @capacitor-community/admob` and `npx cap sync android`.
2. Add the AdMob App ID inside `<application>` in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-3940256099942544~3347511713"/>
   ```
3. Initialize the SDK in `src/App.tsx` and replace mock calls inside `BannerAd`, `InterstitialAd`, and `ContinueAdScreen` with actual `@capacitor-community/admob` methods as documented.

---

## 🔑 Publishing to Google Play (AAB Signing Guide)

Google Play Console requires AAB files to be **signed** before publishing. Currently, the GitHub Actions workflow builds an **unsigned** release AAB for testing. Follow these steps to sign it for production:

### Option A: Local Signing (Manual)
1. Generate a keystore if you don't have one:
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Sign the downloaded `.aab` file:
   ```bash
   jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA256 -keystore my-release-key.keystore app-release.aab my-key-alias
   ```

### Option B: Automated Signing via GitHub Actions (Recommended)
You can automate signing directly within the GitHub Actions runner by uploading your keystore as a base64 string to GitHub Secrets:

1. Convert your `.keystore` file to base64:
   ```bash
   openssl base64 -in my-release-key.keystore -out keystore-base64.txt
   ```
2. Add the following **GitHub Secrets** in your repository settings:
   - `KEYSTORE_BASE64`: The full content of `keystore-base64.txt`.
   - `RELEASE_KEYSTORE_PASSWORD`: The password of your keystore.
   - `RELEASE_KEY_ALIAS`: Your key alias (e.g., `my-key-alias`).
   - `RELEASE_KEY_PASSWORD`: The password for your key.

3. Update `.github/workflows/android-build.yml` by inserting a signing step before uploading the artifact:
   ```yaml
      - name: Sign App Bundle
        uses: r0adkll/sign-android-release@v1
        id: sign_app
        with:
          releaseDirectory: android/app/build/outputs/bundle/release
          signingKeyBase64: ${{ secrets.KEYSTORE_BASE64 }}
          alias: ${{ secrets.RELEASE_KEY_ALIAS }}
          keyStorePassword: ${{ secrets.RELEASE_KEYSTORE_PASSWORD }}
          keyPassword: ${{ secrets.RELEASE_KEY_PASSWORD }}
        env:
          BUILD_TOOLS_VERSION: "35.0.0"

      # Then change Upload AAB path to:
      # path: ${{ steps.sign_app.outputs.signedReleaseFile }}
   ```
