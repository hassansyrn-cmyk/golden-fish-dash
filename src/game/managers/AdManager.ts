import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';

const GOOGLE_TEST_UNITS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

const PRODUCTION_UNITS = {
  rewarded: 'ca-app-pub-7778383086464835/5578402291',
  luckySpinRewarded: 'ca-app-pub-7778383086464835/1234465629',
} as const;

const testing = import.meta.env.VITE_ADMOB_TESTING === 'true';
const units = {
  rewarded: testing
    ? GOOGLE_TEST_UNITS.rewarded
    : import.meta.env.VITE_ADMOB_REWARDED_ID || PRODUCTION_UNITS.rewarded,
  luckySpinRewarded: testing
    ? GOOGLE_TEST_UNITS.rewarded
    : import.meta.env.VITE_ADMOB_LUCKY_SPIN_REWARDED_ID || PRODUCTION_UNITS.luckySpinRewarded,
};

type InitializationResult = 'ready' | 'consent-blocked' | 'failed';
let initialization: Promise<InitializationResult> | null = null;
let sdkInitialization: Promise<void> | null = null;
type RewardedPlacement = 'gameplay' | 'luckySpin';
const preparedRewardedAdIds = new Set<string>();
let rewardedShowInFlight = false;

function rewardedUnitId(placement: RewardedPlacement) {
  return placement === 'luckySpin' ? units.luckySpinRewarded : units.rewarded;
}

function isNativeAdMobAvailable() {
  return Capacitor.isNativePlatform();
}

async function initialize(): Promise<boolean> {
  if (!isNativeAdMobAvailable()) return false;
  if (initialization) return (await initialization) === 'ready';

  const attempt: Promise<InitializationResult> = (async () => {
    try {
      // Initialize the Mobile Ads SDK before requesting UMP consent information.
      // The plugin requires consent to allow ad requests, not SDK initialization.
      if (!sdkInitialization) {
        const sdkAttempt = AdMob.initialize({
          initializeForTesting: testing,
          maxAdContentRating: MaxAdContentRating.ParentalGuidance,
        });
        sdkInitialization = sdkAttempt.catch((error) => {
          sdkInitialization = null;
          throw error;
        });
      }
      await sdkInitialization;

      if (!testing) {
        let consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.status === AdmobConsentStatus.REQUIRED &&
          consentInfo.isConsentFormAvailable
        ) {
          consentInfo = await AdMob.showConsentForm();
        }

        if (!consentInfo.canRequestAds) {
          console.warn('[AdMob] Ads are paused until consent allows ad requests.', {
            status: consentInfo.status,
            isConsentFormAvailable: consentInfo.isConsentFormAvailable,
            canRequestAds: consentInfo.canRequestAds,
          });
          return 'consent-blocked';
        }
      }

      return 'ready';
    } catch (error) {
      console.warn('[AdMob] SDK initialization or consent check failed.', error);
      return 'failed';
    }
  })();

  initialization = attempt;
  const result = await attempt;
  // Retry transient SDK or consent failures on the next ad attempt. Keep a
  // completed consent block cached so a declined form is not shown repeatedly.
  if (result === 'failed' && initialization === attempt) {
    initialization = null;
  }
  return result === 'ready';
}

async function preloadRewarded(placement: RewardedPlacement = 'gameplay') {
  if (!(await initialize())) return false;

  const adId = rewardedUnitId(placement);
  if (preparedRewardedAdIds.has(adId)) return true;

  try {
    await AdMob.prepareRewardVideoAd({
      adId,
      isTesting: testing,
      immersiveMode: true,
    });
    preparedRewardedAdIds.add(adId);
    return true;
  } catch (error) {
    console.warn('[AdMob] Rewarded ad was not available.', error);
    preparedRewardedAdIds.delete(adId);
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

    const preloadTasks = [preloadRewarded('gameplay')];
    if (units.luckySpinRewarded !== units.rewarded) {
      preloadTasks.push(preloadRewarded('luckySpin'));
    }
    await Promise.all(preloadTasks);
    return true;
  },

  async showRewarded(placement: RewardedPlacement = 'gameplay'): Promise<boolean> {
    if (!isNativeAdMobAvailable()) return true;
    // The native plugin exposes process-wide listeners. Never overlap shows:
    // concurrent callers could otherwise observe the same reward and grant it twice.
    if (rewardedShowInFlight) return false;
    rewardedShowInFlight = true;

    let preloaded = false;
    try {
      preloaded = await preloadRewarded(placement);
    } catch (error) {
      console.warn('[AdMob] Rewarded ad preload failed:', error);
    }
    if (!preloaded) {
      rewardedShowInFlight = false;
      return false;
    }

    const adId = rewardedUnitId(placement);
    let earned = false;
    let rewardedHandle: PluginListenerHandle | null = null;
    let dismissedHandle: PluginListenerHandle | null = null;
    let failedHandle: PluginListenerHandle | null = null;

    try {
      // Android resolves showRewardVideoAd from onUserEarnedReward, before the
      // fullscreen ad closes. Only Dismissed completes a successful presentation.
      let finish!: (value: boolean) => void;
      const lifecycle = new Promise<boolean>((resolve) => { finish = resolve; });
      let terminal = false;
      const settle = (value: boolean) => {
        if (terminal) return;
        terminal = true;
        finish(value);
      };
      dismissedHandle = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        console.log('[AdMob] Rewarded ad dismissed');
        settle(earned);
      });
      failedHandle = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        settle(false);
      });
      rewardedHandle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        console.log('[AdMob] Rewarded event received:', reward);
        earned = true;
      });

      // On Android this promise may resolve at reward-time, not close-time.
      // Rejection indicates show failure; ignore the resolved reward payload.
      void AdMob.showRewardVideoAd().catch((error) => {
        console.warn('[AdMob] showRewardVideoAd failed:', error);
        settle(false);
      });
      return await lifecycle;
    } catch (error) {
      console.warn('[AdMob] Could not start rewarded ad:', error);
      return false;
    } finally {
      if (rewardedHandle) {
        await rewardedHandle.remove().catch(() => undefined);
      }
      if (dismissedHandle) {
        await dismissedHandle.remove().catch(() => undefined);
      }
      if (failedHandle) {
        await failedHandle.remove().catch(() => undefined);
      }
      preparedRewardedAdIds.delete(adId);
      rewardedShowInFlight = false;
      void preloadRewarded(placement);
    }
  },

  async showPrivacyOptions() {
    if (!(await initialize())) return false;
    try {
      await AdMob.showPrivacyOptionsForm();
      return true;
    } catch (error) {
      console.warn('[AdMob] Privacy options form was not available.', error);
      return false;
    }
  },
};

export const ADMOB_SETUP_NOTES = {
  testing,
  usesGoogleTestUnits: testing,
};
