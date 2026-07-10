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

  // Distinct SVG fish designs per skin — clear visual identity even at small size
  if (skinId === 'golden') {
    // Cute simple starter fish — round body, soft fins
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
          filter: `drop-shadow(0 0 10px ${glow})`,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 42" width="58" height="42" style={{ overflow: 'visible' }}>
          {/* soft glow circle */}
          <circle cx="34" cy="21" r="18" fill={glow} opacity="0.18" />
          {/* tail */}
          <path d="M4 21 L16 10 L16 32 Z" fill={fin} />
          {/* body */}
          <ellipse cx="34" cy="21" rx="18" ry="13" fill={body} />
          {/* belly highlight */}
          <ellipse cx="36" cy="24" rx="11" ry="7" fill={belly} opacity="0.85" />
          {/* dorsal fin */}
          <path d="M28 9 Q34 2 40 9" fill={fin} />
          {/* pectoral fin */}
          <path d="M38 24 Q46 20 48 28 Q42 27 38 24" fill={fin} opacity="0.9" />
          {/* eye */}
          <circle cx="44" cy="18" r="3.2" fill="#1a1200" />
          <circle cx="45" cy="17" r="1.1" fill="#fff" />
          {/* smile */}
          <path d="M46 23 Q49 26 52 23" stroke="#1a1200" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (skinId === 'ruby') {
    // Sharper, more aggressive, larger angular fins, ruby shine
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
          filter: `drop-shadow(0 0 12px ${glow})`,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 42" width="58" height="42" style={{ overflow: 'visible' }}>
          <circle cx="34" cy="21" r="19" fill={glow} opacity="0.22" />
          {/* sharp tail */}
          <path d="M2 21 L17 6 L14 21 L17 36 Z" fill={fin} />
          {/* angular body */}
          <path
            d="M16 21 Q20 7 36 8 Q50 10 54 21 Q50 32 36 34 Q20 35 16 21 Z"
            fill={body}
          />
          {/* belly */}
          <path d="M22 24 Q34 30 48 24 Q42 28 34 28 Q26 28 22 24 Z" fill={belly} opacity="0.8" />
          {/* large dorsal fin */}
          <path d="M26 9 L34 0 L42 9 L38 11 L30 11 Z" fill={fin} />
          {/* lower fin sharp */}
          <path d="M30 33 L36 41 L42 33 L38 31 L34 31 Z" fill={fin} />
          {/* side fin */}
          <path d="M40 24 L52 18 L54 28 L44 26 Z" fill={fin} opacity="0.95" />
          {/* eye */}
          <circle cx="46" cy="17" r="3.4" fill="#1a0505" />
          <circle cx="47.2" cy="15.8" r="1.2" fill="#fff" />
          {/* ruby shine streak */}
          <path d="M28 14 L40 12" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (skinId === 'emerald') {
    // Sleek elongated, long flowing fins, turquoise speed feel
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
          filter: `drop-shadow(0 0 12px ${glow})`,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 68 42" width="60" height="42" style={{ overflow: 'visible' }}>
          <circle cx="36" cy="21" r="18" fill={glow} opacity="0.2" />
          {/* long flowing tail */}
          <path d="M2 21 Q8 6 18 12 L16 21 L18 30 Q8 36 2 21 Z" fill={fin} />
          {/* elongated body */}
          <ellipse cx="38" cy="21" rx="22" ry="11" fill={body} />
          {/* belly */}
          <ellipse cx="40" cy="24" rx="14" ry="6" fill={belly} opacity="0.8" />
          {/* long dorsal fin */}
          <path d="M24 12 Q36 -2 50 11" fill="none" stroke={fin} strokeWidth="5" strokeLinecap="round" />
          <path d="M24 12 Q36 2 50 11" fill={fin} opacity="0.9" />
          {/* long lower fin */}
          <path d="M28 30 Q40 42 52 29" fill="none" stroke={fin} strokeWidth="4" strokeLinecap="round" opacity="0.85" />
          {/* pectoral */}
          <path d="M44 23 Q56 16 58 26 Q50 25 44 23" fill={fin} />
          {/* eye */}
          <circle cx="50" cy="17" r="3" fill="#002820" />
          <circle cx="51" cy="16" r="1" fill="#fff" />
          {/* speed lines hint */}
          <path d="M18 16 L10 14" stroke={glow} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M18 26 L10 28" stroke={glow} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
    );
  }

  if (skinId === 'diamond') {
    // Clean luxurious crystal look, facets, white/blue shines
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
          filter: `drop-shadow(0 0 14px ${glow})`,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 42" width="58" height="42" style={{ overflow: 'visible' }}>
          {/* crystal glow */}
          <circle cx="34" cy="21" r="20" fill={glow} opacity="0.28" />
          {/* tail */}
          <path d="M3 21 L16 8 L14 21 L16 34 Z" fill={fin} />
          {/* faceted body */}
          <path
            d="M15 21 L22 9 L40 7 L54 16 L56 21 L54 26 L40 35 L22 33 Z"
            fill={body}
          />
          {/* facet lines */}
          <path d="M22 9 L34 21 L22 33" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
          <path d="M40 7 L34 21 L40 35" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
          {/* belly facet */}
          <path d="M24 24 L36 29 L48 24 L36 26 Z" fill={belly} opacity="0.7" />
          {/* dorsal crystal fin */}
          <path d="M28 9 L36 1 L44 9 L40 12 L32 12 Z" fill={fin} />
          {/* lower */}
          <path d="M30 32 L36 40 L42 32" fill={fin} opacity="0.9" />
          {/* side fin */}
          <path d="M42 22 L54 16 L55 26 L46 24 Z" fill={fin} />
          {/* eye */}
          <circle cx="47" cy="17" r="3.1" fill="#0a1a22" />
          <circle cx="48" cy="16" r="1.1" fill="#fff" />
          {/* diamond sparkles */}
          <circle cx="30" cy="14" r="1.4" fill="#fff" opacity="0.9" />
          <circle cx="38" cy="12" r="1" fill="#fff" opacity="0.75" />
          <path d="M26 18 L29 18 M27.5 16.5 L27.5 19.5" stroke="#fff" strokeWidth="1" opacity="0.8" />
          {/* shine streak */}
          <path d="M24 15 Q34 11 46 15" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // legendary — most beautiful: golden halo, big flowing tail, crown-like details, glow
  return (
    <div
      className="skin-fish-preview"
      style={{
        position: 'relative',
        width: 62,
        height: 46,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: `drop-shadow(0 0 16px ${glow})`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 72 48" width="62" height="46" style={{ overflow: 'visible' }}>
        {/* outer golden halo */}
        <circle cx="38" cy="24" r="22" fill="none" stroke={glow} strokeWidth="3" opacity="0.55" />
        <circle cx="38" cy="24" r="19" fill={glow} opacity="0.18" />
        {/* large ornate tail */}
        <path d="M2 24 Q6 4 18 12 L15 24 L18 36 Q6 44 2 24 Z" fill={fin} />
        <path d="M4 24 Q8 10 16 15" fill="none" stroke="#fffbe0" strokeWidth="1.5" opacity="0.5" />
        {/* regal body */}
        <ellipse cx="40" cy="24" rx="20" ry="13" fill={body} />
        {/* belly */}
        <ellipse cx="42" cy="28" rx="13" ry="7" fill={belly} opacity="0.85" />
        {/* big flowing dorsal */}
        <path d="M26 12 Q40 -4 54 12 L48 14 L32 14 Z" fill={fin} />
        {/* secondary fin layers for detail */}
        <path d="M30 13 Q40 2 50 13" fill="none" stroke="#ff9f1c" strokeWidth="2" opacity="0.7" />
        {/* lower fins */}
        <path d="M28 35 Q40 48 52 34 L46 33 L34 33 Z" fill={fin} opacity="0.95" />
        {/* side fin */}
        <path d="M46 26 Q60 18 62 30 Q54 28 46 26" fill={fin} />
        {/* crown / crest on head */}
        <path d="M50 12 L53 5 L56 12 L59 6 L61 13" fill="none" stroke="#fffbe0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* eye */}
        <circle cx="52" cy="20" r="3.5" fill="#1a1200" />
        <circle cx="53.3" cy="18.7" r="1.3" fill="#fff" />
        {/* golden scale accents */}
        <circle cx="32" cy="20" r="1.6" fill="#fffbe0" opacity="0.7" />
        <circle cx="38" cy="17" r="1.3" fill="#fffbe0" opacity="0.6" />
        <circle cx="44" cy="19" r="1.1" fill="#fffbe0" opacity="0.55" />
        {/* bright shine */}
        <path d="M28 16 Q40 10 52 16" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* inner halo ring */}
        <circle cx="38" cy="24" r="16" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      </svg>
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
