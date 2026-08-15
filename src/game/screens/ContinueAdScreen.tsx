import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem } from '../storage';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const [hasToken, setHasToken] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
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

  const handleWatchAd = () => {
    setMessage('Ad space is reserved for the production launch. Continue Tokens are available now.');
  };

  return (
    <div className="screen continue-screen">
      <h2 className="screen-title">One More Dive?</h2>
      <p className="continue-copy">
        Ad space is reserved for the production launch. Use a Continue Token to revive at a safe point.
      </p>

      <div className="gameover-buttons">
        {hasToken && (
          <button className="btn btn-primary token-btn" onClick={handleUseToken}>
            Use Continue Token ({tokenCount})
          </button>
        )}

        <button className="btn btn-ad" onClick={handleWatchAd}>
          Ad space — coming soon
        </button>

        <button className="btn btn-secondary" onClick={onSkip}>
          No Thanks
        </button>
      </div>

      {message && <p className="continue-note">{message}</p>}
      <p className="continue-note">Rewarded ads will return with production-approved units.</p>
    </div>
  );
}
