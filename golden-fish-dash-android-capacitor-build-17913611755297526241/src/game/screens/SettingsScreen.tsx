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

export default function SettingsScreen({ onBack }: Props) {
  const [settings, setLocalSettings] = useState<Settings>(() => getSettings());
  const best = getPersonalBest();
  // Sync any skins newly earned by the player's best score before rendering
  // so the unlock state and button enablement always agree.
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

      <h3 className="settings-subtitle">Fish Skin</h3>
      <div className="skin-grid">
        {SKINS.map((skin) => {
          const isUnlocked = unlocked.includes(skin.id) || best >= skin.unlockScore;
          const isSelected = selected === skin.id;
          return (
            <button
              key={skin.id}
              className={`skin-card ${isSelected ? 'skin-card-selected' : ''} ${!isUnlocked ? 'skin-card-locked' : ''}`}
              onClick={() => pickSkin(skin.id)}
              disabled={!isUnlocked}
            >
              <div className="skin-swatch" style={{ background: skin.colors.body }} />
              <span>{skin.name}</span>
              {!isUnlocked && <span className="skin-lock-req">Score {skin.unlockScore}</span>}
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
            <span>Are you sure? This can't be undone.</span>
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
