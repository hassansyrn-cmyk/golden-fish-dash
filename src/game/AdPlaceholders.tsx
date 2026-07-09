// -----------------------------------------------------------------------
// Ad placeholders. No real ad network code lives here yet.
//
// TODO(ads): Wire BannerAd up to Google AdSense (or another network) by
// mounting the ad unit inside .banner-ad-slot. It must stay outside the
// game canvas and never intercept pointer events used for gameplay.
//
// TODO(ads): InterstitialAd should be replaced with a real interstitial ad
// call (shown between rounds), triggered every 3rd game over.
// -----------------------------------------------------------------------

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
