export default function LoadingScreen() {
  return (
    <div className="screen loading-screen">
      <div className="loading-fish" aria-hidden="true">
        <svg viewBox="0 0 80 56" width="88" height="64" style={{ overflow: 'visible' }}>
          <ellipse cx="44" cy="28" rx="28" ry="20" fill="#ffe066" opacity="0.25" />
          <path
            d="M6 28 C0 14, 2 12, 14 16 C8 22, 8 28, 8 28 C8 28, 8 34, 14 40 C2 44, 0 42, 6 28 Z"
            fill="#ffb703"
          />
          <path
            d="M14 28 C14 14, 26 6, 44 7 C60 8, 72 16, 74 28 C72 40, 60 48, 44 49 C26 50, 14 42, 14 28 Z"
            fill="#ffd60a"
          />
          <path d="M26 12 C28 28, 28 28, 26 44 C32 44, 34 28, 32 12 Z" fill="#4cc9f0" opacity="0.85" />
          <path d="M40 10 C42 28, 42 28, 40 46 C46 46, 48 28, 46 10 Z" fill="#4cc9f0" opacity="0.9" />
          <path d="M52 14 C54 28, 54 28, 52 42 C56 42, 58 28, 56 14 Z" fill="#4cc9f0" opacity="0.75" />
          <path
            d="M24 32 C32 42, 56 42, 64 30 C56 38, 36 40, 26 34 Z"
            fill="#fff8d6"
            opacity="0.7"
          />
          <path d="M32 10 C40 0, 52 0, 56 12 C48 6, 40 6, 32 10 Z" fill="#ffb703" />
          <path d="M50 28 C64 20, 66 34, 54 34 C52 32, 51 30, 50 28 Z" fill="#ffb703" />
          <circle cx="62" cy="22" r="5" fill="#1a1200" />
          <circle cx="63.5" cy="20.5" r="1.8" fill="#fff" />
          <ellipse cx="58" cy="28" rx="3.5" ry="2.2" fill="#ff9f1c" opacity="0.4" />
          <path
            d="M28 18 Q44 10 60 18"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p>Diving in…</p>
    </div>
  );
}
