import { useState, useEffect } from 'react';
import {
  canClaimDailyReward,
  claimDailyReward,
  getCurrentDailyReward,
  getDailyRewardState,
} from '../storage';
import type { DailyRewardState } from '../types';

interface Props {
  onBack: () => void;
}

// 7-day reward cycle data (matches storage)
const REWARD_CARDS = [
  { day: 1, label: '10 Coins', icon: '🪙' },
  { day: 2, label: '15 Coins', icon: '🪙' },
  { day: 3, label: 'Shield', icon: '🛡️' },
  { day: 4, label: '25 Coins', icon: '🪙' },
  { day: 5, label: 'Coin Magnet', icon: '🧲' },
  { day: 6, label: 'Gem Boost', icon: '💎' },
  { day: 7, label: 'Continue Token', icon: '🔄' },
];

export default function DailyRewardsScreen({ onBack }: Props) {
  const [state, setState] = useState<DailyRewardState>(getDailyRewardState());
  const [canClaim, setCanClaim] = useState(canClaimDailyReward());
  const [currentReward, setCurrentReward] = useState(getCurrentDailyReward());
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Refresh on mount
    const freshState = getDailyRewardState();
    setState(freshState);
    setCanClaim(canClaimDailyReward());
    setCurrentReward(getCurrentDailyReward());
  }, []);

  const handleClaim = () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    const result = claimDailyReward();

    if (result.success) {
      // Refresh all state after claim
      const newState = getDailyRewardState();
      setState(newState);
      setCanClaim(false);
      setCurrentReward(getCurrentDailyReward());
      setMessage(result.message);

      // Auto clear message after 3s
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage(result.message || 'Could not claim reward');
      setTimeout(() => setMessage(null), 2500);
    }
    setClaiming(false);
  };

  const currentDay = currentReward.day;

  return (
    <div className="screen daily-rewards-screen">
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Daily Rewards</h2>
      </div>

      <p className="daily-rewards-subtitle">
        Claim your daily reward! Streak resets if you miss a day.
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
              <div className="daily-reward-day">Day {card.day}</div>
              <div className="daily-reward-icon">{card.icon}</div>
              <div className="daily-reward-name">{card.label}</div>
              {isToday && (
                <div className="daily-reward-status today">Today's Reward</div>
              )}
              {isClaimed && !isToday && (
                <div className="daily-reward-status claimed">Claimed</div>
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
            ? 'Claiming...'
            : canClaim
              ? 'Claim Reward'
              : 'Claimed Today'}
        </button>

        <button className="btn btn-secondary" onClick={onBack}>
          Back to Menu
        </button>
      </div>

      <p className="daily-rewards-note">
        Rewards are added to your coins or inventory immediately.
      </p>
    </div>
  );
}
