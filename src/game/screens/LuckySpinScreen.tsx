import { useState, useEffect, useRef } from 'react';
import { getCoins, addCoins, getShopInventory, getSelectedSkin } from '../storage';
import { dateKey } from '../constants';
import { audioManager } from '../managers/AudioManager';

interface Props {
  onBack: () => void;
}

interface Prize {
  name: string;
  type: 'coins' | 'item';
  itemId?: 'shield' | 'magnet' | 'gemBoost' | 'continueToken';
  amount: number;
  color: string;
}

const PRIZES: Prize[] = [
  { name: '+50 Coins', type: 'coins', amount: 50, color: '#fb8500' },
  { name: 'Shield Charge', type: 'item', itemId: 'shield', amount: 1, color: '#2196f3' },
  { name: '+100 Coins', type: 'coins', amount: 100, color: '#ff9800' },
  { name: 'Coin Magnet', type: 'item', itemId: 'magnet', amount: 1, color: '#e91e63' },
  { name: '+300 Coins', type: 'coins', amount: 300, color: '#ffeb3b' },
  { name: 'Gem Boost', type: 'item', itemId: 'gemBoost', amount: 1, color: '#9c27b0' },
  { name: '+150 Coins', type: 'coins', amount: 150, color: '#ffb703' },
  { name: 'Continue Token', type: 'item', itemId: 'continueToken', amount: 1, color: '#4caf50' },
];

