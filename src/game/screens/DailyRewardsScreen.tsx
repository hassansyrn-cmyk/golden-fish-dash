import { useState, useEffect } from 'react';
import {
  canClaimDailyReward,
  claimDailyReward,
  getCurrentDailyReward,
} from '../storage';
import { translateDailyRewardCard, useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

// 7-day reward cycle data (matches storage)
const REWARD_CARDS = [
  { day: 1, label: '75 Coins', icon: '🪙' },
  { day: 2, label: '125 Coins', icon: '🪙' },
  { day: 3, label: 'Shield Charge', icon: '🛡️' },
  { day: 4, label: '175 Coins', icon: '🪙' },
  { day: 5, label: 'Coin Magnet', icon: '🧲' },
  { day: 6, label: 'Heart Boost', icon: '❤️' },
  { day: 7, label: '400 Coins', icon: '🪙' },
];

export default function DailyRewardsScreen({ onBack }: Props) {
  const { language, t } = useI18n();
  const [canClaim, setCanClaim] = useState(canClaimDailyReward());
  const [currentReward, setCurrentReward] = useState(getCurrentDailyReward());
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Refresh on mount so the card state stays aligned with persistence.
    setCanClaim(canClaimDailyReward());
    setCurrentReward(getCurrentDailyReward());
  }, []);

  const handleClaim = () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    const result = claimDailyReward();

    if (result.success) {
      // Refresh visible reward state after claim.
      setCanClaim(false);
      setCurrentReward(getCurrentDailyReward());
      setMessage(t('rewards.claimedMessage', {
        day: result.day,
        reward: translateDailyRewardCard(result.day, language),
      }));

      // Auto clear message after 3s
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage(result.message === 'Already claimed today' ? t('rewards.alreadyClaimed') : t('rewards.error'));
      setTimeout(() => setMessage(null), 2500);
    }
    setClaiming(false);
  };

  const currentDay = currentReward.day;

  return (
    <div className="screen daily-rewards-screen">
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <h2 className="screen-title">{t('rewards.title')}</h2>
      </div>

      <p className="daily-rewards-subtitle">
        {t('rewards.subtitleFull')}
      </p>

      {message && (
        <div className="daily-reward-message">
          {message}
        </div>
      )}

      <div className="daily-reward-grid">
        {REWARD_CARDS.map((card) => {
          const isToday = card.day === currentDay;
          const isClaimed = !canClaim && card.day <= currentDay; // simple visual for current streak

          return (
            <div
              key={card.day}
              className={
                `daily-reward-card ${isToday ? 'daily-reward-card-active' : ''} ${isClaimed && !isToday ? 'daily-reward-card-claimed' : ''}`
              }
            >
              <div className="daily-reward-day">{t('rewards.dayLabel', { day: card.day })}</div>
              <div className="daily-reward-icon">{card.icon}</div>
              <div className="daily-reward-name">{translateDailyRewardCard(card.day, language)}</div>
              {isToday && (
                <div className="daily-reward-status today">{t('rewards.todayReward')}</div>
              )}
              {isClaimed && !isToday && (
                <div className="daily-reward-status claimed">{t('rewards.claimed')}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="daily-reward-actions">
        <button
          className="daily-reward-claim-btn"
          onClick={handleClaim}
          disabled={!canClaim || claiming}
        >
          {claiming
            ? t('rewards.claiming')
            : canClaim
              ? t('rewards.claimReward')
              : t('rewards.claimedToday')}
        </button>

        <button className="btn btn-secondary" onClick={onBack}>
          {t('rewards.backToMenu')}
        </button>
      </div>

      <p className="daily-rewards-note">
        {t('rewards.note')}
      </p>
    </div>
  );
}
