import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
  RewardAdPluginEvents,
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

const testing = import.meta.env.VITE_ADMOB_TESTING !== 'false';
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

let initialization: Promise<boolean> | null = null;
type RewardedPlacement = 'gameplay' | 'luckySpin';
const preparedRewardedAdIds = new Set<string>();
let interstitialPrepared = false;

interface AdMobAdapterDiagnostic {
  adapterClassName?: string;
  latencyMillis?: number;
  description?: string;
}

interface AdMobResponseDiagnostic {
  responseId?: string;
  mediationAdapterClassName?: string;
  adapterResponses?: AdMobAdapterDiagnostic[];
}

interface AdMobErrorDiagnostic {
  code?: number;
  domain?: string;
  message: string;
  responseInfo?: AdMobResponseDiagnostic;
}

export interface AdMobDiagnostic {
  at: string;
  stage: string;
  mode: 'google-test-units' | 'production-units';
  placement?: RewardedPlacement | 'rewarded';
  error?: AdMobErrorDiagnostic;
  consent?: {
    status: string;
    isConsentFormAvailable: boolean;
    canRequestAds: boolean;
  };
}

const MAX_DIAGNOSTICS = 20;
const diagnostics: AdMobDiagnostic[] = [];
const enrichedLoadFailures = new Map<string, number>();
const enrichedShowFailures = new Map<string, number>();

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function safeString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, maxLength);
}

function normalizeError(error: unknown): AdMobErrorDiagnostic {
  const value = asRecord(error);
  const rawMessage = safeString(value.message) ?? safeString(error instanceof Error ? error.message : error);
  const rawCode = value.code;
  const response = asRecord(value.responseInfo);
  const adapterResponses = Array.isArray(response.adapterResponses)
    ? response.adapterResponses.slice(0, 8).map((item) => {
        const adapter = asRecord(item);
        const latency = adapter.latencyMillis;
        return {
          ...(safeString(adapter.adapterClassName, 200)
            ? { adapterClassName: safeString(adapter.adapterClassName, 200) }
            : {}),
          ...(typeof latency === 'number' && Number.isFinite(latency)
            ? { latencyMillis: latency }
            : {}),
          ...(safeString(adapter.description)
            ? { description: safeString(adapter.description) }
            : {}),
        } satisfies AdMobAdapterDiagnostic;
      })
    : undefined;
  const responseInfo: AdMobResponseDiagnostic = {
    ...(safeString(response.responseId, 200)
      ? { responseId: safeString(response.responseId, 200) }
      : {}),
    ...(safeString(response.mediationAdapterClassName, 200)
      ? { mediationAdapterClassName: safeString(response.mediationAdapterClassName, 200) }
      : {}),
    ...(adapterResponses?.length ? { adapterResponses } : {}),
  };

  return {
    ...(typeof rawCode === 'number' && Number.isFinite(rawCode) ? { code: rawCode } : {}),
    ...(safeString(value.domain, 200) ? { domain: safeString(value.domain, 200) } : {}),
    message: rawMessage ?? 'No error message was supplied by the native plugin.',
    ...(Object.keys(responseInfo).length ? { responseInfo } : {}),
  };
}

function snapshotDiagnostics(): AdMobDiagnostic[] {
  return JSON.parse(JSON.stringify(diagnostics)) as AdMobDiagnostic[];
}

if (typeof window !== 'undefined') {
  const developerWindow = window as Window & {
    __goldenFishAdMobDiagnostics?: () => AdMobDiagnostic[];
  };
  developerWindow.__goldenFishAdMobDiagnostics = snapshotDiagnostics;
}

function recordDiagnostic(
  stage: string,
  options: {
    placement?: RewardedPlacement | 'rewarded';
    error?: unknown;
    consent?: AdMobDiagnostic['consent'];
    level?: 'info' | 'warn';
  } = {},
) {
  const entry: AdMobDiagnostic = {
    at: new Date().toISOString(),
    stage,
    mode: testing ? 'google-test-units' : 'production-units',
    ...(options.placement ? { placement: options.placement } : {}),
    ...(options.error !== undefined ? { error: normalizeError(options.error) } : {}),
    ...(options.consent ? { consent: options.consent } : {}),
  };
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();

  const serialized = JSON.stringify(entry);
  if (options.level === 'info') {
    console.info('[AdMob][diagnostic]', serialized);
  } else {
    console.warn('[AdMob][diagnostic]', serialized);
  }
}

