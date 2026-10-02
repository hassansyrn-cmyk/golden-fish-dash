# AdMob setup for Golden Fish Dash

> This is an implementation checklist, not legal advice. Review Google Play, AdMob, consent, and privacy requirements for the countries where you distribute the app before production release.

## What is already wired

The Android app now initializes `@capacitor-community/admob` and uses three placements:

| Placement | Player moment | Reward / behavior |
|---|---|---|
| Adaptive banner | Menu and game-over screens | Removed during active play. |
| Rewarded ad | Continue screen | A revive is granted only when the SDK confirms an earned reward. |
| Rewarded ad | Game-over double reward button | The extra coins and XP are granted only after an earned reward. |
| Interstitial | Every third game-over event | Displays only between rounds, never during active play. |

## Production configuration

The Android manifest uses the Golden Fish Dash production AdMob app ID from:

```text
android/app/src/main/res/values/strings.xml
```

The production banner, interstitial, and rewarded unit IDs are defined in:

```text
src/game/managers/AdManager.ts
```

The app requests Google UMP consent information before initializing the Mobile Ads SDK. If consent is required, it displays the consent form and does not request ads until the SDK reports that ad requests are allowed.

## Safe test mode

Never click live ads while testing. Build with Google sample ad units by setting:

```bash
VITE_ADMOB_TESTING=true
```

Production builds use the real units by default. The unit IDs can still be overridden with `VITE_ADMOB_BANNER_ID`, `VITE_ADMOB_INTERSTITIAL_ID`, and `VITE_ADMOB_REWARDED_ID`.

After any identifier change, run:

```bash
pnpm build
npx cap sync android
```

Verify that the ad format and unit type match: banner for the banner placement, interstitial for the between-rounds placement, and rewarded for both reward paths.

## Recommended validation for closed testing

Test on a physical Android device with `VITE_ADMOB_TESTING=true`. Confirm that a banner appears on menu and game-over screens only, a rewarded ad opens from both revive and double-reward buttons, and cancelling or failing an ad grants **no** revival or extra currency. Check that the interstitial appears after every third completed run. Finally, publish the required message in AdMob Privacy & messaging, and review the Privacy Policy and Google Play Data safety form before production.
