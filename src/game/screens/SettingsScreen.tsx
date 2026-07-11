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
  const { body, belly, fin, glow } = skin.colors;

  const wrap = (children: React.ReactNode, w = 58) => (
    <div
      className="skin-fish-preview"
      style={{
        position: 'relative',
        width: w,
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: `drop-shadow(0 0 11px ${glow})`,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );

  if (skinId === 'golden') {
    return wrap(
      <svg viewBox="0 0 72 48" width="58" height="42" style={{ overflow: 'visible' }}>
        <ellipse cx="38" cy="24" rx="26" ry="16" fill={glow} opacity="0.18" />
        <path d="M8 24 C4 12 2 8 10 10 C6 18 6 24 6 24 C6 24 6 30 10 38 C2 40 4 36 8 24 Z" fill={fin} />
        <path d="M10 24 C7 16 9 14 14 16 C11 20 11 24 11 24 C11 24 11 28 14 32 C9 34 7 32 10 24 Z" fill={belly} opacity="0.55" />
        <path d="M14 24 C14 12 24 6 38 7 C52 8 62 14 64 24 C62 34 52 40 38 41 C24 42 14 36 14 24 Z" fill={body} />
        <path d="M22 28 C26 34 42 36 54 30 C50 34 36 36 26 32 Z" fill={belly} opacity="0.85" />
        <path d="M30 10 C34 2 46 2 50 11 C44 8 36 8 30 10 Z" fill={fin} />
        <path d="M46 26 C56 20 60 28 52 30 C50 28 48 27 46 26 Z" fill={fin} opacity="0.9" />
        <circle cx="56" cy="20" r="3.6" fill="#1a1200" />
        <circle cx="57.2" cy="18.8" r="1.3" fill="#fff" />
        <ellipse cx="52" cy="26" rx="3" ry="2" fill="#ff7b00" opacity="0.35" />
        <path d="M28 16 Q40 10 52 16" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (skinId === 'ruby') {
    return wrap(
      <svg viewBox="0 0 76 50" width="60" height="42" style={{ overflow: 'visible' }}>
        <ellipse cx="40" cy="25" rx="28" ry="18" fill={glow} opacity="0.2" />
        <path d="M12 25 C-2 4 0 2 16 8 C6 16 8 25 8 25 C8 25 6 34 16 42 C0 48 -2 46 12 25 Z" fill={fin} />
        <path d="M14 25 C6 12 10 10 20 14 C12 20 12 25 12 25 C12 25 12 30 20 36 C10 40 6 38 14 25 Z" fill="#ff8fa3" opacity="0.45" />
        <path d="M18 25 C18 14 28 8 42 9 C54 10 64 16 66 25 C64 34 54 40 42 41 C28 42 18 36 18 25 Z" fill={body} />
        <path d="M26 29 C32 36 50 36 58 30 C52 34 36 36 28 32 Z" fill={belly} opacity="0.8" />
        <path d="M28 12 C36 -4 54 -2 58 14 C50 6 38 6 28 12 Z" fill={fin} />
        <path d="M30 36 C38 50 54 48 58 34 C50 42 38 42 30 36 Z" fill={fin} opacity="0.92" />
        <path d="M48 27 C62 18 66 30 54 32 C52 30 50 28 48 27 Z" fill={fin} />
        <circle cx="58" cy="21" r="3.5" fill="#1a0505" />
        <circle cx="59.2" cy="19.8" r="1.2" fill="#fff" />
        <circle cx="58" cy="21" r="1.1" fill="#ff6b6b" />
        <path d="M30 16 Q44 9 58 16" stroke="rgba(255,255,255,0.4)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (skinId === 'emerald') {
    return wrap(
      <svg viewBox="0 0 72 48" width="58" height="42" style={{ overflow: 'visible' }}>
        <ellipse cx="38" cy="24" rx="26" ry="16" fill={glow} opacity="0.22" />
        <path d="M10 24 C4 12 2 10 12 12 C6 18 6 24 6 24 C6 24 6 30 12 36 C2 38 4 36 10 24 Z" fill="#00b4d8" />
        <path d="M14 24 C14 13 24 7 38 8 C52 9 62 15 64 24 C62 33 52 39 38 40 C24 41 14 35 14 24 Z" fill={body} />
        <path d="M22 14 C28 18 34 16 40 14 C36 20 28 22 22 18 Z" fill="#ff9f1c" opacity="0.85" />
        <path d="M26 28 C32 34 44 34 52 28 C46 32 34 34 28 30 Z" fill="#ff9f1c" opacity="0.75" />
        <path d="M30 18 C36 12 48 12 54 18 C48 16 38 16 32 20 Z" fill="#48cae4" opacity="0.7" />
        <path d="M24 30 C30 36 46 36 54 30 C48 34 34 36 28 32 Z" fill={belly} opacity="0.7" />
        <path d="M32 10 C38 2 48 2 52 11 C46 7 38 7 32 10 Z" fill="#00b4d8" />
        <path d="M46 25 C58 18 60 30 50 30 C48 28 47 26 46 25 Z" fill="#00b4d8" />
        <circle cx="56" cy="20" r="3.4" fill="#002820" />
        <circle cx="57.1" cy="18.9" r="1.15" fill="#fff" />
        <circle cx="34" cy="22" r="1.8" fill="#ffd166" opacity="0.9" />
        <circle cx="42" cy="18" r="1.4" fill="#ffd166" opacity="0.85" />
        <circle cx="38" cy="28" r="1.5" fill="#90e0ef" opacity="0.8" />
      </svg>
    );
  }

  if (skinId === 'diamond') {
    return wrap(
      <svg viewBox="0 0 72 50" width="58" height="42" style={{ overflow: 'visible' }}>
        <ellipse cx="38" cy="25" rx="28" ry="20" fill={glow} opacity="0.28" />
        <path d="M10 25 C4 14 2 12 12 14 C6 20 6 25 6 25 C6 25 6 30 12 36 C2 38 4 36 10 25 Z" fill={fin} />
        <path d="M16 25 C16 10 26 2 40 3 C54 4 64 12 66 25 C64 38 54 46 40 47 C26 48 16 40 16 25 Z" fill={body} />
        <path d="M28 8 C30 25 30 25 28 42 C32 42 34 25 32 8 Z" fill="rgba(255,255,255,0.18)" />
        <path d="M40 6 C42 25 42 25 40 44 C44 44 46 25 44 6 Z" fill="rgba(255,255,255,0.22)" />
        <path d="M50 10 C52 25 52 25 50 40 C54 40 56 25 54 10 Z" fill="rgba(255,255,255,0.15)" />
        <path d="M24 32 C32 42 52 42 58 30 C50 38 34 40 26 34 Z" fill={belly} opacity="0.75" />
        <path d="M30 6 C38 -4 52 -2 56 10 C48 4 38 2 30 6 Z" fill={fin} />
        <path d="M32 42 C40 52 52 50 56 38 C48 46 38 48 32 42 Z" fill={fin} opacity="0.9" />
        <path d="M48 27 C60 20 62 32 52 32 C50 30 49 28 48 27 Z" fill={fin} />
        <circle cx="58" cy="21" r="3.5" fill="#0a1a22" />
        <circle cx="59.2" cy="19.8" r="1.25" fill="#fff" />
        <path d="M26 16 Q40 8 56 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <circle cx="34" cy="18" r="1.5" fill="#fff" opacity="0.9" />
        <circle cx="44" cy="14" r="1.1" fill="#fff" opacity="0.8" />
      </svg>
    );
  }

  return wrap(
    <svg viewBox="0 0 80 52" width="62" height="44" style={{ overflow: 'visible' }}>
      <ellipse cx="42" cy="26" rx="32" ry="22" fill={glow} opacity="0.22" />
      <ellipse cx="42" cy="26" rx="28" ry="19" fill="none" stroke={glow} strokeWidth="2.5" opacity="0.55" />
      <path d="M12 26 C2 10 0 8 14 12 C6 18 6 26 6 26 C6 26 6 34 14 40 C0 44 2 42 12 26 Z" fill="#1a1a1a" />
      <path d="M14 26 C8 16 10 14 18 16 C12 20 12 26 12 26 C12 26 12 32 18 36 C10 38 8 36 14 26 Z" fill="#fffbe6" opacity="0.7" />
      <path d="M16 26 C16 12 26 4 42 5 C56 6 66 14 68 26 C66 38 56 46 42 47 C26 48 16 40 16 26 Z" fill="#1a1a1a" />
      <path d="M30 8 C32 26 32 26 30 44 C42 44 44 26 42 8 Z" fill="#ffd60a" />
      <path d="M48 10 C56 12 64 18 66 26 C64 34 56 40 48 42 C52 34 54 18 48 10 Z" fill="#fffbe6" />
      <path d="M52 14 C54 26 54 26 52 38 C56 38 58 26 56 14 Z" fill="#1a1a1a" opacity="0.9" />
      <path d="M28 8 C34 -10 50 -12 58 6 C50 0 40 2 32 8 Z" fill="#ffd60a" />
      <path d="M30 7 C36 -6 48 -8 54 6 C48 2 38 2 32 7 Z" fill="#fffbe6" opacity="0.5" />
      <path d="M32 42 C40 54 52 52 56 40 C48 48 38 50 32 42 Z" fill="#1a1a1a" />
      <path d="M50 28 C64 20 66 34 54 34 C52 32 51 30 50 28 Z" fill="#ffd60a" />
      <circle cx="60" cy="22" r="3.8" fill="#1a1200" />
      <circle cx="61.3" cy="20.6" r="1.4" fill="#fff" />
      <circle cx="24" cy="16" r="1.6" fill="#fffbe6" opacity="0.9" />
      <circle cx="36" cy="10" r="1.3" fill="#fffbe6" opacity="0.85" />
      <circle cx="48" cy="8" r="1.1" fill="#fffbe6" opacity="0.8" />
      <path d="M28 18 Q42 10 58 18" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>,
    62
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

  const openPrivacyPolicy = () => {
    // Works on both web and Capacitor Android
    window.open('/privacy.html', '_blank');
  };

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

      <div className="mt-4 flex flex-col gap-3">
        <p className="privacy-note">This demo stores your game progress locally on your device.</p>
        
        <button 
          onClick={openPrivacyPolicy}
          className="btn btn-secondary text-sm py-2"
        >
          Privacy Policy
        </button>
      </div>

      <button className="btn btn-primary mt-4" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
