import { useMemo, useState } from 'react';
import { getGalleryOrder } from '../ocean/characters';
import { getPersonalBest, getSelectedSkin, getUnlockedSkins, setSelectedSkin } from '../storage';
import { useI18n } from '../i18n';
import type { SkinId } from '../types';

interface Props {
  onBack: () => void;
}

/** Tiny inline portrait matching the engine's silhouette per fin style. */
function CharacterPortrait({ colors, finStyle, locked }: { colors: { body: string; belly: string; fin: string; glow: string }; finStyle: string; locked: boolean }) {
  const opacity = locked ? 0.35 : 1;
  return (
    <svg viewBox="0 0 80 48" width="96" height="58" style={{ opacity, overflow: 'visible' }} aria-hidden="true">
      <defs>
        <radialGradient id={`pg-${colors.body.slice(1)}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor={colors.belly} />
          <stop offset="55%" stopColor={colors.body} />
          <stop offset="100%" stopColor={colors.fin} />
        </radialGradient>
      </defs>
      <ellipse cx="42" cy="24" rx="26" ry="18" fill={colors.glow} opacity="0.22" />
      <path d="M12 24 C4 12, 8 10, 16 15 C12 20, 12 24, 12 24 C12 24, 12 28, 16 33 C8 38, 4 36, 12 24 Z" fill={colors.fin} />
      {finStyle === 'veil' && (
        <path d="M12 24 C2 8, 6 6, 18 12 C14 20, 14 28, 18 36 C6 42, 2 40, 12 24 Z" fill={colors.fin} opacity="0.7" />
      )}
      <path d="M14 24 C14 12, 26 6, 42 7 C58 8, 68 15, 70 24 C68 33, 58 40, 42 41 C26 42, 14 36, 14 24 Z" fill={`url(#pg-${colors.body.slice(1)})`} />
      <path d="M30 8 C36 0, 48 0, 54 10 C46 5, 38 5, 30 8 Z" fill={colors.fin} />
      <circle cx="59" cy="19" r="4.4" fill="#fffdf3" />
      <circle cx="60.4" cy="18.2" r="2.6" fill="#125d82" />
      <circle cx="61.3" cy="17.5" r="1.1" fill="#081923" />
      <ellipse cx="53" cy="26" rx="3" ry="1.8" fill="#ff8a80" opacity="0.4" />
    </svg>
  );
}

export default function CharacterGalleryScreen({ onBack }: Props) {
  const { t, language } = useI18n();
  const roster = useMemo(() => getGalleryOrder(), []);
  const unlocked = useMemo(() => new Set(getUnlockedSkins()), []);
  const best = useMemo(() => getPersonalBest(), []);
  const [selectedId, setSelectedId] = useState<SkinId>(getSelectedSkin());

  const selected = roster.find((c) => c.id === selectedId) ?? roster[0];
  const selectedUnlocked = unlocked.has(selected.id);

  const equip = () => {
    if (!selectedUnlocked) return;
    setSelectedSkin(selected.id);
    setSelectedId(selected.id);
  };

  return (
    <div className="screen gallery-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <button className="menu-language-button back-button" type="button" onClick={onBack} aria-label={t('common.back')}>
        ←
      </button>
      <h1 className="screen-title">{t('gallery.title')}</h1>

      <div className="gallery-grid">
        {roster.map((character) => {
          const isUnlocked = unlocked.has(character.id);
          return (
            <button
              key={character.id}
              className={`gallery-card ${character.id === selectedId ? 'gallery-card-selected' : ''} ${isUnlocked ? '' : 'gallery-card-locked'}`}
              onClick={() => setSelectedId(character.id)}
              style={{ borderColor: character.colors.glow }}
            >
              <CharacterPortrait colors={character.colors} finStyle={character.profile.finStyle} locked={!isUnlocked} />
              <span className="gallery-card-name">{isUnlocked ? t(character.nameKey) : '???'}</span>
              {character.tier === 'legacy' && <span className="gallery-legacy-tag">{t('gallery.legacy')}</span>}
            </button>
          );
        })}
      </div>

      <div className="gallery-detail" style={{ borderColor: selected.colors.glow }}>
        <h2>{selectedUnlocked ? t(selected.nameKey) : t('common.locked')}</h2>
        <p className="gallery-species">{t('gallery.species')}: {selected.species}</p>
        <p className="gallery-personality">{selectedUnlocked ? t(selected.personalityKey) : t('gallery.lockedHint', { score: selected.unlockScore })}</p>
        <div className="gallery-ability">
          <span className="gallery-ability-label">{t('gallery.ability')}</span>
          <span>{t(selected.abilityLabelKey)}</span>
        </div>
        <button className="btn btn-primary" onClick={equip} disabled={!selectedUnlocked}>
          {selectedUnlocked
            ? selectedId === getSelectedSkin() ? t('common.selected') : t('common.equip')
            : t('gallery.unlockAt', { score: Math.max(0, selected.unlockScore - best) })}
        </button>
      </div>
    </div>
  );
}
