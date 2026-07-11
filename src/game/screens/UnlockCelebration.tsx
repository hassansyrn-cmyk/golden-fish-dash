import { useState } from 'react';
import { SKINS } from '../constants';
import { getSelectedSkin, setSelectedSkin } from '../storage';
import type { SkinId } from '../types';

function FishIcon({ skinId }: { skinId: SkinId }) {
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
  const map: Record<SkinId, string> = {
    golden: '/fish-skins/butterfly-gold.png',
    ruby: '/fish-skins/coral-clown.png',
    emerald: '/fish-skins/emerald-parrotfish.png',
    diamond: '/fish-skins/mandarin-jewel.png',
    legendary: '/fish-skins/moorish-legend.png',
  };

  return (
    <div style={{ filter: `drop-shadow(0 0 18px ${skin.colors.glow})` }}>
      <img
        src={map[skinId]}
        alt={skin.name}
        width={120}
        height={85}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}

interface Props {
  unlockedIds: SkinId[];
  onContinue: () => void;
}

export default function UnlockCelebration({ unlockedIds, onContinue }: Props) {
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

      <h2 className="screen-title unlock-title">Congratulations!</h2>

      <p className="unlock-subtitle">
        {skins.length === 1
          ? 'You unlocked a new fish!'
          : `You unlocked ${skins.length} new fish!`}
      </p>

      <div className="unlock-fish-list">
        {skins.map((skin) => {
          const isEquipped = equippedSkin === skin.id;

          return (
            <div key={skin.id} className="unlock-fish-card">
              <FishIcon skinId={skin.id} />

              <span className="unlock-fish-name">{skin.name}</span>

              <span className="unlock-fish-score">Score {skin.unlockScore}+</span>

              <button
                className={`btn ${isEquipped ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleEquip(skin.id)}
                disabled={isEquipped}
              >
                {isEquipped ? 'Equipped' : 'Equip Now'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="unlock-hint">
        {skins.some((skin) => equippedSkin === skin.id)
          ? 'Your selected fish is ready for the next run!'
          : 'Equip your new fish now or choose it later from Settings.'}
      </p>

      <button className="btn btn-primary" onClick={onContinue}>
        Awesome!
      </button>
    </div>
  );
}
