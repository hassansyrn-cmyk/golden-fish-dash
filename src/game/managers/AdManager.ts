import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
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

const PRODUCTION_UNITS = {
  banner: 'ca-app-pub-7778383086464835/3015643122',
  interstitial: 'ca-app-pub-7778383086464835/1702561451',
  rewarded: 'ca-app-pub-7778383086464835/5578402291',
  luckySpinRewarded: 'ca-app-pub-7778383086464835/1234465629',
} as const;

const testing = import.meta.env.VITE_ADMOB_TESTING === 'true';
const diagnosticsEnabled = import.meta.env.VITE_ADMOB_DIAGNOSTICS === 'true';
const units = {
  banner: testing
    ? GOOGLE_TEST_UNITS.banner
    : import.meta.env.VITE_ADMOB_BANNER_ID || PRODUCTION_UNITS.banner,
  interstitial: testing
    ? GOOGLE_TEST_UNITS.interstitial
    : import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || PRODUCTION_UNITS.interstitial,
  rewarded: testing
    ? GOOGLE_TEST_UNITS.rewarded
    : import.meta.env.VITE_ADMOB_REWARDED_ID || PRODUCTION_UNITS.rewarded,
  luckySpinRewarded: testing
    ? GOOGLE_TEST_UNITS.rewarded
    : import.meta.env.VITE_ADMOB_LUCKY_SPIN_REWARDED_ID || PRODUCTION_UNITS.luckySpinRewarded,
};

type DiagnosticStatus = 'pending' | 'initializing' | 'ready' | 'blocked' | 'error' | 'loading' | 'loaded';
export interface AdDiagnosticsSnapshot {
  native: boolean;
  testAds: boolean;
  updatedAt: string;
  sdk: { status: DiagnosticStatus; detail: string };
  consent: {
    status: DiagnosticStatus;
    consentStatus: string;
    canRequestAds: boolean | null;
    isConsentFormAvailable: boolean | null;
    detail: string;
  };
  rewarded: { status: DiagnosticStatus; placement: string; detail: string };
}

const initialDiagnostics: AdDiagnosticsSnapshot = {
  native: Capacitor.isNativePlatform(),
  testAds: testing,
  updatedAt: new Date().toISOString(),
  sdk: { status: 'pending', detail: 'SDK initialization has not started.' },
  consent: {
    status: 'pending',
    consentStatus: 'Not requested',
    canRequestAds: null,
    isConsentFormAvailable: null,
    detail: 'UMP consent information has not been requested.',
  },
  rewarded: { status: 'pending', placement: 'gameplay', detail: 'Rewarded-ad load has not started.' },
};
let diagnosticSnapshot = initialDiagnostics;
const diagnosticListeners = new Set<() => void>();

export function getAdDiagnosticsSnapshot() {
  return diagnosticSnapshot;
}

export function subscribeToAdDiagnostics(listener: () => void) {
  diagnosticListeners.add(listener);
  return () => diagnosticListeners.delete(listener);
}

function updateDiagnostics(update: Partial<AdDiagnosticsSnapshot>) {
  if (!diagnosticsEnabled) return;
  diagnosticSnapshot = { ...diagnosticSnapshot, ...update, updatedAt: new Date().toISOString() };
  diagnosticListeners.forEach((listener) => listener());
}

