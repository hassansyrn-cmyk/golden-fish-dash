import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem } from '../storage';
import { useI18n } from '../i18n';
import { adManager } from '../managers/AdManager';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const { t } = useI18n();
  const [hasToken, setHasToken] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);

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
    if (isWatching) return;
    setIsWatching(true);
    setMessage(null);

    const earnedReward = await adManager.showRewarded();
    if (earnedReward) {
      onFinished();
      return;
    }

    setMessage(t('continue.adUnavailable'));
    setIsWatching(false);
  };

  return (
    <div className="screen continue-screen">
      <h2 className="screen-title">{t('continue.oneMoreDive')}</h2>
      <p className="continue-copy">
        {t('continue.copy')}
      </p>

      <div className="gameover-buttons">
        {hasToken && (
          <button className="btn btn-primary token-btn" onClick={handleUseToken} disabled={isWatching}>
            {t('continue.useTokenCount', { count: tokenCount })}
          </button>
        )}

        <button className="btn btn-ad" onClick={() => void handleWatchAd()} disabled={isWatching}>
          {isWatching ? t('continue.loadingAd') : t('continue.watchAd')}
        </button>

        <button className="btn btn-secondary" onClick={onSkip} disabled={isWatching}>
          {t('continue.noThanks')}
        </button>
      </div>

      {message && <p className="continue-note">{message}</p>}
    </div>
  );
}
