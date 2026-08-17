import { useState } from 'react';
import { SKINS } from '../constants';
import { getSelectedSkin, setSelectedSkin } from '../storage';
import type { SkinId } from '../types';
import { translateSkin, useI18n } from '../i18n';
import { PLAYER_FISH_PREVIEW_PATHS } from '../fishAssets';

function FishIcon({ skinId }: { skinId: SkinId }) {
  const skin = SKINS.find((candidate) => candidate.id === skinId) ?? SKINS[0];

  return (
    <img
      className="unlock-fish-preview-art"
      src={PLAYER_FISH_PREVIEW_PATHS[skinId]}
      alt=""
      style={{ filter: `drop-shadow(0 0 16px ${skin.colors.glow})` }}
    />
  );
}

interface Props {
  unlockedIds: SkinId[];
  onContinue: () => void;
}

export default function UnlockCelebration({ unlockedIds, onContinue }: Props) {
  const { language, t } = useI18n();
  const skins = unlockedIds
    .map((id) => SKINS.find((s) => s.id === id))
    .filter(Boolean) as typeof SKINS;

  const [equippedSkin, setEquippedSkin] = useState<SkinId>(() => getSelectedSkin());

  function handleEquip(skinId: SkinId) {
    setSelectedSkin(skinId);
    setEquippedSkin(skinId);
  }

  return (
    <div className="screen unlock-screen">
      <div className="unlock-sparkles" aria-hidden="true">✨</div>

      <h2 className="screen-title unlock-title">{t('unlock.congratulations')}</h2>

      <p className="unlock-subtitle">
        {skins.length === 1
          ? t('unlock.oneFish')
          : t('unlock.manyFish', { count: skins.length })}
      </p>

      <div className="unlock-fish-list">
        {skins.map((skin) => {
          const isEquipped = equippedSkin === skin.id;

          return (
            <div key={skin.id} className="unlock-fish-card">
              <FishIcon skinId={skin.id} />

              <span className="unlock-fish-name">{translateSkin(skin.id, 'name', language)}</span>

              <div style={{ fontSize: '12px', color: '#ffd54f', margin: '4px 0', fontWeight: 'bold', lineHeight: '1.2' }}>
                {translateSkin(skin.id, 'ability', language)}
              </div>

              <span className="unlock-fish-score">{t('unlock.score', { score: skin.unlockScore })}</span>

              <button
                className={`btn ${isEquipped ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleEquip(skin.id)}
                disabled={isEquipped}
              >
                {isEquipped ? t('gameover.equipped') : t('unlock.equipNow')}
              </button>
            </div>
          );
        })}
      </div>

      <p className="unlock-hint">
        {skins.some((skin) => equippedSkin === skin.id)
          ? t('unlock.ready')
          : t('unlock.chooseLater')}
      </p>

      <button className="btn btn-primary" onClick={onContinue}>
        {t('unlock.awesome')}
      </button>
    </div>
  );
}
