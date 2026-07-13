import { useState, useEffect } from 'react';
import {
  getCoins,
  getShopInventory,
  buyShopItem,
  getShopItemCount,
  getUpgradeLevel,
  purchaseUpgradeLevel,
  getMissions,
  claimMissionReward,
  addCoins,
  addXP,
} from '../storage';
import type { ShopItemId, MissionDef } from '../types';
import { audioManager } from '../managers/AudioManager';

interface ShopItem {
  id: ShopItemId;
  name: string;
  description: string;
  cost: number;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shield',
    name: '🛡️ Shield Charge',
    description: 'Start next run with +1 shield charge. Absorbs one hit.',
    cost: 28,
  },
  {
    id: 'magnet',
    name: '🧲 Coin Magnet',
    description: 'Start next run with magnet active for ~8s. Pulls nearby coins.',
    cost: 35,
  },
  {
    id: 'gemBoost',
    name: '💎 Gem Boost',
    description: 'Increase gem/heart spawn chance for the next run.',
    cost: 42,
  },
  {
    id: 'continueToken',
    name: '🔄 Continue Token',
    description: 'Use on Game Over to revive instantly without watching an ad.',
    cost: 55,
  },
];

interface UpgradeItem {
  id: string;
  name: string;
  description: string;
  baseCost: number;
}

const UPGRADE_ITEMS: UpgradeItem[] = [
  {
    id: 'shield',
    name: '🛡️ Shield Capacity',
    description: 'Permanently increases starting shield charge capacity (+1 charge/level).',
    baseCost: 50,
  },
  {
    id: 'magnet',
    name: '🧲 Magnet Duration',
    description: 'Start runs with active magnet. Adds +3 seconds of duration per level.',
    baseCost: 50,
  },
  {
    id: 'gemBoost',
    name: '💎 Gem Spawn rate',
    description: 'Permanently increases the spawn probability of hearts and gems.',
    baseCost: 58,
  },
  {
    id: 'coinMultiplier',
    name: '🪙 Coin Multiplier',
    description: 'Boosts all coin values! Awards +1 extra coin per coin collected.',
    baseCost: 70,
  },
];

interface ChestItem {
  tier: 'bronze' | 'silver' | 'gold';
  name: string;
  description: string;
  cost: number;
  color: string;
}

const CHEST_ITEMS: ChestItem[] = [
  {
    tier: 'bronze',
    name: '📦 Bronze Chest',
    description: 'Contains random coin rewards (15-40 coins) or consumable shields and magnets.',
    cost: 65,
    color: '#cd7f32',
  },
  {
    tier: 'silver',
    name: '🥈 Silver Chest',
    description: 'Contains larger coins bundles (40-90 coins), double powerups, or gem boosts.',
    cost: 130,
    color: '#c0c0c0',
  },
  {
    tier: 'gold',
    name: '👑 Legendary Gold Chest',
    description: 'Contains massive coin pools (80-200 coins), continue tokens, gem boosts, or level XP!',
    cost: 230,
    color: '#ffd700',
  },
];

interface Props {
  onBack: () => void;
}

