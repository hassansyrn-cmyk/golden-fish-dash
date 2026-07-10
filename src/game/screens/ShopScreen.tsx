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
    name: 'Shield',
    description: 'Start run with 1 shield charge. Protects from one hit.',
    cost: 80,
  },
  {
    id: 'magnet',
    name: 'Coin Magnet',
    description: 'Start run with magnet active for ~8s. Pulls nearby coins.',
    cost: 100,
  },
  {
    id: 'gemBoost',
    name: 'Gem Boost',
    description: 'Increase gem spawn chance for this run.',
    cost: 120,
  },
  {
    id: 'continueToken',
    name: 'Continue Token',
    description: 'Use on Game Over to revive without ad (one per run).',
    cost: 150,
  },
];

interface Props {
  onBack: () => void;
}

export default function ShopScreen({ onBack }: Props) {
  const [coins, setCoins] = useState(getCoins());
  const [inventory, setInventory] = useState(getShopInventory());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Refresh on mount
    setCoins(getCoins());
    setInventory(getShopInventory());
  }, []);

  const handleBuy = (item: ShopItem) => {
    setMessage(null);
    const success = buyShopItem(item.id, item.cost);
    if (success) {
      setCoins(getCoins());
      setInventory(getShopInventory());
      setMessage(`Purchased ${item.name}!`);
      // Clear message after 2s
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage('Not enough coins!');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const getOwned = (id: ShopItemId) => getShopItemCount(id);

  return (
    <div className="screen shop-screen">
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Coin Shop</h2>
      </div>

      <div className="shop-coins">
        <span className="coin-icon">🪙</span>
        <span className="coin-amount">{coins}</span>
        <span className="coin-label">Coins</span>
      </div>

      {message && <div className="shop-message">{message}</div>}

      <div className="shop-list">
        {SHOP_ITEMS.map((item) => {
          const owned = getOwned(item.id);
          const canBuy = coins >= item.cost;
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
                {canBuy ? 'Buy' : 'Not enough coins'}
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
