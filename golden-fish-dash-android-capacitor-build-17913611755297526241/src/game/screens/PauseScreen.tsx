interface Props {
  onResume: () => void;
  onMenu: () => void;
}

export default function PauseScreen({ onResume, onMenu }: Props) {
  return (
    <div className="screen pause-screen">
      <h2 className="screen-title">Paused</h2>
      <div className="gameover-buttons">
        <button className="btn btn-primary" onClick={onResume}>
          Resume
        </button>
        <button className="btn btn-secondary" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
