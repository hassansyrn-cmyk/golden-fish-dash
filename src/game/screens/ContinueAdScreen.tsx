import { useEffect, useState } from 'react';
import { getShopItemCount, consumeShopItem } from '../storage';
import { useI18n } from '../i18n';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const { t } = useI18n();
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
    setMessage(t('continue.adNotice'));
  };

  return (
    <div className="screen continue-screen">
      <h2 className="screen-title">{t('continue.oneMoreDive')}</h2>
      <p className="continue-copy">
        {t('continue.copy')}
      </p>

      <div className="gameover-buttons">
        {hasToken && (
          <button className="btn btn-primary token-btn" onClick={handleUseToken}>
            {t('continue.useTokenCount', { count: tokenCount })}
          </button>
        )}

        <button className="btn btn-ad" onClick={handleWatchAd}>
          {t('continue.adSoon')}
        </button>

        <button className="btn btn-secondary" onClick={onSkip}>
          {t('continue.noThanks')}
        </button>
      </div>

      {message && <p className="continue-note">{message}</p>}
      <p className="continue-note">{t('continue.approvedNotice')}</p>
    </div>
  );
}
