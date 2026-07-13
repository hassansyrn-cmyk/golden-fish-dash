interface Props {
  onBack: () => void;
}

export default function HowToPlay({ onBack }: Props) {
  return (
    <div className="screen howto-screen">
      <h2 className="screen-title">How to Play</h2>
      <ul className="howto-list">
        <li>
          <span className="howto-icon">👆</span>
          Tap anywhere (or press Space / click) to make your fish jump upward.
        </li>
        <li>
          <span className="howto-icon">🌊</span>
          Gravity pulls the fish down — time your taps to glide between obstacles.
        </li>
        <li>
          <span className="howto-icon">🏆</span>
          Pass through a gap to score a point. The ocean gets tougher as your score grows.
        </li>
        <li>
          <span className="howto-icon">📺</span>
          You get one rewarded-ad continue per run if you crash — don't waste it!
        </li>
        <li>
          <span className="howto-icon">🥇</span>
          Chase the global leaderboard and unlock new fish skins as you improve.
        </li>
      </ul>
      <button className="btn btn-primary" onClick={onBack}>
        Got It
      </button>
    </div>
  );
}
