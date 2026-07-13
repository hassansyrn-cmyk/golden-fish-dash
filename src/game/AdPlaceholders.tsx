// -----------------------------------------------------------------------
// Ad placeholders. No real ad network code lives here yet.
//
// FUTURE ADMOB INTEGRATION INSTRUCTIONS (Capacitor Android):
//
// To integrate real Google AdMob ads into this Android app, you should use the
// official Capacitor AdMob Community Plugin:
//   Command: pnpm add @capacitor-community/admob
//   Command: npx cap sync android
//
// 1. Android Configuration (android/app/src/main/AndroidManifest.xml):
//    Inside the <application> tag, add the AdMob App ID:
//    <meta-data
//        android:name="com.google.android.gms.ads.APPLICATION_ID"
//        android:value="ca-app-pub-3940256099942544~3347511713"/> <!-- Test App ID -->
//
// 2. Initialization:
//    In your App.tsx or GoldenFishRush.tsx (on mount):
//    import { AdMob } from '@capacitor-community/admob';
//
//    useEffect(() => {
//      AdMob.initialize({
//        requestTrackingAuthorization: true,
//        testingDevices: ['YOUR_TEST_DEVICE_ID'],
//        initializeForTesting: true, // Set to false in production
//      });
//    }, []);
//
// -----------------------------------------------------------------------

import { useEffect } from 'react';

/**
 * 3. BANNER AD INTEGRATION
 * To show a real Banner Ad:
 *
 * import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';
 *
 * useEffect(() => {
 *   const showBanner = async () => {
 *     const options = {
 *       adId: 'ca-app-pub-3940256099942544/6300978111', // Test Banner Ad Unit ID
 *       adSize: BannerAdSize.BANNER,
 *       position: BannerAdPosition.BOTTOM_CENTER,
 *       margin: 0,
 *       isTesting: true // Set to false in production
 *     };
 *     await AdMob.showBanner(options);
 *   };
 *
 *   showBanner();
 *
 *   // Clean up / hide banner on unmount
 *   return () => {
 *     AdMob.removeBanner();
 *   };
 * }, []);
 */
export function BannerAd() {
  return (
    <div className="banner-ad-slot" role="complementary" aria-label="Advertisement placeholder">
      <span>Ad space — Banner (320x50)</span>
    </div>
  );
}

interface InterstitialProps {
  onClose: () => void;
}

/**
 * 4. INTERSTITIAL AD INTEGRATION
 * To show a real Interstitial Ad after a game over (e.g. every 3rd game over):
 *
 * import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
 *
 * // Step A: Preload the Interstitial Ad on component mount or game start
 * const preloadInterstitial = async () => {
 *   await AdMob.prepareInterstitial({
 *     adId: 'ca-app-pub-3940256099942544/1033173712', // Test Interstitial Ad Unit ID
 *     isTesting: true
 *   });
 * };
 *
 * // Step B: Show the Interstitial Ad when triggered
 * const showInterstitial = async () => {
 *   // Show interstitial ad, then run the onClose callback when dismissed
 *   AdMob.addListener('onInterstitialDismissed', () => {
 *     onClose();
 *   });
 *
 *   try {
 *     await AdMob.showInterstitial();
 *   } catch (error) {
 *     console.error("Failed to show interstitial, skipping.", error);
 *     onClose(); // Fallback in case of load failure
 *   }
 * };
 */
export function InterstitialAd({ onClose }: InterstitialProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card interstitial-card">
        <span className="ad-label">Advertisement</span>
        <div className="interstitial-placeholder">Ad space — Interstitial</div>
        <button className="btn btn-primary" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * 5. REWARDED AD INTEGRATION
 * To show a real Rewarded Ad inside `ContinueAdScreen.tsx` for revival:
 *
 * import { AdMob, RewardItem } from '@capacitor-community/admob';
 *
 * // Step A: Preload the Rewarded Ad
 * const preloadRewarded = async () => {
 *   await AdMob.prepareRewardVideoAd({
 *     adId: 'ca-app-pub-3940256099942544/5224354917', // Test Rewarded Ad Unit ID
 *     isTesting: true
 *   });
 * };
 *
 * // Step B: Show the Rewarded Ad
 * const showRewarded = async (onRewardEarned: () => void, onSkipped: () => void) => {
 *   let earnedReward = false;
 *
 *   AdMob.addListener('onRewardedVideoRewardEarned', (info: RewardItem) => {
 *     earnedReward = true;
 *   });
 *
 *   AdMob.addListener('onRewardedVideoAdDismissed', () => {
 *     if (earnedReward) {
 *       onRewardEarned(); // Player watched the ad and gets a second chance
 *     } else {
 *       onSkipped(); // Player closed the ad early, game over
 *     }
 *   });
 *
 *   try {
 *     await AdMob.showRewardVideoAd();
 *   } catch (error) {
 *     console.error("Ad failed to show, give grace pass or handle skip", error);
 *     onSkipped();
 *   }
 * };
 */
