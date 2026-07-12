import { useState, useEffect } from 'react';
import {
  getCoins,
  getShopInventory,
  buyShopItem,
  getShopItemCount,
  getUpgradeLevel,
  buyUpgrade,
  getPlayerUpgrades,
} from '../storage';
import { UPGRADE_LEVELS } from '../types';
import type { ShopItemId } from '../types';

interface ShopItem {
  id: ShopItemId;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

const POWERUP_ITEMS: ShopItem[] = [
  {
    id: 'shield',
    name: 'Shield',
    description: 'Start with shield charge(s). Protects from hits.',
    cost: 20,
    icon: '🛡️',
  },
  {
    id: 'magnet',
    name: 'Coin Magnet',
    description: 'Pulls nearby coins at the start of the run.',
    cost: 25,
    icon: '🧲',
  },
  {
    id: 'gemBoost',
    name: 'Gem Boost',
    description: 'Increases gem spawn chance for this run.',
    cost: 30,
    icon: '💎',
  },
  {
    id: 'continueToken',
    name: 'Continue Token',
    description: 'Revive once on Game Over without watching an ad.',
    cost: 40,
    icon: '🔄',
  },
  {
    id: 'dash',
    name: 'Dash',
    description: 'Powerful forward/upward dash with temporary invincibility.',
    cost: 35,
    icon: '⚡',
  },
];

type Tab = 'powerups' | 'upgrades';

interface Props {
  onBack: () => void;
}

export default function ShopScreen({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('powerups');
  const [coins, setCoins] = useState(getCoins());
  const [inventory, setInventory] = useState(getShopInventory());
  const [upgrades, setUpgrades] = useState(getPlayerUpgrades());
  const [message, setMessage] = useState<string | null>(null);

  const refreshData = () => {
    setCoins(getCoins());
    setInventory(getShopInventory());
    setUpgrades(getPlayerUpgrades());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showMessage = (msg: string, duration = 2200) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), duration);
  };

  // === BUY POWER-UP ===
  const handleBuyPowerup = (item: ShopItem) => {
    const success = buyShopItem(item.id, item.cost);
    if (success) {
      refreshData();
      showMessage(`✅ Purchased ${item.name}!`);
    } else {
      const needed = item.cost - coins;
      showMessage(needed > 0 ? `Need ${needed} more coins` : 'Not enough coins', 2600);
    }
  };

  // === BUY / UPGRADE ITEM ===
  const handleUpgrade = (itemId: ShopItemId) => {
    const currentLevel = getUpgradeLevel(itemId);
    const nextLevel = currentLevel + 1;

    const upgradeList = UPGRADE_LEVELS[itemId];
    if (!upgradeList || nextLevel > upgradeList.length) {
      showMessage('Already at maximum level!');
      return;
    }

    const upgradeInfo = upgradeList[nextLevel - 1];

    const success = buyUpgrade(itemId, nextLevel);
    if (success) {
      refreshData();
      showMessage(`✅ Upgraded ${itemId} to Level ${nextLevel}!`);
    } else {
      showMessage(`Not enough coins for Level ${nextLevel}`, 2600);
    }
  };

  const getOwned = (id: ShopItemId) => getShopItemCount(id);
  const getCurrentLevel = (id: ShopItemId) => getUpgradeLevel(id);

  return (
    <div className="screen shop-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      {/* Header */}
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Coin Shop</h2>
      </div>

      {/* Coin Balance */}
      <div className="shop-coins-balance">
        <span className="coin-label-large">🪙 Coins</span>
        <span className="coin-value-large">{coins}</span>
      </div>

      {message && <div className="shop-message">{message}</div>}

      {/* Tabs */}
      <div className="shop-tabs">
        <button
          className={`shop-tab ${activeTab === 'powerups' ? 'active' : ''}`}
          onClick={() => setActiveTab('powerups')}
        >
          Power-ups
        </button>
        <button
          className={`shop-tab ${activeTab === 'upgrades' ? 'active' : ''}`}
          onClick={() => setActiveTab('upgrades')}
        >
          Upgrades
        </button>
      </div>

      {/* POWER-UPS TAB */}
      {activeTab === 'powerups' && (
        <div className="shop-list">
          {POWERUP_ITEMS.map((item) => {
            const owned = getOwned(item.id);
            const canBuy = coins >= item.cost;
            return (
              <div key={item.id} className="shop-item-card">
                <div className="shop-item-header">
                  <span className="shop-item-icon">{item.icon}</span>
                  <div className="shop-item-title">{item.name}</div>
                </div>
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
                  {canBuy ? 'Buy' : 'Not enough coins'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* UPGRADES TAB (Phase 3) */}
      {activeTab === 'upgrades' && (
        <div className="shop-list">
          {POWERUP_ITEMS.filter(item => item.id !== 'continueToken').map((item) => {
            const currentLevel = getCurrentLevel(item.id);
            const upgradeList = UPGRADE_LEVELS[item.id] || [];
            const maxLevel = upgradeList.length;
            const isMaxed = currentLevel >= maxLevel;

            const nextLevelInfo = !isMaxed ? upgradeList[currentLevel] : null;
            const upgradeCost = nextLevelInfo?.cost || 0;
            const canUpgrade = coins >= upgradeCost && !isMaxed;

            return (
              <div key={item.id} className="shop-item-card upgrade-card">
                <div className="shop-item-header">
                  <span className="shop-item-icon">{item.icon}</span>
                  <div>
                    <div className="shop-item-title">{item.name}</div>
                    <div className="upgrade-level">Level {currentLevel} / {maxLevel}</div>
                  </div>
                </div>

                <div className="shop-item-desc">
                  {nextLevelInfo ? nextLevelInfo.effect : 'Maximum level reached!'}
                </div>

                <div className="shop-item-meta">
                  <div className="shop-price">
                    {isMaxed ? 'MAX' : `🪙 ${upgradeCost}`}
                  </div>
                </div>

                <button
                  className="shop-buy-btn upgrade-btn"
                  onClick={() => handleUpgrade(item.id)}
                  disabled={!canUpgrade}
                >
                  {isMaxed ? 'Max Level' : canUpgrade ? 'Upgrade' : 'Not enough coins'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="shop-footer">
        <p className="shop-note">
          Power-ups are used automatically at the start of your next run.<br />
          Upgrades improve the power and duration of your items permanently.
        </p>
      </div>
    </div>
  );
}