function rewardedUnitId(placement: RewardedPlacement) {
  return placement === 'luckySpin' ? units.luckySpinRewarded : units.rewarded;
}

function placementForAdUnit(adUnitId: unknown): RewardedPlacement | 'rewarded' | undefined {
  if (typeof adUnitId !== 'string') return undefined;
  if (units.rewarded === units.luckySpinRewarded && adUnitId === units.rewarded) return 'rewarded';
  if (adUnitId === units.rewarded) return 'gameplay';
  if (adUnitId === units.luckySpinRewarded) return 'luckySpin';
  return undefined;
}

function isNativeAdMobAvailable() {
  return Capacitor.isNativePlatform();
}

async function initializeDiagnosticListeners() {
  try {
    await Promise.all([
      AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
        const adUnitId = asRecord(error).adUnitId;
        if (typeof adUnitId === 'string') enrichedLoadFailures.set(adUnitId, Date.now());
        recordDiagnostic('rewarded_load_failed', {
          placement: placementForAdUnit(adUnitId),
          error,
        });
      }),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
        const message = normalizeError(error).message;
        enrichedShowFailures.set(message, Date.now());
        recordDiagnostic('rewarded_show_failed', { error });
      }),
    ]);
  } catch (error) {
    // Diagnostics must never prevent ad initialization or requests.
    recordDiagnostic('diagnostic_listener_setup_failed', { error });
  }
}

async function initialize(): Promise<boolean> {
  if (!isNativeAdMobAvailable()) return false;
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      // Google sample ads are non-personalized and must remain available in
      // closed testing even before the production UMP message is published.
      if (!testing) {
        let consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.status === AdmobConsentStatus.REQUIRED &&
          consentInfo.isConsentFormAvailable
        ) {
          consentInfo = await AdMob.showConsentForm();
        }

        if (!consentInfo.canRequestAds) {
          recordDiagnostic('consent_blocked', {
            consent: {
              status: String(consentInfo.status),
              isConsentFormAvailable: Boolean(consentInfo.isConsentFormAvailable),
              canRequestAds: false,
            },
          });
          return false;
        }
      }

      await AdMob.initialize({
        initializeForTesting: testing,
        maxAdContentRating: MaxAdContentRating.ParentalGuidance,
      });
      await initializeDiagnosticListeners();
      recordDiagnostic('sdk_initialized', { level: 'info' });
      return true;
    } catch (error) {
      recordDiagnostic('sdk_initialization_failed', { error });
      return false;
    }
  })();

  return initialization;
}

async function preloadRewarded(placement: RewardedPlacement = 'gameplay') {
  if (!(await initialize())) return false;

  const adId = rewardedUnitId(placement);
  if (preparedRewardedAdIds.has(adId)) return true;

  enrichedLoadFailures.delete(adId);
  try {
    await AdMob.prepareRewardVideoAd({
      adId,
      isTesting: testing,
      immersiveMode: true,
    });
    preparedRewardedAdIds.add(adId);
    return true;
  } catch (error) {
    const observedAt = enrichedLoadFailures.get(adId);
    if (!observedAt || Date.now() - observedAt > 5000) {
      recordDiagnostic('rewarded_load_failed', { placement, error });
    }
    enrichedLoadFailures.delete(adId);
    preparedRewardedAdIds.delete(adId);
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
    recordDiagnostic('interstitial_load_failed', { error });
    interstitialPrepared = false;
    return false;
  }
}

export const adManager = {
  isNative: isNativeAdMobAvailable,
  isTesting: () => testing,
  getTestAppId: () => GOOGLE_TEST_UNITS.appId,
  getDiagnostics: snapshotDiagnostics,

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
      const message = normalizeError(error).message;
      const observedAt = enrichedShowFailures.get(message);
      if (!observedAt || Date.now() - observedAt > 5000) {
        recordDiagnostic('rewarded_show_failed', { placement, error });
      }
      enrichedShowFailures.delete(message);
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
      recordDiagnostic('interstitial_show_failed', { error });
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
      recordDiagnostic('banner_load_failed', { error });
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
      recordDiagnostic('privacy_options_form_failed', { error });
      return false;
    }
  },
};

export const ADMOB_SETUP_NOTES = {
  testing,
  usesGoogleTestUnits: testing,
};
