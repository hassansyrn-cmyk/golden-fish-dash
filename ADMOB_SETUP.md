# AdMob setup for Golden Fish Dash

> Review Google Play, AdMob, consent, and privacy requirements for the countries where you distribute the app before publishing a production release.

## What is wired

The Android app uses the `@capacitor-community/admob` plugin for these placements:

| Placement | Player moment | Reward / behavior |
|---|---|---|
| Adaptive banner | Menu and game-over screens | Removed during active play. |
| Rewarded ad | Continue screen | A revive is granted only when the SDK confirms an earned reward. |
| Rewarded ad | Game-over double reward button | Extra coins and XP are granted only after an earned reward. |
| Rewarded ad | Lucky Spin screen | One free spin is granted only after the dedicated unit confirms an earned reward. |
| Interstitial | Every third game-over event | Displays between rounds, never during active play. |

## Production AdMob IDs

The Android app is registered in AdMob as `Golden Fish Dash`, package `com.husseinbostan.goldenfishdash`, with App ID `ca-app-pub-7778383086464835~5563066796`.

| Placement | AdMob unit | ID |
|---|---|---|
| Adaptive banner | Golden Fish Dash - Bottom Banner | `ca-app-pub-7778383086464835/3015643122` |
| Interstitial | Golden Fish Dash - Between Rounds | `ca-app-pub-7778383086464835/1702561451` |
| Gameplay rewarded | Golden Fish Dash - Rewarded Continue | `ca-app-pub-7778383086464835/5578402291` |
| Lucky Spin rewarded | Golden Fish Dash - Rewarded Lucky Spin | `ca-app-pub-7778383086464835/1234465629` |

These existing production units match all implemented formats. Their configuration is in `src/game/managers/AdManager.ts`.

## Test versus release configuration

Production ad units are the code default. Test mode is enabled only when `VITE_ADMOB_TESTING=true`; debug APK builds set that flag and use Google's sample banner, interstitial, and rewarded units.

The base Android resource at `android/app/src/main/res/values/strings.xml` contains Google's sample App ID. Only the release resource overlay at `android/app/src/release/res/values/strings.xml` contains the production App ID. The Android Build workflow's `admob_testing` input defaults to false. For a production AAB, select **Build a signed AAB** and leave **Use Google sample ads** disabled. Enable it only for a closed-testing AAB. Debug APKs and automatic push builds use sample units. The workflow builds and stores artifacts; it does not publish to Google Play.

For local builds, test mode:

```bash
VITE_ADMOB_TESTING=true pnpm build
pnpm cap:sync
cd android && ./gradlew assembleDebug --no-daemon
```

For a production-configured release AAB (build only; do not upload it to Play):

```bash
VITE_ADMOB_TESTING=false pnpm build
pnpm cap:sync
cd android && ./gradlew bundleRelease --no-daemon
```

Production unit IDs may be overridden with `VITE_ADMOB_BANNER_ID`, `VITE_ADMOB_INTERSTITIAL_ID`, `VITE_ADMOB_REWARDED_ID`, and `VITE_ADMOB_LUCKY_SPIN_REWARDED_ID`.

## Closed-testing validation

Test on a physical Android device with `VITE_ADMOB_TESTING=true`. Confirm that the banner appears on menu and game-over screens only, the rewarded continue and double-reward flows grant rewards only after the SDK confirms them, Lucky Spin uses its dedicated rewarded unit, and the interstitial appears after every third completed run. Review the Privacy Policy, Google Play Data safety form, and AdMob consent configuration before any production publication.
