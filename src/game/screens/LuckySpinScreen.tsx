import { useState, useEffect, useRef } from 'react';
import { getCoins, addCoins, getShopInventory, getSelectedSkin } from '../storage';
import { dateKey } from '../constants';
import { audioManager } from '../managers/AudioManager';
import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

interface Prize {
  nameKey: string;
  type: 'coins' | 'item';
  itemId?: 'shield' | 'magnet' | 'gemBoost' | 'continueToken';
  amount: number;
  color: string;
}

const PRIZES: Prize[] = [
  { nameKey: 'spin.prize.coin50', type: 'coins', amount: 50, color: '#ffb703' },
  { nameKey: 'spin.prize.shield', type: 'item', itemId: 'shield', amount: 1, color: '#2196f3' },
  { nameKey: 'spin.prize.coin100', type: 'coins', amount: 100, color: '#fb8500' },
  { nameKey: 'spin.prize.magnet', type: 'item', itemId: 'magnet', amount: 1, color: '#e91e63' },
  { nameKey: 'spin.prize.coin150', type: 'coins', amount: 150, color: '#ffeb3b' },
  { nameKey: 'spin.prize.heart', type: 'item', itemId: 'gemBoost', amount: 1, color: '#9c27b0' },
  { nameKey: 'spin.prize.coin300', type: 'coins', amount: 300, color: '#ff5722' },
  { nameKey: 'spin.prize.token', type: 'item', itemId: 'continueToken', amount: 1, color: '#4caf50' },
];

const WEIGHTS = [25, 12, 20, 10, 15, 8, 5, 5];

function rollWeightedPrizeIndex(): number {
  const r = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    cumulative += WEIGHTS[i];
    if (r < cumulative) {
      return i;
    }
  }
  return 0; // fallback
}

export default function LuckySpinScreen({ onBack }: Props) {
  const { t } = useI18n();
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

    // Apply 20% legendary Moorish Idol skin discount on mount
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
      ctx.fillText(t(prize.nameKey), radius - 15, 0);
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
    ctx.fillText(t('spin.win'), center, center);

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
  }, [t]);

  const spin = () => {
    if (isSpinning) return;

    // Deduct cost if not free
    const today = dateKey();
    if (!hasFreeSpin) {
      if (coins < cost) {
        setResultMessage(t('spin.notEnough'));
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

    // Roll weighted prize index beforehand
    const targetIdx = rollWeightedPrizeIndex();
    const arcSize = (Math.PI * 2) / PRIZES.length;

    // Calculate final exact target angle to align pointer exactly with targetIdx
    const targetNormalizedAngle = (targetIdx + 0.5) * arcSize;
    const finalAngleMod = (Math.PI * 3.5 - targetNormalizedAngle + Math.PI * 4) % (Math.PI * 2);

    const initialAngleMod = currentAngleRef.current % (Math.PI * 2);
    const laps = 6 + Math.floor(Math.random() * 4); // 6 to 9 full laps
    let deltaAngle = laps * Math.PI * 2 + finalAngleMod - initialAngleMod;
    if (deltaAngle < Math.PI * 4) {
      deltaAngle += Math.PI * 2;
    }

    const targetFinalAngle = currentAngleRef.current + deltaAngle;

    // Set starting velocity so friction stops exactly at targetFinalAngle
    const friction = 0.982; // Friction factor
    velocityRef.current = deltaAngle * (1 - friction);

    let lastTickAngle = 0;

    const animate = () => {
      currentAngleRef.current += velocityRef.current;
      velocityRef.current *= friction;

      // Play light ticking sound as slices rotate past pointer
      const currentTickIdx = Math.floor(currentAngleRef.current / arcSize);
      if (currentTickIdx !== lastTickAngle) {
        lastTickAngle = currentTickIdx;
        audioManager.playTone(600, 15, 'sine', 0.1);
      }

      drawWheel(currentAngleRef.current);

      if (velocityRef.current < 0.0018) {
        // Spin finished!
        setIsSubSpinning(false);
        cancelAnimationFrame(animationRef.current!);

        // Force exact targeted final angle to resolve any float truncation
        currentAngleRef.current = targetFinalAngle;
        drawWheel(currentAngleRef.current);

        const prize = PRIZES[targetIdx];

        // Reward player
        if (prize.type === 'coins') {
          const newTotal = addCoins(prize.amount);
          setCoins(newTotal);
          setResultMessage(t('spin.congratulations', { prize: t(prize.nameKey), icon: '🪙' }));
        } else if (prize.itemId) {
          const inv = getShopInventory();
          inv[prize.itemId] = (inv[prize.itemId] ?? 0) + prize.amount;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          setResultMessage(t('spin.congratulations', { prize: t(prize.nameKey), icon: '🎁' }));
        }

        audioManager.playSound('reward', true);
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="screen lucky-spin-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <h2 className="screen-title">{t('spin.title')}</h2>
      </div>

      <div className="shop-coins-balance" style={{ marginBottom: '14px' }}>
        <span className="coin-label-large">{t('common.coins')}</span>
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
            {hasFreeSpin ? t('spin.freeReady') : t('spin.cost', { cost })}
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '180px', padding: '14px', fontSize: '15px', background: hasFreeSpin ? '#4caf50' : '#ffb703', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
          onClick={spin}
          disabled={isSpinning}
        >
          {isSpinning ? t('spin.spinning') : hasFreeSpin ? t('spin.freeDaily') : t('spin.spinWheel')}
        </button>
      </div>

      <div className="shop-footer">
        <p className="shop-note">{t('spin.note')}</p>
      </div>
    </div>
  );
}
