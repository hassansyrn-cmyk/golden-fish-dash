import { useEffect, useState } from 'react';
import { getDailyChallenge, getGlobalBestScore, getPersonalBest, getCoins, canClaimDailyReward } from '../storage';
import { dateKey } from '../constants';
import { translateDailyChallenge, useI18n } from '../i18n';
import { PLAYER_FISH_SPRITE_SHEET_PATHS } from '../fishAssets';
import AnimatedFishPreview from '../components/AnimatedFishPreview';

interface Props {
  onPlay: () => void;
  onLeaderboard: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onShop: () => void;
  onDailyRewards: () => void;
  onLuckySpin: () => void;
  onBossPreview: (milestone: number) => void;
}

/**
 * Premium Golden Fish art from the same Sprite Sheet used during gameplay.
 */
function MenuFish() {
  return (
    <div className="menu-fish-decor menu-fish-decor-art" aria-hidden="true">
      <AnimatedFishPreview
        className="menu-fish-sprite"
        src={PLAYER_FISH_SPRITE_SHEET_PATHS.golden}
        width={138}
        height={104}
        fps={7}
      />
    </div>
  );
}

import { getLevel, getXP } from '../storage';

export default function MainMenu({
  onPlay,
  onLeaderboard,
  onHowTo,
  onSettings,
  onShop,
  onDailyRewards,
  onLuckySpin,
  onBossPreview,
}: Props) {
  const { language, setLanguage, t } = useI18n();
  const [best, setBest] = useState(0);
  const [globalBest, setGlobalBest] = useState(0);
  const [daily, setDaily] = useState(getDailyChallenge());
  const [coins, setCoins] = useState(getCoins());
  const [dailyRewardAvailable, setDailyRewardAvailable] = useState(canClaimDailyReward());
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [spinAvailable, setSpinAvailable] = useState(false);
  const [showBossTest, setShowBossTest] = useState(false);
  const bossTests = [
    { milestone: 100, nameKey: 'engine.bossName.octopus' },
    { milestone: 200, nameKey: 'engine.bossName.manta' },
    { milestone: 300, nameKey: 'engine.bossName.anglerfish' },
    { milestone: 400, nameKey: 'engine.bossName.leviathan' },
    { milestone: 500, nameKey: 'engine.bossName.kraken' },
    { milestone: 600, nameKey: 'engine.bossName.razorback' },
  ] as const;

  useEffect(() => {
    setBest(getPersonalBest());
    setGlobalBest(getGlobalBestScore());
    setDaily(getDailyChallenge());
    setCoins(getCoins());
    setDailyRewardAvailable(canClaimDailyReward());
    setLevel(getLevel());
    setXp(getXP());

    const lastSpin = localStorage.getItem('gfr_last_daily_spin_date') || '';
    const today = dateKey();
    setSpinAvailable(lastSpin !== today);
  }, []);

  const xpNeeded = level * 150;
  const xpPercent = Math.min(100, Math.floor((xp / xpNeeded) * 100));

  return (
    <div className="screen menu-screen">
      <button
        className="menu-language-button"
        type="button"
        onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
        aria-label={t('settings.language')}
        title={t('settings.language')}
      >
        {language === 'en' ? 'ع' : 'EN'}
      </button>
      <MenuFish />
      <h1 className="game-title">
        Golden <span className="game-title-accent">Fish Dash</span>
      </h1>
      <p className="menu-tagline">{t('menu.tagline')}</p>

      {/* Player Progression Level & XP Bar */}
      <div className="menu-level-container" style={{ width: '100%', maxWidth: '280px', margin: '-10px auto 14px auto', padding: '0 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
          <span>{t('common.level')} {level}</span>
          <span style={{ fontSize: '11px', color: '#b0bec5', fontWeight: 'normal' }}>{xp} / {xpNeeded} XP</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${xpPercent}%`, height: '100%', backgroundColor: '#ffd54f', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Clear small coin balance for verification */}
      <div className="menu-coins">
        <span className="coin-icon">🪙</span>
        <span className="coin-value">{coins}</span>
        <span className="coin-label">{t('common.coins')}</span>
      </div>

      <div className="menu-stats">
        <div className="stat-pill">
          <span className="stat-label">{t('menu.personalBest')}</span>
          <span className="stat-value">{best}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">{t('menu.globalBest')}</span>
          <span className="stat-value">{globalBest}</span>
        </div>
      </div>

      <div className="daily-challenge-card">
        <span className="daily-badge">{t('menu.dailyChallenge')}</span>
        <p>{translateDailyChallenge(daily.challenge.id, language)}</p>
        <div className="daily-progress-track">
          <div
            className="daily-progress-fill"
            style={{ width: `${Math.min(100, (daily.progress / daily.challenge.target) * 100)}%` }}
          />
        </div>
        <span className="daily-status">
          {daily.completed
            ? t('menu.completedReward', { coins: daily.challenge.rewardCoins })
            : `${daily.progress}/${daily.challenge.target}`}
        </span>
      </div>

      <div className="menu-buttons">
        <button className="btn btn-primary" onClick={onPlay}>
          {t('menu.play')}
        </button>

        <button className="btn btn-secondary boss-test-menu-btn" onClick={() => setShowBossTest((visible) => !visible)}>
          ⚔️ {t('menu.bossTest')}
        </button>

        {showBossTest && (
          <section className="boss-test-panel" aria-label={t('menu.bossTest')}>
            <div className="boss-test-panel-heading">
              <strong>{t('menu.bossTestTitle')}</strong>
              <span>{t('menu.bossTestHint')}</span>
            </div>
            <div className="boss-test-grid">
              {bossTests.map((boss) => (
                <button
                  key={boss.milestone}
                  className="boss-test-choice"
                  onClick={() => {
                    setShowBossTest(false);
                    onBossPreview(boss.milestone);
                  }}
                >
                  <span>{boss.milestone}</span>
                  <small>{t(boss.nameKey)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Daily Rewards button - noticeable when available */}
        <button
          className={`btn ${dailyRewardAvailable ? 'btn-primary daily-reward-btn' : 'btn-secondary'}`}
          onClick={onDailyRewards}
        >
          {dailyRewardAvailable ? t('menu.dailyRewardReady') : t('menu.dailyRewards')}
        </button>

        {/* Lucky Spin button */}
        <button
          className={`btn ${spinAvailable ? 'btn-primary daily-reward-btn' : 'btn-secondary'}`}
          onClick={onLuckySpin}
          style={{ animation: spinAvailable ? 'pulse 1.5s infinite' : 'none' }}
        >
          {spinAvailable ? t('menu.luckySpinReady') : t('menu.luckySpin')}
        </button>

        <button className="btn btn-secondary" onClick={onLeaderboard}>
          {t('menu.leaderboard')}
        </button>
        <button className="btn btn-secondary" onClick={onHowTo}>
          {t('menu.howToPlay')}
        </button>
        <button className="btn btn-secondary" onClick={onSettings}>
          {t('menu.settings')}
        </button>
        <button className="btn btn-secondary" onClick={onShop}>
          {t('menu.shop')}
        </button>
      </div>
    </div>
  );
}
