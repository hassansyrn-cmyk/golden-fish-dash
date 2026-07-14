import { useState } from 'react';
import { SKINS } from '../constants';
import { getSelectedSkin, setSelectedSkin } from '../storage';
import type { SkinId } from '../types';

function FishIcon({ skinId }: { skinId: SkinId }) {
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
  const { body, belly, fin, glow } = skin.colors;

  if (skinId === 'golden') {
    return (
      <svg viewBox="0 0 72 48" width="110" height="74" style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${glow})` }}>
        <ellipse cx="38" cy="24" rx="26" ry="16" fill={glow} opacity="0.2" />
        <path d="M8 24 C4 12 2 8 10 10 C6 18 6 24 6 24 C6 24 6 30 10 38 C2 40 4 36 8 24 Z" fill={fin} />
        <path d="M14 24 C14 12 24 6 38 7 C52 8 62 14 64 24 C62 34 52 40 38 41 C24 42 14 36 14 24 Z" fill={body} />
        <path d="M22 28 C26 34 42 36 54 30 C50 34 36 36 26 32 Z" fill={belly} opacity="0.85" />
        <path d="M30 10 C34 2 46 2 50 11 C44 8 36 8 30 10 Z" fill={fin} />
        <circle cx="56" cy="20" r="3.6" fill="#1a1200" />
        <circle cx="57.2" cy="18.8" r="1.3" fill="#fff" />
      </svg>
    );
  }

  if (skinId === 'ruby') {
    return (
      <svg viewBox="0 0 76 50" width="110" height="74" style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${glow})` }}>
        <ellipse cx="40" cy="25" rx="28" ry="18" fill={glow} opacity="0.22" />
        <path d="M12 25 C-2 4 0 2 16 8 C6 16 8 25 8 25 C8 25 6 34 16 42 C0 48 -2 46 12 25 Z" fill={fin} />
        <path d="M18 25 C18 14 28 8 42 9 C54 10 64 16 66 25 C64 34 54 40 42 41 C28 42 18 36 18 25 Z" fill={body} />
        <path d="M28 12 C36 -4 54 -2 58 14 C50 6 38 6 28 12 Z" fill={fin} />
        <circle cx="58" cy="21" r="3.5" fill="#1a0505" />
        <circle cx="59.2" cy="19.8" r="1.2" fill="#fff" />
      </svg>
    );
  }

  if (skinId === 'emerald') {
    return (
      <svg viewBox="0 0 72 48" width="110" height="74" style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${glow})` }}>
        <ellipse cx="38" cy="24" rx="26" ry="16" fill={glow} opacity="0.22" />
        <path d="M10 24 C4 12 2 10 12 12 C6 18 6 24 6 24 C6 24 6 30 12 36 C2 38 4 36 10 24 Z" fill="#00b4d8" />
        <path d="M14 24 C14 13 24 7 38 8 C52 9 62 15 64 24 C62 33 52 39 38 40 C24 41 14 35 14 24 Z" fill={body} />
        <path d="M22 14 C28 18 34 16 40 14 C36 20 28 22 22 18 Z" fill="#ff9f1c" opacity="0.85" />
        <circle cx="56" cy="20" r="3.4" fill="#002820" />
        <circle cx="57.1" cy="18.9" r="1.15" fill="#fff" />
      </svg>
    );
  }

  if (skinId === 'diamond') {
    return (
      <svg viewBox="0 0 72 50" width="110" height="74" style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${glow})` }}>
        <ellipse cx="38" cy="25" rx="28" ry="20" fill={glow} opacity="0.28" />
        <path d="M10 25 C4 14 2 12 12 14 C6 20 6 25 6 25 C6 25 6 30 12 36 C2 38 4 36 10 25 Z" fill={fin} />
        <path d="M16 25 C16 10 26 2 40 3 C54 4 64 12 66 25 C64 38 54 46 40 47 C26 48 16 40 16 25 Z" fill={body} />
        <circle cx="58" cy="21" r="3.5" fill="#0a1a22" />
        <circle cx="59.2" cy="19.8" r="1.25" fill="#fff" />
        <path d="M26 16 Q40 8 56 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 80 52" width="120" height="78" style={{ overflow: 'visible', filter: `drop-shadow(0 0 18px ${glow})` }}>
      <ellipse cx="42" cy="26" rx="32" ry="22" fill={glow} opacity="0.25" />
      <ellipse cx="42" cy="26" rx="28" ry="19" fill="none" stroke={glow} strokeWidth="2.5" opacity="0.55" />
      <path d="M12 26 C2 10 0 8 14 12 C6 18 6 26 6 26 C6 26 6 34 14 40 C0 44 2 42 12 26 Z" fill="#1a1a1a" />
      <path d="M16 26 C16 12 26 4 42 5 C56 6 66 14 68 26 C66 38 56 46 42 47 C26 48 16 40 16 26 Z" fill="#1a1a1a" />
      <path d="M30 8 C32 26 32 26 30 44 C42 44 44 26 42 8 Z" fill="#ffd60a" />
      <path d="M48 10 C56 12 64 18 66 26 C64 34 56 40 48 42 C52 34 54 18 48 10 Z" fill="#fffbe6" />
      <path d="M28 8 C34 -10 50 -12 58 6 C50 0 40 2 32 8 Z" fill="#ffd60a" />
      <circle cx="60" cy="22" r="3.8" fill="#1a1200" />
      <circle cx="61.3" cy="20.6" r="1.4" fill="#fff" />
    </svg>
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

              <div style={{ fontSize: '12px', color: '#ffd54f', margin: '4px 0', fontWeight: 'bold', lineHeight: '1.2' }}>
                {skin.ability}
              </div>

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
