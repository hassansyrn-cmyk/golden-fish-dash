import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';

const GOOGLE_TEST_UNITS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

const testing = import.meta.env.VITE_ADMOB_TESTING !== 'false';
const units = {
  banner: import.meta.env.VITE_ADMOB_BANNER_ID || GOOGLE_TEST_UNITS.banner,
  interstitial: import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || GOOGLE_TEST_UNITS.interstitial,
  rewarded: import.meta.env.VITE_ADMOB_REWARDED_ID || GOOGLE_TEST_UNITS.rewarded,
};

let initialization: Promise<boolean> | null = null;
let rewardedPrepared = false;
let interstitialPrepared = false;

function isNativeAdMobAvailable() {
  return Capacitor.isNativePlatform();
}

async function initialize(): Promise<boolean> {
  if (!isNativeAdMobAvailable()) return false;
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      await AdMob.initialize({
        initializeForTesting: testing,
        maxAdContentRating: MaxAdContentRating.ParentalGuidance,
      });
      return true;
    } catch (error) {
      console.warn('[AdMob] SDK initialization failed.', error);
      return false;
    }
  })();

  return initialization;
}

async function preloadRewarded() {
  if (!(await initialize()) || rewardedPrepared) return false;

  try {
    await AdMob.prepareRewardVideoAd({
      adId: units.rewarded,
      isTesting: testing,
      immersiveMode: true,
    });
    rewardedPrepared = true;
    return true;
  } catch (error) {
    console.warn('[AdMob] Rewarded ad was not available.', error);
    rewardedPrepared = false;
    return false;
  }
}

async function preloadInterstitial() {
  if (!(await initialize()) || interstitialPrepared) return false;

  try {
    await AdMob.prepareInterstitial({
      adId: units.interstitial,
      isTesting: testing,
      immersiveMode: true,
    });
    interstitialPrepared = true;
    return true;
  } catch (error) {
    console.warn('[AdMob] Interstitial ad was not available.', error);
    interstitialPrepared = false;
    return false;
  }
}

export const adManager = {
  isNative: isNativeAdMobAvailable,
  isTesting: () => testing,
  getTestAppId: () => GOOGLE_TEST_UNITS.appId,

  async initializeAndPreload() {
    const ready = await initialize();
    if (!ready) return false;
    await Promise.all([preloadRewarded(), preloadInterstitial()]);
    return true;
  },

  async showRewarded(): Promise<boolean> {
    if (!(await preloadRewarded())) return false;

    try {
      // The plugin resolves only after the earned-reward callback. Never grant
      // a revival from dismissal or a failed ad presentation.
      await AdMob.showRewardVideoAd({ adId: units.rewarded });
      rewardedPrepared = false;
      void preloadRewarded();
      return true;
    } catch (error) {
      console.warn('[AdMob] Rewarded ad did not earn a reward.', error);
      rewardedPrepared = false;
      void preloadRewarded();
      return false;
    }
  },

  async showInterstitial(): Promise<boolean> {
    if (!(await preloadInterstitial())) return false;

    try {
      await AdMob.showInterstitial({ adId: units.interstitial });
      interstitialPrepared = false;
      void preloadInterstitial();
      return true;
    } catch (error) {
      console.warn('[AdMob] Interstitial ad was not shown.', error);
      interstitialPrepared = false;
      void preloadInterstitial();
      return false;
    }
  },

  async showBanner() {
    if (!(await initialize())) return false;

    try {
      await AdMob.showBanner({
        adId: units.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: testing,
      });
      return true;
    } catch (error) {
      console.warn('[AdMob] Banner ad was not available.', error);
      return false;
    }
  },

  async removeBanner() {
    if (!isNativeAdMobAvailable()) return;
    try {
      await AdMob.removeBanner();
    } catch {
      // Safe cleanup when no banner was loaded.
    }
  },
};

export const ADMOB_SETUP_NOTES = {
  testing,
  usesGoogleTestUnits:
    units.banner === GOOGLE_TEST_UNITS.banner ||
    units.interstitial === GOOGLE_TEST_UNITS.interstitial ||
    units.rewarded === GOOGLE_TEST_UNITS.rewarded,
};
