# AdMob setup for Golden Fish Dash

> This is an implementation checklist, not legal advice. Review Google Play, AdMob, consent, and privacy requirements for the countries where you distribute the app before production release.

## What is already wired

The Android app now initializes `@capacitor-community/admob` and uses three placements:

| Placement | Player moment | Reward / behavior |
|---|---|---|
| Adaptive banner | Native Android app shell | Displays without affecting a run. |
| Rewarded ad | Continue screen | A revive is granted only when the SDK confirms an earned reward. |
| Rewarded ad | Game-over double reward button | The extra coins and XP are granted only after an earned reward. |
| Interstitial | Every third game-over event | Displays only between rounds, never during active play. |

## Closed-testing configuration

The branch intentionally defaults to Google’s **sample test identifiers**. This is the correct configuration for functional verification during closed testing and prevents invalid traffic. The Android sample app ID is in:

```text
android/app/src/main/res/values/strings.xml
```

The JavaScript unit IDs are defined in:

```text
src/game/managers/AdManager.ts
```

## Switch to real production units

Before a public production release, replace the Android app ID in `strings.xml`, then supply your real unit IDs through Vite build variables:

```bash
VITE_ADMOB_TESTING=false
VITE_ADMOB_BANNER_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
VITE_ADMOB_INTERSTITIAL_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
VITE_ADMOB_REWARDED_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
```

After any identifier change, run:

```bash
pnpm build
npx cap sync android
```

Do not replace the test identifiers with production IDs until your app is ready for real ad traffic. Verify that the ad format and unit type match: banner for the banner placement, interstitial for the interstitial placement, and rewarded for both reward paths.

## Recommended validation for closed testing

Test on a physical Android device. Confirm that a banner appears only in the native app, a rewarded ad opens from both revive and double-reward buttons, and cancelling or failing an ad grants **no** revival or extra currency. Check that the interstitial appears between rounds only. Finally, review the Privacy Policy, the Google Play Data safety form, the AdMob privacy/consent configuration, and your consent flow before production.
