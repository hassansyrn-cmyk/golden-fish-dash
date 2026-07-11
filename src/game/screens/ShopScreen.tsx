import { useState, useEffect } from 'react';
import { getCoins, getShopInventory, buyShopItem, getShopItemCount } from '../storage';
import type { ShopItemId } from '../types';

interface ShopItem {
  id: ShopItemId;
  name: string;
  description: string;
  cost: number;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shield',
    name: '🛡️ Shield',
    description: 'Start run with 1 shield charge. Protects from one hit.',
    cost: 20,
  },
  {
    id: 'magnet',
    name: '🧲 Coin Magnet',
    description: 'Start run with magnet active for ~8s. Pulls nearby coins.',
    cost: 25,
  },
  {
    id: 'gemBoost',
    name: '💎 Gem Boost',
    description: 'Increase gem spawn chance for this run.',
    cost: 30,
  },
  {
    id: 'continueToken',
    name: '🔄 Continue Token',
    description: 'Use on Game Over to revive without ad (one per run).',
    cost: 40,
  },
];

interface Props {
  onBack: () => void;
}

export default function ShopScreen({ onBack }: Props) {
  const [coins, setCoins] = useState(getCoins());
  const [, setInventory] = useState(getShopInventory());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCoins(getCoins());
    setInventory(getShopInventory());
  }, []);

  const handleBuy = (item: ShopItem) => {
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

  const getOwned = (id: ShopItemId) => getShopItemCount(id);

  return (
    <div className="screen shop-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Coin Shop</h2>
      </div>

      {/* Clear, large, mobile-friendly coin balance at top */}
      <div className="shop-coins-balance">
        <span className="coin-label-large">Coins</span>
        <span className="coin-value-large">{coins}</span>
      </div>

      {message && <div className="shop-message">{message}</div>}

      <div className="shop-list">
        {SHOP_ITEMS.map((item) => {
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
                onClick={() => handleBuy(item)}
                disabled={!canBuy}
              >
                {canBuy ? 'Buy' : (needed > 0 ? `Need ${needed} more coins` : 'Not enough coins')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="shop-footer">
        <p className="shop-note">Items are used automatically at the start of your next run.</p>
      </div>
    </div>
  );
}
