import { useEffect, useState } from 'react';
import {
  estimateGlobalRank,
  getPersonalBest,
  getSelectedSkin,
  getUnlockedSkins,
  qualifiesForLeaderboard,
  refreshUnlockedSkins,
  setPersonalBest,
  setSelectedSkin,
  submitScoreToServer,
  getLevel,
  getXP,
} from '../storage';
import { SKINS } from '../constants';
import type { SkinId } from '../types';

interface Props {
  finalScore: number;
  canContinue: boolean;
  onWatchAd: () => void;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
  onNewUnlocks?: (ids: SkinId[]) => void;
}

function encouragement(finalScore: number, best: number): string {
  if (finalScore >= best && finalScore > 0) return 'New personal best! You are unstoppable.';

  if (best - finalScore <= 3 && best - finalScore > 0) {
    return `You were close to your best! Only ${best - finalScore} points away.`;
  }

  const nextSkin = SKINS.find((skin) => skin.unlockScore > finalScore);

  if (nextSkin) {
    return `Only ${nextSkin.unlockScore - finalScore} points away from unlocking the ${nextSkin.name}!`;
  }

  return 'Try again to climb the leaderboard!';
}

function getSkinById(id: SkinId) {
  return SKINS.find((skin) => skin.id === id);
}

export default function GameOverScreen({
  finalScore,
  canContinue,
  onWatchAd,
  onPlayAgain,
  onLeaderboard,
  onMenu,
  onNewUnlocks,
}: Props) {
  const prevBest = getPersonalBest();
  const best = Math.max(prevBest, finalScore);
  const rank = estimateGlobalRank(finalScore);
  const qualifies = qualifiesForLeaderboard(finalScore);

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [name, setName] = useState('');
  const [newlyUnlocked, setNewlyUnlocked] = useState<SkinId[]>([]);
  const [selectedSkin, setSelectedSkinState] = useState<SkinId>(() => getSelectedSkin());

  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    setLevel(getLevel());
    setXp(getXP());
  }, []);

  const xpNeeded = level * 150;
  const xpPercent = Math.min(100, Math.floor((xp / xpNeeded) * 100));

  useEffect(() => {
    const before = new Set(getUnlockedSkins());

    if (finalScore > prevBest) {
      setPersonalBest(finalScore);
    }

    const after = refreshUnlockedSkins(best);
    const newly = after.filter((id) => !before.has(id));

    if (newly.length > 0) {
      setNewlyUnlocked(newly);

      if (onNewUnlocks) {
        onNewUnlocks(newly);
      }
    }
  }, [best, finalScore, onNewUnlocks, prevBest]);

  async function handleSubmit() {
    if (isSubmitting || submitted) return;

    const trimmed = name.trim();

    if (!trimmed) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await submitScoreToServer(trimmed, finalScore);
      setSubmitted(true);
    } catch {
      setSubmitError('Could not save score. Please try again.');
      setIsSubmitting(false);
    }
  }

  function handleEquipSkin(id: SkinId) {
    setSelectedSkin(id);
    setSelectedSkinState(id);
  }

  return (
    <div className="screen gameover-screen">
      <h2 className="screen-title gameover-title">Game Over</h2>

      <div className="gameover-stats">
        <div>
          <span className="stat-label">Final Score</span>
          <span className="stat-value stat-value-lg">{finalScore}</span>
        </div>

        <div>
          <span className="stat-label">Personal Best</span>
          <span className="stat-value">{best}</span>
        </div>

        <div>
          <span className="stat-label">Global Rank (est.)</span>
          <span className="stat-value">#{rank}</span>
        </div>
      </div>

      {/* Game Over Player Level Progress */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '14px auto', padding: '12px', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
          <span>Level {level} Progression</span>
          <span style={{ fontSize: '11px', color: '#ffd54f' }}>{xp} / {xpNeeded} XP</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${xpPercent}%`, height: '100%', backgroundColor: '#ffd54f', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#b0bec5', margin: '6px 0 0 0', textAlign: 'center' }}>
          Final score and coin counts converted into extra level XP!
        </p>
      </div>

      <p className="gameover-encourage">{encouragement(finalScore, prevBest)}</p>

      {newlyUnlocked.length > 0 && (
        <div className="name-entry-card">
          <p className="gameover-encourage">New Fish Unlocked!</p>

          <div className="skin-grid">
            {newlyUnlocked.map((id) => {
              const skin = getSkinById(id);

              if (!skin) return null;

              const isEquipped = selectedSkin === id;

              return (
                <button
                  key={id}
                  className={`skin-card ${isEquipped ? 'skin-card-selected' : ''}`}
                  onClick={() => handleEquipSkin(id)}
                >
                  <div
                    className="skin-swatch"
                    style={{
                      background: skin.colors.body,
                      boxShadow: `0 0 14px ${skin.colors.glow}, 0 0 10px rgba(0, 0, 0, 0.3) inset`,
                    }}
                  />

                  <span>{skin.name}</span>

                  <span className="skin-lock-req">
                    {isEquipped ? 'Equipped' : 'Equip Now'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {qualifies && !submitted && (
        <div className="name-entry-card">
          <p>You made the leaderboard! Enter a name:</p>

          <div className="name-entry-row">
            <input
              className="name-input"
              maxLength={16}
              placeholder="Your name"
              value={name}
              disabled={isSubmitting}
              onChange={(event) => setName(event.target.value)}
            />

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>

          {submitError && <p className="name-saved-note">{submitError}</p>}
        </div>
      )}

      {submitted && <p className="name-saved-note">Score saved to the leaderboard!</p>}

      <div className="gameover-buttons">
        {canContinue && (
          <button className="btn btn-ad" onClick={onWatchAd}>
            Watch Ad to Continue
          </button>
        )}

        <button className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>

        <button className="btn btn-secondary" onClick={onLeaderboard}>
          Leaderboard
        </button>

        <button className="btn btn-secondary" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
