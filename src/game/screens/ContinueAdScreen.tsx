import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem } from '../storage';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

// -----------------------------------------------------------------------
// Continue screen with rewarded ad simulation + Continue Token support.
// Token allows direct revive without watching ad.
// -----------------------------------------------------------------------
export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [watching, setWatching] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenUsed, setTokenUsed] = useState(false);

  useEffect(() => {
    const count = getShopItemCount('continueToken');
    setTokenCount(count);
    setHasToken(count > 0); // Tokens work independently of free second chance
  }, []);

  useEffect(() => {
    if (!watching) return;
    if (secondsLeft <= 0) {
      onFinished();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [watching, secondsLeft, onFinished]);

  const handleUseToken = () => {
    if (consumeShopItem('continueToken')) {
      setTokenUsed(true);
      // Re-check remaining after consume
      const remaining = getShopItemCount('continueToken');
      setTokenCount(remaining);
      onFinished();
    }
  };

  if (!watching && !tokenUsed) {
    return (
      <div className="screen continue-screen">
        <h2 className="screen-title">Continue?</h2>
        <p className="continue-copy">Watch a short ad or use your Continue Token to revive instantly.</p>

        <div className="gameover-buttons">
          {hasToken && (
            <button
              className="btn btn-primary token-btn"
              onClick={handleUseToken}
            >
              Use Continue Token ({tokenCount})
            </button>
          )}

          <button className="btn btn-ad" onClick={() => setWatching(true)}>
            Watch Ad to Continue
          </button>

          <button className="btn btn-secondary" onClick={onSkip}>
            No Thanks
          </button>
        </div>

        <p className="continue-note">Tokens are consumed only when used.</p>
      </div>
    );
  }

  return (
    <div className="screen continue-screen ad-modal">
      <div className="ad-frame">
        <span className="ad-label">Advertisement</span>
        <div className="ad-countdown">{secondsLeft}</div>
        <p>Reviving your fish in {secondsLeft}s…</p>
      </div>
    </div>
  );
}
