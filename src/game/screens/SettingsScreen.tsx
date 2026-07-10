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

  const isRuby = skin.id === 'ruby';
  const isEmerald = skin.id === 'emerald';
  const isDiamond = skin.id === 'diamond';
  const isLegendary = skin.id === 'legendary';

  const bodyScale = isDiamond ? 1.04 : isLegendary ? 1.08 : 1;
  const tailScale = isRuby ? 1.08 : isLegendary ? 1.14 : 1;
  const finOffset = isEmerald ? -2 : isLegendary ? -3 : 0;
  const glowSize = isLegendary ? 18 : isDiamond ? 15 : 11;

  return (
    <div
      className="skin-fish-preview"
      style={{
        position: 'relative',
        width: 58,
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: `drop-shadow(0 0 ${glowSize}px ${skin.colors.glow})`,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          left: 4,
          width: 0,
          height: 0,
          borderTop: `${10 * tailScale}px solid transparent`,
          borderBottom: `${10 * tailScale}px solid transparent`,
          borderRight: `${18 * tailScale}px solid ${skin.colors.fin}`,
          transform: isLegendary ? 'rotate(4deg)' : 'rotate(0deg)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 38 * bodyScale,
          height: 26 * bodyScale,
          left: 18,
          borderRadius: '52% 48% 48% 52%',
          background: `linear-gradient(135deg, ${skin.colors.body}, ${skin.colors.fin})`,
          boxShadow: `inset 0 -5px 0 ${skin.colors.belly}, 0 0 ${glowSize}px ${skin.colors.glow}`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 34,
          top: 4 + finOffset,
          width: 14,
          height: 12,
          background: skin.colors.fin,
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 75%)',
          opacity: 0.95,
          transform: isLegendary ? 'rotate(8deg)' : 'rotate(0deg)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 46,
          top: 15,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#111',
          boxShadow: '1px -1px 0 #fff',
        }}
      />

      {isDiamond && (
        <div
          style={{
            position: 'absolute',
            left: 25,
            top: 13,
            width: 18,
            height: 7,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.45)',
            transform: 'rotate(-12deg)',
          }}
        />
      )}

      {isLegendary && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.35)',
            boxShadow: `0 0 18px ${skin.colors.glow}`,
            opacity: 0.85,
          }}
        />
      )}
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
