import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem } from '../storage';
import { adManager } from '../managers/AdManager';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const [hasToken, setHasToken] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [requestingAd, setRequestingAd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const count = getShopItemCount('continueToken');
    setTokenCount(count);
    setHasToken(count > 0);
  }, []);

  const handleUseToken = () => {
    if (consumeShopItem('continueToken')) {
      onFinished();
    }
  };

  const handleWatchAd = async () => {
    if (requestingAd) return;

    setRequestingAd(true);
    setMessage('Loading your reward…');
    const earnedReward = await adManager.showRewarded();
    setRequestingAd(false);

    if (earnedReward) {
      onFinished();
      return;
    }

    setMessage(
      adManager.isNative()
        ? 'No reward ad is ready yet. Please try again in a moment.'
        : 'Rewarded ads are available in the Android app during testing.',
    );
  };

  return (
    <div className="screen continue-screen">
      <h2 className="screen-title">One More Dive?</h2>
      <p className="continue-copy">
        Watch a rewarded ad to revive at a safe point, or use a Continue Token instantly.
      </p>

      <div className="gameover-buttons">
        {hasToken && (
          <button className="btn btn-primary token-btn" onClick={handleUseToken}>
            Use Continue Token ({tokenCount})
          </button>
        )}

        <button className="btn btn-ad" onClick={handleWatchAd} disabled={requestingAd}>
          {requestingAd ? 'Loading Reward…' : 'Watch Ad to Continue'}
        </button>

        <button className="btn btn-secondary" onClick={onSkip} disabled={requestingAd}>
          No Thanks
        </button>
      </div>

      {message && <p className="continue-note">{message}</p>}
      <p className="continue-note">You revive only after the reward is confirmed.</p>
    </div>
  );
}