function diagnosticError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error === 'object') {
    const value = error as { code?: unknown; message?: unknown; domain?: unknown };
    const parts = [
      value.code !== undefined ? `code=${String(value.code)}` : '',
      value.domain !== undefined ? `domain=${String(value.domain)}` : '',
      value.message !== undefined ? String(value.message) : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

type InitializationResult = 'ready' | 'consent-blocked' | 'failed';
let initialization: Promise<InitializationResult> | null = null;
let sdkInitialization: Promise<void> | null = null;
type RewardedPlacement = 'gameplay' | 'luckySpin';
const preparedRewardedAdIds = new Set<string>();
let interstitialPrepared = false;

function rewardedUnitId(placement: RewardedPlacement) {
  return placement === 'luckySpin' ? units.luckySpinRewarded : units.rewarded;
}

function isNativeAdMobAvailable() {
  return Capacitor.isNativePlatform();
}

async function initialize(): Promise<boolean> {
  if (!isNativeAdMobAvailable()) {
    updateDiagnostics({ sdk: { status: 'error', detail: 'AdMob is available only in the native Android/iOS app.' } });
    return false;
  }
  if (initialization) return (await initialization) === 'ready';

  const attempt: Promise<InitializationResult> = (async () => {
    try {
      // Initialize the Mobile Ads SDK before requesting UMP consent information.
      // The plugin requires consent to allow ad requests, not SDK initialization.
      if (!sdkInitialization) {
        updateDiagnostics({ sdk: { status: 'initializing', detail: 'Starting the Google Mobile Ads SDK.' } });
        const sdkAttempt = AdMob.initialize({
          initializeForTesting: testing,
          maxAdContentRating: MaxAdContentRating.ParentalGuidance,
        });
        sdkInitialization = sdkAttempt.catch((error) => {
          sdkInitialization = null;
          updateDiagnostics({ sdk: { status: 'error', detail: diagnosticError(error) } });
          throw error;
        });
      }
      await sdkInitialization;
      updateDiagnostics({ sdk: { status: 'ready', detail: 'Google Mobile Ads SDK initialized.' } });

      // The diagnostic build keeps Google's sample ad units but deliberately
      // runs the same UMP gate as production so its actual consent state is visible.
      if (!testing || diagnosticsEnabled) {
        updateDiagnostics({
          consent: {
            status: 'initializing',
            consentStatus: 'Requesting',
            canRequestAds: null,
            isConsentFormAvailable: null,
            detail: 'Requesting UMP consent information.',
          },
        });
        let consentInfo = await AdMob.requestConsentInfo();
        updateDiagnostics({
          consent: {
            status: 'ready',
            consentStatus: String(consentInfo.status),
            canRequestAds: consentInfo.canRequestAds,
            isConsentFormAvailable: consentInfo.isConsentFormAvailable ?? null,
            detail: 'UMP consent information received.',
          },
        });

        if (
          consentInfo.status === AdmobConsentStatus.REQUIRED &&
          consentInfo.isConsentFormAvailable
        ) {
          updateDiagnostics({
            consent: {
              status: 'initializing',
              consentStatus: String(consentInfo.status),
              canRequestAds: consentInfo.canRequestAds,
              isConsentFormAvailable: consentInfo.isConsentFormAvailable,
              detail: 'UMP requires consent; showing the available consent form.',
            },
          });
          consentInfo = await AdMob.showConsentForm();
          updateDiagnostics({
            consent: {
              status: 'ready',
              consentStatus: String(consentInfo.status),
              canRequestAds: consentInfo.canRequestAds,
              isConsentFormAvailable: consentInfo.isConsentFormAvailable ?? diagnosticSnapshot.consent.isConsentFormAvailable,
              detail: 'UMP consent form completed.',
            },
          });
        }

        if (!consentInfo.canRequestAds) {
          updateDiagnostics({
            consent: {
              status: 'blocked',
              consentStatus: String(consentInfo.status),
              canRequestAds: false,
              isConsentFormAvailable: consentInfo.isConsentFormAvailable ?? diagnosticSnapshot.consent.isConsentFormAvailable,
              detail: 'UMP currently does not allow ad requests; no ad load was attempted.',
            },
          });
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
      if (diagnosticsEnabled && diagnosticSnapshot.consent.status === 'initializing') {
        updateDiagnostics({
          consent: {
            ...diagnosticSnapshot.consent,
            status: 'error',
            detail: diagnosticError(error),
          },
        });
      }
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

  updateDiagnostics({
    rewarded: { status: 'loading', placement, detail: 'Requesting a Google test rewarded ad.' },
  });
  try {
    await AdMob.prepareRewardVideoAd({
      adId,
      isTesting: testing,
      immersiveMode: true,
    });
    preparedRewardedAdIds.add(adId);
    updateDiagnostics({ rewarded: { status: 'loaded', placement, detail: 'Google test rewarded ad loaded.' } });
    return true;
  } catch (error) {
    const detail = diagnosticError(error);
    console.warn('[AdMob] Rewarded ad was not available.', error);
    preparedRewardedAdIds.delete(adId);
    updateDiagnostics({ rewarded: { status: 'error', placement, detail } });
    return false;
  }
}

async function preloadInterstitial() {
  if (!(await initialize())) return false;
  if (interstitialPrepared) return true;

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

    const preloadTasks = [preloadRewarded('gameplay'), preloadInterstitial()];
    if (units.luckySpinRewarded !== units.rewarded) {
      preloadTasks.push(preloadRewarded('luckySpin'));
    }
    await Promise.all(preloadTasks);
    return true;
  },

  async showRewarded(placement: RewardedPlacement = 'gameplay'): Promise<boolean> {
    if (!(await preloadRewarded(placement))) return false;

    const adId = rewardedUnitId(placement);

    try {
      // The plugin resolves only after the earned-reward callback. Never grant
      // a revival from dismissal or a failed ad presentation.
      await AdMob.showRewardVideoAd({ adId });
      preparedRewardedAdIds.delete(adId);
      void preloadRewarded(placement);
      return true;
    } catch (error) {
      console.warn('[AdMob] Rewarded ad did not earn a reward.', error);
      preparedRewardedAdIds.delete(adId);
      void preloadRewarded(placement);
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
