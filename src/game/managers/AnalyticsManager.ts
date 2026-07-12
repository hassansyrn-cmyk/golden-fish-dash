/**
 * AnalyticsManager - Phase 4 foundation
 * Simple event tracking for retention and monetization insights.
 *
 * In production, this can be connected to Firebase Analytics, GameAnalytics, or custom backend.
 */

export type AnalyticsEvent =
  | 'game_start'
  | 'game_over'
  | 'level_up'
  | 'mission_completed'
  | 'purchase'
  | 'ad_watched'
  | 'powerup_activated'
  | 'near_miss';

interface EventPayload {
  [key: string]: string | number | boolean;
}

class AnalyticsManager {
  private enabled = true;

  track(event: AnalyticsEvent, payload: EventPayload = {}) {
    if (!this.enabled) return;

    // In development we log to console
    console.log(`[Analytics] ${event}`, payload);

    // TODO: Send to Firebase / backend in production
    // Example:
    // firebase.analytics().logEvent(event, payload);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const analytics = new AnalyticsManager();