export default function LuckySpinScreen({ onBack }: Props) {
  const [coins, setCoins] = useState(getCoins());
  const [isSpinning, setIsSubSpinning] = useState(false);
  const [hasFreeSpin, setHasFreeSpin] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [cost, setCost] = useState(150);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentAngleRef = useRef(0);
  const velocityRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if free spin is available for today
    const lastSpin = localStorage.getItem('gfr_last_daily_spin_date') || '';
    const today = dateKey();
    setHasFreeSpin(lastSpin !== today);
    setCoins(getCoins());

    // Apply Moorish Idol (legendary) 20% discount on Lucky Spin cost
    const activeSkin = getSelectedSkin();
    if (activeSkin === 'legendary') {
      setCost(120);
    } else {
      setCost(150);
    }
  }, []);

  // Render the static/dynamic wheel canvas
  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 15;

    ctx.clearRect(0, 0, size, size);

    // Save context and apply rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);

    const arc = (Math.PI * 2) / PRIZES.length;

    // Draw individual slices
    PRIZES.forEach((prize, idx) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, idx * arc, (idx + 1) * arc);
      ctx.closePath();

      ctx.fillStyle = prize.color;
      ctx.fill();

      ctx.strokeStyle = '#000814';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.rotate(idx * arc + arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(prize.name, radius - 15, 0);
      ctx.restore();
    });

    ctx.restore();

    // Draw center peg
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd54f';
    ctx.stroke();

    // Draw gold center text
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WIN', center, center);

    // Draw pointer arrow (At the top of the wheel)
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.moveTo(center - 10, 8);
    ctx.lineTo(center + 10, 8);
    ctx.lineTo(center, 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  useEffect(() => {
    drawWheel(0);
  }, []);

  const spin = () => {
    if (isSpinning) return;

    // Deduct cost if not free
    const today = dateKey();
    if (!hasFreeSpin) {
      if (coins < cost) {
        setResultMessage('Not enough coins!');
        setTimeout(() => setResultMessage(null), 2000);
        return;
      }
      // Deduct coins
      const balance = getCoins() - cost;
      localStorage.setItem('gfr_coins', JSON.stringify(balance));
      setCoins(balance);
    } else {
      localStorage.setItem('gfr_last_daily_spin_date', today);
      setHasFreeSpin(false);
    }

    setIsSubSpinning(true);
    setResultMessage(null);
    audioManager.playSound('jump', true);

    // Dynamic but balanced selection using weighted probabilities:
    // Slices list:
    // 0: +50 Coins (High Probability: 25%)
    // 1: Shield Charge (Medium Probability: 15%)
    // 2: +100 Coins (High Probability: 22%)
    // 3: Coin Magnet (Medium Probability: 15%)
    // 4: +300 Coins (Low Probability: 6%) -- Legendary / Major payout
    // 5: Gem Boost (Medium Probability: 11%)
    // 6: +150 Coins (High Probability: 12%) -- Cost recovery
    // 7: Continue Token (Low Probability: 4%) -- Very high value consumable
    const weights = [0.22, 0.16, 0.20, 0.16, 0.06, 0.11, 0.11, 0.04];
    const roll = Math.random();
    let selectedIdx = 0;
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (roll <= sum) {
        selectedIdx = i;
        break;
      }
    }

    const arcSize = (Math.PI * 2) / PRIZES.length;

    // We want the wheel to decelerate and halt with the target slice (selectedIdx) under the top pointer.
    // The top pointer is physically at 12 o'clock, which corresponds to 3*PI/2 (270 degrees) on a standard unit circle.
    // However, when we draw the wheel, we translate, rotate by currentAngle, and draw slice i at [i*arcSize, (i+1)*arcSize].
    // Slice i is under pointer if: (currentAngle + i * arcSize + arcSize / 2) is aligned with top pointer (3*PI/2).
    // Let's do the math:
    // rotationOffsetForTarget = (1.5 * Math.PI) - (selectedIdx * arcSize + arcSize / 2).
    // To add satisfying speed and spin iterations:
    // targetFinalAngle = Math.PI * 10 + rotationOffsetForTarget + (Math.random() - 0.5) * (arcSize * 0.7);
    const rotationOffsetForTarget = (Math.PI * 1.5) - (selectedIdx * arcSize + arcSize / 2);
    const targetFinalAngle = (Math.PI * 2 * 6) + rotationOffsetForTarget + (Math.random() - 0.5) * (arcSize * 0.65);

    let currentRotation = currentAngleRef.current % (Math.PI * 2);
    currentAngleRef.current = currentRotation; // reset to avoid overflowing large values over time

    // Smooth Quintic ease-out calculation:
    // x = ratio of time elapsed
    // y = 1 - (1 - x)^5
    const durationMs = 4500;
    const startTime = performance.now();
    let lastTickAngle = 0;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Quintic ease out formula
      const ease = 1 - Math.pow(1 - progress, 5);
      const angle = currentRotation + (targetFinalAngle - currentRotation) * ease;
      currentAngleRef.current = angle;

      // Play light ticking sound as slices rotate past pointer
      const currentTickIdx = Math.floor(angle / arcSize);
      if (currentTickIdx !== lastTickAngle) {
        lastTickAngle = currentTickIdx;
        audioManager.playTone(600, 15, 'sine', 0.1);
      }

      drawWheel(angle);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Spin finished!
        setIsSubSpinning(false);
        cancelAnimationFrame(animationRef.current!);

        const prize = PRIZES[selectedIdx];

        // Reward player
        if (prize.type === 'coins') {
          const newTotal = addCoins(prize.amount);
          setCoins(newTotal);
          setResultMessage(`Congratulations! You won ${prize.name}! 🪙`);
        } else if (prize.itemId) {
          const inv = getShopInventory();
          inv[prize.itemId] = (inv[prize.itemId] ?? 0) + prize.amount;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          setResultMessage(`Congratulations! You won ${prize.name}! 🎁`);
        }

        audioManager.playSound('reward', true);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="screen lucky-spin-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Lucky Spin</h2>
      </div>

      <div className="shop-coins-balance" style={{ marginBottom: '14px' }}>
        <span className="coin-label-large">Coins</span>
        <span className="coin-value-large">{coins}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
        <div style={{ position: 'relative', width: '280px', height: '280px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '12px', boxShadow: '0 0 25px rgba(255,213,79,0.2)' }}>
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {resultMessage ? (
          <div style={{ margin: '14px 0', fontSize: '15px', fontWeight: 'bold', color: '#ffb703', animation: 'bounce 0.8s infinite' }}>
            {resultMessage}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#b0bec5', margin: '14px 0', textAlign: 'center', padding: '0 16px' }}>
            {hasFreeSpin ? 'Your free daily spin is ready! Spin the wheel to claim a reward.' : `Cost: 🪙${cost} Coins per spin.`}
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '180px', padding: '14px', fontSize: '15px', background: hasFreeSpin ? '#4caf50' : '#ffb703', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
          onClick={spin}
          disabled={isSpinning}
        >
          {isSpinning ? 'Spinning...' : hasFreeSpin ? 'Free Daily Spin' : 'Spin Wheel'}
        </button>
      </div>

      <div className="shop-footer">
        <p className="shop-note">Lucky Spin rewards are added immediately to your coin balance or inventory.</p>
      </div>
    </div>
  );
}
