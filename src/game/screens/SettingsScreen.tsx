import { useState } from 'react';
import { SKINS } from '../constants';
import {
  getPersonalBest,
  getSelectedSkin,
  getSettings,
  refreshUnlockedSkins,
  resetPersonalBest,
  setSelectedSkin,
  setSettings,
} from '../storage';
import type { Settings, SkinId } from '../types';

interface Props {
  onBack: () => void;
}

function SkinPreview({ skinId }: { skinId: SkinId }) {
  const skin = SKINS.find((item) => item.id === skinId) ?? SKINS[0];
  const map: Record<SkinId, string> = {
    golden: '/fish-skins/butterfly-gold.png',
    ruby: '/fish-skins/coral-clown.png',
    emerald: '/fish-skins/emerald-parrotfish.png',
    diamond: '/fish-skins/mandarin-jewel.png',
    legendary: '/fish-skins/moorish-legend.png',
  };

  return (
    <div
      className="skin-fish-preview"
      style={{
        position: 'relative',
        width: 92,
        height: 66,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: `drop-shadow(0 0 14px ${skin.colors.glow})`,
      }}
      aria-hidden="true"
    >
      <img
        src={map[skinId]}
        alt={skin.name}
        style={{ 
          width: '82px', 
          height: 'auto', 
          maxHeight: '58px',
          objectFit: 'contain' 
        }}
      />
    </div>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const [settings, setLocalSettings] = useState<Settings>(() => getSettings());
  const best = getPersonalBest();

  const [unlocked, setUnlocked] = useState<SkinId[]>(() => refreshUnlockedSkins(best));
  const [selected, setSelected] = useState<SkinId>(() => getSelectedSkin());
  const [confirmReset, setConfirmReset] = useState(false);

  function toggle(key: keyof Settings) {
    const next = { ...settings, [key]: !settings[key] };
    setLocalSettings(next);
    setSettings(next);
  }

  function pickSkin(id: SkinId) {
    if (!unlocked.includes(id)) return;
    setSelected(id);
    setSelectedSkin(id);
  }

  function handleReset() {
    resetPersonalBest();
    const resetUnlocked = refreshUnlockedSkins(0);
    setUnlocked(resetUnlocked);
    setSelected('golden');
    setSelectedSkin('golden');
    setConfirmReset(false);
  }

  return (
    <div className="screen settings-screen">
      <h2 className="screen-title">Settings</h2>

      <div className="settings-group">
        <label className="settings-row">
          <span>Sound</span>
          <input type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} />
        </label>

        <label className="settings-row">
          <span>Music</span>
          <input type="checkbox" checked={settings.music} onChange={() => toggle('music')} />
        </label>

        <label className="settings-row">
          <span>Vibration</span>
          <input type="checkbox" checked={settings.vibration} onChange={() => toggle('vibration')} />
        </label>
      </div>

      <h3 className="settings-subtitle">Fish Rewards</h3>

      <div className="skin-grid">
        {SKINS.map((skin) => {
          const isUnlocked = unlocked.includes(skin.id) || best >= skin.unlockScore;
          const isSelected = selected === skin.id;
          const progressText =
            skin.unlockScore === 0
              ? 'Starter fish'
              : isUnlocked
                ? 'Unlocked'
                : `Score ${skin.unlockScore}`;

          return (
            <button
              key={skin.id}
              className={`skin-card ${isSelected ? 'skin-card-selected' : ''} ${!isUnlocked ? 'skin-card-locked' : ''}`}
              onClick={() => pickSkin(skin.id)}
              disabled={!isUnlocked}
            >
              <SkinPreview skinId={skin.id} />

              <span>{skin.name}</span>

              {!isUnlocked && <span className="skin-lock-req">{progressText}</span>}

              {isUnlocked && !isSelected && (
                <span className="skin-lock-req">Tap to equip</span>
              )}

              {isSelected && (
                <span className="skin-lock-req">Equipped</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="settings-group">
        {!confirmReset ? (
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Reset Personal Best
          </button>
        ) : (
          <div className="confirm-row">
            <span>Are you sure? This cannot be undone.</span>

            <button className="btn btn-danger" onClick={handleReset}>
              Confirm Reset
            </button>

            <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <p className="privacy-note">This demo stores your game progress locally on your device.</p>

      <button className="btn btn-primary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
