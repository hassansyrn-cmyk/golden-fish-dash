import { useEffect, useState, useRef } from 'react';
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
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);
  const countdownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const count = getShopItemCount('continueToken');
    setTokenCount(count);
    setHasToken(count > 0);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const handleUseToken = () => {
    if (consumeShopItem('continueToken')) {
      onFinished();
    }
  };

  const handleWatchAd = async () => {
    if (isWatchingAd) return;

    if (adManager.isNative()) {
      setMessage(t('continue.adNotice'));
      const success = await adManager.showRewarded();
      if (success) {
        onFinished();
        return;
      }
      // If native ad failed or wasn't available, fall through to simulation
    }

    // Web fallback / Simulated Rewarded Video Ad
    setIsWatchingAd(true);
    setAdCountdown(3);

    let count = 3;
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1;
      setAdCountdown(count);
      if (count <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setIsWatchingAd(false);
        onFinished();
      }
    }, 1000);
  };

  return (
    <div className="screen continue-screen">
      <h2 className="screen-title">{t('continue.oneMoreDive')}</h2>
      <p className="continue-copy">
        {t('continue.copy')}
      </p>

      {isWatchingAd ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '12px',
          margin: '16px 0',
          width: '100%',
          maxWidth: '320px',
        }}>
          <div style={{ fontSize: '15px', color: '#80d8ff', fontWeight: 'bold' }}>
            🎬 Rewarded Video Ad ({adCountdown}s)
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${((3 - adCountdown) / 3) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #00e5ff, #76ff03)',
              transition: 'width 0.9s linear',
            }} />
          </div>
          <span style={{ fontSize: '12px', color: '#cfd8dc' }}>
            Reviving your fish upon completion...
          </span>
        </div>
      ) : (
        <div className="gameover-buttons">
          {hasToken && (
            <button className="btn btn-primary token-btn" onClick={handleUseToken}>
              {t('continue.useTokenCount', { count: tokenCount })}
            </button>
          )}

          <button className="btn btn-ad" onClick={handleWatchAd}>
            🎬 {t('continue.watchAd') || 'Watch Ad to Revive'}
          </button>

          <button className="btn btn-secondary" onClick={onSkip}>
            {t('continue.noThanks')}
          </button>
        </div>
      )}

      {message && <p className="continue-note">{message}</p>}
      <p className="continue-note">{t('continue.approvedNotice')}</p>
    </div>
  );
}
