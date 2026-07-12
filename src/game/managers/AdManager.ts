/**
 * AdManager - Phase 4 Monetization
 * Handles interstitial and rewarded ad logic.
 * 
 * In production, replace the placeholders with real AdMob / Unity Ads / AppLovin MAX.
 */

export type AdType = 'interstitial' | 'rewarded';

class AdManager {
  private interstitialCount = 0;
  private readonly INTERSTITIAL_FREQUENCY = 4; // Show interstitial every 4 game overs

  /**
   * Call this when the player reaches Game Over.
   * Returns true if an interstitial should be shown.
   */
  shouldShowInterstitial(): boolean {
    this.interstitialCount++;
    return this.interstitialCount % this.INTERSTITIAL_FREQUENCY === 0;
  }

  /**
   * Reset counter (useful after certain events).
   */
  resetInterstitialCounter() {
    this.interstitialCount = 0;
  }

  /**
   * Placeholder for showing rewarded ad.
   * In real implementation, call the ad SDK here.
   */
  async showRewardedAd(): Promise<boolean> {
    console.log('[AdManager] Showing Rewarded Ad (placeholder)');
    // Simulate ad completion
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('[AdManager] Rewarded Ad completed');
        resolve(true);
      }, 800);
    });
  }

  /**
   * Placeholder for showing interstitial ad.
   */
  async showInterstitialAd(): Promise<void> {
    console.log('[AdManager] Showing Interstitial Ad (placeholder)');
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('[AdManager] Interstitial Ad closed');
        resolve();
      }, 600);
    });
  }
}

export const adManager = new AdManager();