export default function ShopScreen({ onBack }: Props) {
  const [coins, setCoins] = useState(getCoins());
  const [inventory, setInventory] = useState(getShopInventory());
  const [missions, setMissions] = useState<MissionDef[]>([]);
  const [activeTab, setActiveTab] = useState<'powerups' | 'upgrades' | 'chests' | 'missions'>('powerups');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCoins(getCoins());
    setInventory(getShopInventory());
    setMissions(getMissions());
  }, []);

  const handleBuyPowerup = (item: ShopItem) => {
    setMessage(null);
    const currentCoins = getCoins();
    const needed = item.cost - currentCoins;
    const success = buyShopItem(item.id, item.cost);
    if (success) {
      const newCoins = getCoins();
      setCoins(newCoins);
      setInventory(getShopInventory());
      setMessage(`Purchased ${item.name}!`);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(needed > 0 ? `Need ${needed} more coins` : 'Not enough coins');
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleBuyUpgrade = (item: UpgradeItem) => {
    setMessage(null);
    const currentLevel = getUpgradeLevel(item.id);
    if (currentLevel >= 5) {
      setMessage('Upgrade already fully maxed out!');
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    const cost = (currentLevel + 1) * item.baseCost;
    const currentCoins = getCoins();
    const needed = cost - currentCoins;

    const success = purchaseUpgradeLevel(item.id, cost);
    if (success) {
      const newCoins = getCoins();
      setCoins(newCoins);
      setMessage(`Upgraded ${item.name} to Level ${currentLevel + 1}!`);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(needed > 0 ? `Need ${needed} more coins` : 'Not enough coins');
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleClaimReward = (missionId: string) => {
    setMessage(null);
    const res = claimMissionReward(missionId);
    if (res.success) {
      setCoins(getCoins());
      setMissions(getMissions());
      setMessage(`Claimed +🪙${res.coins} & +⚡${res.xp} XP!`);
      setTimeout(() => setMessage(null), 2200);
    }
  };

  const handleOpenChest = (tier: 'bronze' | 'silver' | 'gold', cost: number) => {
    setMessage(null);
    if (coins < cost) {
      setMessage(`Need ${cost - coins} more coins to open this chest!`);
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    // Deduct coins
    const balance = coins - cost;
    localStorage.setItem('gfr_coins', JSON.stringify(balance));
    setCoins(balance);

    // Roll rewards
    let rewardText = '';
    audioManager.playSound('reward', true);

    if (tier === 'bronze') {
      const roll = Math.random();
      if (roll < 0.6) {
        const rewardCoins = 15 + Math.floor(Math.random() * 25);
        addCoins(rewardCoins);
        rewardText = `Won +🪙${rewardCoins} Coins!`;
      } else if (roll < 0.8) {
        const inv = getShopInventory();
        inv.shield = (inv.shield ?? 0) + 1;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 1x Shield Charge! 🛡️`;
      } else {
        const inv = getShopInventory();
        inv.magnet = (inv.magnet ?? 0) + 1;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 1x Coin Magnet! 🧲`;
      }
    } else if (tier === 'silver') {
      const roll = Math.random();
      if (roll < 0.5) {
        const rewardCoins = 40 + Math.floor(Math.random() * 50);
        addCoins(rewardCoins);
        rewardText = `Won +🪙${rewardCoins} Coins!`;
      } else if (roll < 0.7) {
        const inv = getShopInventory();
        inv.shield = (inv.shield ?? 0) + 2;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 2x Shield Charges! 🛡️`;
      } else if (roll < 0.9) {
        const inv = getShopInventory();
        inv.magnet = (inv.magnet ?? 0) + 2;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 2x Coin Magnets! 🧲`;
      } else {
        const inv = getShopInventory();
        inv.gemBoost = (inv.gemBoost ?? 0) + 1;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 1x Gem Boost charge! 💎`;
      }
    } else {
      // Gold chest
      const roll = Math.random();
      if (roll < 0.4) {
        const rewardCoins = 80 + Math.floor(Math.random() * 120);
        addCoins(rewardCoins);
        rewardText = `Won +🪙${rewardCoins} Coins!`;
      } else if (roll < 0.6) {
        const inv = getShopInventory();
        inv.continueToken = (inv.continueToken ?? 0) + 1;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 1x Continue Token! 🔄`;
      } else if (roll < 0.8) {
        const inv = getShopInventory();
        inv.gemBoost = (inv.gemBoost ?? 0) + 2;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = `Won 2x Gem Boost charges! 💎`;
      } else {
        const rewardXP = 50 + Math.floor(Math.random() * 100);
        addXP(rewardXP);
        rewardText = `Won +⚡${rewardXP} Level XP!`;
      }
    }

    setCoins(getCoins());
    setInventory(getShopInventory());
    setMessage(`Chest Opened! ${rewardText}`);
  };

  const getOwned = (id: ShopItemId) => getShopItemCount(id);

  return (
    <div className="screen shop-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Locker & Shop</h2>
      </div>

      {/* Large visual coin balance */}
      <div className="shop-coins-balance">
        <span className="coin-label-large">Coins</span>
        <span className="coin-value-large">{coins}</span>
      </div>

      {/* Modern responsive tabs */}
      <div className="shop-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '0 10px' }}>
        <button
          className={`btn ${activeTab === 'powerups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('powerups')}
        >
          Consumables
        </button>
        <button
          className={`btn ${activeTab === 'upgrades' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('upgrades')}
        >
          Upgrades
        </button>
        <button
          className={`btn ${activeTab === 'chests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('chests')}
        >
          Chests
        </button>
        <button
          className={`btn ${activeTab === 'missions' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('missions')}
        >
          Missions
        </button>
      </div>

      {message && <div className="shop-message" style={{ whiteSpace: 'pre-wrap' }}>{message}</div>}

      <div className="shop-list" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px 16px' }}>
        {activeTab === 'powerups' &&
          SHOP_ITEMS.map((item) => {
            const owned = getOwned(item.id);
            const currentCoins = coins;
            const canBuy = currentCoins >= item.cost;
            const needed = item.cost - currentCoins;
            return (
              <div key={item.id} className="shop-item-card">
                <div className="shop-item-title">{item.name}</div>
                <div className="shop-item-desc">{item.description}</div>
                <div className="shop-item-meta">
                  <div className="shop-price">🪙 {item.cost}</div>
                  <div className="shop-owned">Owned: {owned}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  onClick={() => handleBuyPowerup(item)}
                  disabled={!canBuy}
                >
                  {canBuy ? 'Buy' : needed > 0 ? `Need ${needed} more` : 'Not enough'}
                </button>
              </div>
            );
          })}

        {activeTab === 'upgrades' &&
          UPGRADE_ITEMS.map((item) => {
            const currentLvl = getUpgradeLevel(item.id);
            const cost = (currentLvl + 1) * item.baseCost;
            const canBuy = coins >= cost && currentLvl < 5;
            const isMax = currentLvl >= 5;
            const needed = cost - coins;

            return (
              <div key={item.id} className="shop-item-card">
                <div className="shop-item-title">
                  {item.name} <span style={{ color: '#ffd54f', fontSize: '12px' }}>(Lvl {currentLvl}/5)</span>
                </div>
                <div className="shop-item-desc">{item.description}</div>

                {/* Level indicator ticks */}
                <div style={{ display: 'flex', gap: '4px', margin: '8px 0' }}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: '6px',
                        flex: 1,
                        borderRadius: '3px',
                        backgroundColor: idx < currentLvl ? '#ffd54f' : 'rgba(255,255,255,0.15)',
                      }}
                    />
                  ))}
                </div>

                <div className="shop-item-meta">
                  <div className="shop-price">{isMax ? 'MAXED' : `🪙 ${cost}`}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  onClick={() => handleBuyUpgrade(item)}
                  disabled={!canBuy || isMax}
                >
                  {isMax ? 'Fully Upgraded' : canBuy ? 'Upgrade' : needed > 0 ? `Need ${needed} more` : 'Not enough'}
                </button>
              </div>
            );
          })}

        {activeTab === 'chests' &&
          CHEST_ITEMS.map((item) => {
            const canBuy = coins >= item.cost;
            const needed = item.cost - coins;

            return (
              <div key={item.tier} className="shop-item-card">
                <div className="shop-item-title" style={{ color: item.color }}>{item.name}</div>
                <div className="shop-item-desc">{item.description}</div>
                <div className="shop-item-meta">
                  <div className="shop-price">🪙 {item.cost}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  style={{ background: `linear-gradient(135deg, ${item.color}, #ffffff)` }}
                  onClick={() => handleOpenChest(item.tier, item.cost)}
                  disabled={!canBuy}
                >
                  {canBuy ? 'Open Chest' : needed > 0 ? `Need ${needed} more` : 'Not enough'}
                </button>
              </div>
            );
          })}

        {activeTab === 'missions' &&
          missions.map((m) => {
            const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
            return (
              <div key={m.id} className="shop-item-card" style={{ padding: '14px' }}>
                <div className="shop-item-title" style={{ fontSize: '14px' }}>{m.description}</div>

                {/* Progress bar */}
                <div style={{ margin: '10px 0 6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#b0bec5', marginBottom: '4px' }}>
                    <span>{m.progress} / {m.target}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: m.completed ? '#81c784' : '#29b6f6', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#ffe082' }}>
                    Reward: 🪙{m.rewardCoins} & ⚡{m.rewardXP} XP
                  </div>

                  <button
                    className="shop-buy-btn"
                    style={{ margin: 0, padding: '6px 14px', fontSize: '12px', backgroundColor: m.claimed ? 'rgba(255,255,255,0.12)' : m.completed ? '#4caf50' : 'rgba(255,255,255,0.06)' }}
                    onClick={() => handleClaimReward(m.id)}
                    disabled={!m.completed || m.claimed}
                  >
                    {m.claimed ? 'Claimed' : m.completed ? 'Claim' : 'In Progress'}
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      <div className="shop-footer">
        <p className="shop-note">
          {activeTab === 'upgrades'
            ? 'Upgrades permanently improve starting parameters.'
            : activeTab === 'chests'
            ? 'Open chests to obtain large coin drops, power-ups, or level XP!'
            : activeTab === 'missions'
            ? 'Claim rewards to acquire extra Coins and level XP!'
            : 'Consumables are automatically deployed at the start of your next run.'}
        </p>
      </div>
    </div>
  );
}
