import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem, hasUsedSecondChanceEver } from '../storage';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

// -----------------------------------------------------------------------
// Fake rewarded-ad simulation + Continue Token support.
// Token allows revive without ad (one per run).
// -----------------------------------------------------------------------
export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [watching, setWatching] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenUsed, setTokenUsed] = useState(false);

  useEffect(() => {
    const tokenCount = getShopItemCount('continueToken');
    const usedSecond = hasUsedSecondChanceEver(); // or per run flag, but simple
    setHasToken(tokenCount > 0 && !usedSecond);
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
      onFinished();
    }
  };

  if (!watching && !tokenUsed) {
    return (
      <div className="screen continue-screen">
        <h2 className="screen-title">Continue?</h2>
        <p className="continue-copy">Watch a short ad or use a Continue Token for one more chance.</p>
        <div className="gameover-buttons">
          {hasToken && (
            <button className="btn btn-primary" onClick={handleUseToken}>
              Use Continue Token
            </button>
          )}
          <button className="btn btn-ad" onClick={() => setWatching(true)}>
            Watch Ad to Continue
          </button>
          <button className="btn btn-secondary" onClick={onSkip}>
            No Thanks
          </button>
        </div>
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
