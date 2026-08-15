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
import { useI18n } from '../i18n';
import type { SkinId } from '../types';

interface Props {
  finalScore: number;
  roundCoins?: number;
  canContinue: boolean;
  onWatchAd: () => void;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
  onNewUnlocks?: (ids: SkinId[]) => void;
  onShop?: () => void;
}

function encouragement(
  finalScore: number,
  best: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (finalScore >= best && finalScore > 0) return t('gameover.encourageBest');

  if (best - finalScore <= 3 && best - finalScore > 0) {
    return t('gameover.encourageClose', { points: best - finalScore });
  }

  const nextSkin = SKINS.find((skin) => skin.unlockScore > finalScore);

  if (nextSkin) {
    return t('gameover.encourageUnlock', { points: nextSkin.unlockScore - finalScore, fish: nextSkin.name });
  }

  return t('gameover.encourageRetry');
}

function getSkinById(id: SkinId) {
  return SKINS.find((skin) => skin.id === id);
}

export default function GameOverScreen({
  finalScore,
  roundCoins = 0,
  canContinue,
  onWatchAd,
  onPlayAgain,
  onLeaderboard,
  onMenu,
  onNewUnlocks,
}: Props) {
  const { t } = useI18n();
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
  const [doubleMsg, setDoubleMsg] = useState<string | null>(null);

  useEffect(() => {
    setLevel(getLevel());
    setXp(getXP());
  }, []);

  const handleDoubleRewards = () => {
    setDoubleMsg(t('gameover.doubleInfo'));
  };

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
      setSubmitError(t('gameover.saveFailed'));
      setIsSubmitting(false);
    }
  }

  function handleEquipSkin(id: SkinId) {
    setSelectedSkin(id);
    setSelectedSkinState(id);
  }

  return (
    <div className="screen gameover-screen">
      <h2 className="screen-title gameover-title">{t('gameover.title')}</h2>

      <div className="gameover-stats">
        <div>
          <span className="stat-label">{t('gameover.finalScore')}</span>
          <span className="stat-value stat-value-lg">{finalScore}</span>
        </div>

        <div>
          <span className="stat-label">{t('gameover.personalBest')}</span>
          <span className="stat-value">{best}</span>
        </div>

        <div>
          <span className="stat-label">{t('gameover.globalRank')}</span>
          <span className="stat-value">#{rank}</span>
        </div>
      </div>

      {/* Game Over Player Level Progress */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '14px auto', padding: '12px', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
          <span>{t('gameover.levelProgress', { level })}</span>
          <span style={{ fontSize: '11px', color: '#ffd54f' }}>{xp} / {xpNeeded} XP</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${xpPercent}%`, height: '100%', backgroundColor: '#ffd54f', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#b0bec5', margin: '6px 0 0 0', textAlign: 'center' }}>
          {t('gameover.xpInfo')}
        </p>
      </div>

      {doubleMsg && (
        <div style={{ margin: '10px 0', padding: '10px', background: 'rgba(76,175,80,0.25)', border: '1px solid #4caf50', borderRadius: '8px', fontSize: '13px', color: '#81c784', fontWeight: 'bold', textAlign: 'center' }}>
          {doubleMsg}
        </div>
      )}

      <p className="gameover-encourage">{encouragement(finalScore, prevBest, t)}</p>

      {newlyUnlocked.length > 0 && (
        <div className="name-entry-card">
          <p className="gameover-encourage">{t('gameover.newFish')}</p>

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

                  <div style={{ fontSize: '11px', color: '#ffd54f', margin: '4px 0', fontWeight: '500', lineHeight: '1.2' }}>
                    {skin.ability}
                  </div>

                  <span className="skin-lock-req">
                    {isEquipped ? t('gameover.equipped') : t('gameover.equipNow')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {qualifies && !submitted && (
        <div className="name-entry-card">
          <p>{t('gameover.leaderboardEntry')}</p>

          <div className="name-entry-row">
            <input
              className="name-input"
              maxLength={16}
              placeholder={t('gameover.yourName')}
              value={name}
              disabled={isSubmitting}
              onChange={(event) => setName(event.target.value)}
            />

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? t('gameover.saving') : t('gameover.save')}
            </button>
          </div>

          {submitError && <p className="name-saved-note">{submitError}</p>}
        </div>
      )}

      {submitted && <p className="name-saved-note">{t('gameover.scoreSaved')}</p>}

      <div className="gameover-buttons">
        {canContinue && (
          <button className="btn btn-ad" onClick={onWatchAd}>
            {t('gameover.continueSoon')}
          </button>
        )}

        {(roundCoins > 0 || finalScore > 0) && (
          <button
            className="btn btn-ad"
            onClick={handleDoubleRewards}
            style={{ background: 'linear-gradient(135deg, #fb8500, #ffb703)', border: 'none', color: '#000814' }}
          >
            {t('gameover.doubleSoon')}
          </button>
        )}

        <button className="btn btn-primary" onClick={onPlayAgain}>
          {t('gameover.playAgain')}
        </button>

        <button className="btn btn-secondary" onClick={onLeaderboard}>
          {t('menu.leaderboard')}
        </button>

        <button className="btn btn-secondary" onClick={onMenu}>
          {t('gameover.menu')}
        </button>
      </div>
    </div>
  );
}
