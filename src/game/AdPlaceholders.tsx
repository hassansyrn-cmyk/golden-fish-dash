import { useEffect } from 'react';
import { adManager } from './managers/AdManager';

interface BannerAdProps {
  visible: boolean;
}

/**
 * Controls the native adaptive banner. The Capacitor plugin renders the ad
 * outside React's DOM, so the web build intentionally renders nothing here.
 */
export function BannerAd({ visible }: BannerAdProps) {
  useEffect(() => {
    let cancelled = false;

    if (visible) {
      void adManager.showBanner().then((shown) => {
        if (cancelled && shown) void adManager.removeBanner();
      });
    } else {
      void adManager.removeBanner();
    }

    return () => {
      cancelled = true;
      void adManager.removeBanner();
    };
  }, [visible]);

  return null;
}
