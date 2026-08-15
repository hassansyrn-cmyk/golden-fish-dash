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
  getUnlockedSkins,
} from '../storage';
import type { ShopItemId, MissionDef, SkinId } from '../types';
import { audioManager } from '../managers/AudioManager';
import { translateMission, useI18n } from '../i18n';

interface ShopItem {
  id: ShopItemId;
  nameKey: string;
  descriptionKey: string;
  cost: number;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shield',
    nameKey: 'shop.item.shield.name',
    descriptionKey: 'shop.item.shield.description',
    cost: 150,
  },
  {
    id: 'magnet',
    nameKey: 'shop.item.magnet.name',
    descriptionKey: 'shop.item.magnet.description',
    cost: 200,
  },
  {
    id: 'gemBoost',
    nameKey: 'shop.item.gemBoost.name',
    descriptionKey: 'shop.item.gemBoost.description',
    cost: 250,
  },
  {
    id: 'continueToken',
    nameKey: 'shop.item.continueToken.name',
    descriptionKey: 'shop.item.continueToken.description',
    cost: 350,
  },
];

interface UpgradeItem {
  id: string;
  nameKey: string;
  descriptionKey: string;
  baseCost: number;
}

const UPGRADE_ITEMS: UpgradeItem[] = [
  {
    id: 'shield',
    nameKey: 'shop.upgradeItem.shield.name',
    descriptionKey: 'shop.upgradeItem.shield.description',
    baseCost: 250,
  },
  {
    id: 'magnet',
    nameKey: 'shop.upgradeItem.magnet.name',
    descriptionKey: 'shop.upgradeItem.magnet.description',
    baseCost: 250,
  },
  {
    id: 'gemBoost',
    nameKey: 'shop.upgradeItem.gemBoost.name',
    descriptionKey: 'shop.upgradeItem.gemBoost.description',
    baseCost: 300,
  },
  {
    id: 'coinMultiplier',
    nameKey: 'shop.upgradeItem.coinMultiplier.name',
    descriptionKey: 'shop.upgradeItem.coinMultiplier.description',
    baseCost: 400,
  },
];

interface ChestItem {
  tier: 'bronze' | 'silver' | 'gold';
  nameKey: string;
  descriptionKey: string;
  cost: number;
  color: string;
}

const CHEST_ITEMS: ChestItem[] = [
  {
    tier: 'bronze',
    nameKey: 'shop.chest.bronze.name',
    descriptionKey: 'shop.chest.bronze.description',
    cost: 400,
    color: '#cd7f32',
  },
  {
    tier: 'silver',
    nameKey: 'shop.chest.silver.name',
    descriptionKey: 'shop.chest.silver.description',
    cost: 800,
    color: '#c0c0c0',
  },
  {
    tier: 'gold',
    nameKey: 'shop.chest.gold.name',
    descriptionKey: 'shop.chest.gold.description',
    cost: 1500,
    color: '#ffd700',
  },
];

interface Props {
  onBack: () => void;
  onNewUnlocks?: (ids: SkinId[]) => void;
}

export default function ShopScreen({ onBack, onNewUnlocks }: Props) {
  const { language, t } = useI18n();
  const [coins, setCoins] = useState(getCoins());
  const [missions, setMissions] = useState<MissionDef[]>([]);
  const [activeTab, setActiveTab] = useState<'powerups' | 'upgrades' | 'chests' | 'missions'>('powerups');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCoins(getCoins());
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
        setMessage(t('shop.purchased', { item: t(item.nameKey) }));
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(needed > 0 ? t('shop.needMore', { count: needed }) : t('shop.notEnough'));
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleBuyUpgrade = (item: UpgradeItem) => {
    setMessage(null);
    const currentLevel = getUpgradeLevel(item.id);
    const maxLevel = item.id === 'shield' ? 1 : 5;
    if (currentLevel >= maxLevel) {
      setMessage(t('shop.maxed'));
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
      setMessage(t('shop.upgraded', { item: t(item.nameKey), level: currentLevel + 1 }));
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(needed > 0 ? t('shop.needMore', { count: needed }) : t('shop.notEnough'));
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
      if (roll < 0.3) {
        const rewardCoins = 40 + Math.floor(Math.random() * 61); // 40 to 100 coins
        addCoins(rewardCoins);
        rewardText = t('shop.wonCoins', { coins: rewardCoins });
      } else if (roll < 0.6) {
        const amt = Math.random() < 0.5 ? 1 : 2;
        const inv = getShopInventory();
        inv.shield = (inv.shield ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.shield.name') });
      } else if (roll < 0.8) {
        const amt = Math.random() < 0.5 ? 1 : 2;
        const inv = getShopInventory();
        inv.magnet = (inv.magnet ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.magnet.name') });
      } else if (roll < 0.95) {
        const amt = Math.random() < 0.5 ? 1 : 2;
        const inv = getShopInventory();
        inv.gemBoost = (inv.gemBoost ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.gemBoost.name') });
      } else {
        const inv = getShopInventory();
        inv.continueToken = (inv.continueToken ?? 0) + 1;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: 1, item: t('shop.item.continueToken.name') });
      }
    } else if (tier === 'silver') {
      const roll = Math.random();
      if (roll < 0.3) {
        const rewardCoins = 100 + Math.floor(Math.random() * 151); // 100 to 250 coins
        addCoins(rewardCoins);
        rewardText = t('shop.wonCoins', { coins: rewardCoins });
      } else if (roll < 0.55) {
        const amt = 2 + Math.floor(Math.random() * 4); // 2 to 5
        const inv = getShopInventory();
        inv.shield = (inv.shield ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.shield.name') });
      } else if (roll < 0.75) {
        const amt = 2 + Math.floor(Math.random() * 4); // 2 to 5
        const inv = getShopInventory();
        inv.magnet = (inv.magnet ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.magnet.name') });
      } else if (roll < 0.9) {
        const amt = 2 + Math.floor(Math.random() * 4); // 2 to 5
        const inv = getShopInventory();
        inv.gemBoost = (inv.gemBoost ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.gemBoost.name') });
      } else {
        const amt = 1 + Math.floor(Math.random() * 3); // 1 to 3
        const inv = getShopInventory();
        inv.continueToken = (inv.continueToken ?? 0) + amt;
        localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
        rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.continueToken.name') });
      }
    } else {
      // Gold chest
      const skinRoll = Math.random();
      if (skinRoll < 0.03) {
        // 3% rare chance to win Moorish Idol Legendary skin!
        const unlockedSkins = getUnlockedSkins();
        if (unlockedSkins.includes('legendary')) {
          // Compensation rewards
          addCoins(600);
          const inv = getShopInventory();
          inv.shield = (inv.shield ?? 0) + 2;
          inv.continueToken = (inv.continueToken ?? 0) + 1;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          rewardText = t('shop.duplicateLegendary');
        } else {
          // Unlock skin
          const updated = [...unlockedSkins, 'legendary' as SkinId];
          localStorage.setItem('gfr_unlocked_skins', JSON.stringify(updated));
          rewardText = t('shop.legendaryUnlock');
          if (onNewUnlocks) {
            onNewUnlocks(['legendary']);
          }
        }
      } else {
        // Roll standard Gold chest prizes
        const roll = Math.random();
        if (roll < 0.25) {
          const rewardCoins = 300 + Math.floor(Math.random() * 451); // 300 to 750 coins
          addCoins(rewardCoins);
          rewardText = t('shop.wonCoins', { coins: rewardCoins });
        } else if (roll < 0.5) {
          const amt = 5 + Math.floor(Math.random() * 6); // 5 to 10
          const inv = getShopInventory();
          inv.shield = (inv.shield ?? 0) + amt;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.shield.name') });
        } else if (roll < 0.7) {
          const amt = 3 + Math.floor(Math.random() * 6); // 3 to 8
          const inv = getShopInventory();
          inv.magnet = (inv.magnet ?? 0) + amt;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.magnet.name') });
        } else if (roll < 0.88) {
          const amt = 3 + Math.floor(Math.random() * 6); // 3 to 8
          const inv = getShopInventory();
          inv.gemBoost = (inv.gemBoost ?? 0) + amt;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.gemBoost.name') });
        } else {
          const amt = 2 + Math.floor(Math.random() * 4); // 2 to 5
          const inv = getShopInventory();
          inv.continueToken = (inv.continueToken ?? 0) + amt;
          localStorage.setItem('gfr_shop_inventory', JSON.stringify(inv));
          rewardText = t('shop.wonItem', { count: amt, item: t('shop.item.continueToken.name') });
        }
      }
    }

    setCoins(getCoins());
    setMessage(t('shop.chestOpened', { reward: rewardText }));
  };

  const getOwned = (id: ShopItemId) => getShopItemCount(id);

  return (
    <div className="screen shop-screen" style={{ paddingTop: 'max(50px, env(safe-area-inset-top) + 20px)' }}>
      <div className="shop-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <h2 className="screen-title">{t('shop.lockerTitle')}</h2>
      </div>

      {/* Large visual coin balance */}
      <div className="shop-coins-balance">
        <span className="coin-label-large">{t('common.coins')}</span>
        <span className="coin-value-large">{coins}</span>
      </div>

      {/* Modern responsive tabs */}
      <div className="shop-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '0 10px' }}>
        <button
          className={`btn ${activeTab === 'powerups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('powerups')}
        >
          {t('shop.consumables')}
        </button>
        <button
          className={`btn ${activeTab === 'upgrades' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('upgrades')}
        >
          {t('shop.upgrades')}
        </button>
        <button
          className={`btn ${activeTab === 'chests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('chests')}
        >
          {t('shop.chests')}
        </button>
        <button
          className={`btn ${activeTab === 'missions' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 2px', fontSize: '11px' }}
          onClick={() => setActiveTab('missions')}
        >
          {t('shop.missions')}
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
                <div className="shop-item-title">{t(item.nameKey)}</div>
                <div className="shop-item-desc">{t(item.descriptionKey)}</div>
                <div className="shop-item-meta">
                  <div className="shop-price">🪙 {item.cost}</div>
                  <div className="shop-owned">{t('shop.owned', { count: owned })}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  onClick={() => handleBuyPowerup(item)}
                  disabled={!canBuy}
                >
                  {canBuy ? t('shop.buy') : needed > 0 ? t('shop.needMore', { count: needed }) : t('shop.notEnough')}
                </button>
              </div>
            );
          })}

        {activeTab === 'upgrades' &&
          UPGRADE_ITEMS.map((item) => {
            const currentLvl = getUpgradeLevel(item.id);
            const maxLevel = item.id === 'shield' ? 1 : 5;
            const cost = (currentLvl + 1) * item.baseCost;
            const canBuy = coins >= cost && currentLvl < maxLevel;
            const isMax = currentLvl >= maxLevel;
            const needed = cost - coins;

            return (
              <div key={item.id} className="shop-item-card">
                <div className="shop-item-title">
                  {t(item.nameKey)} <span style={{ color: '#ffd54f', fontSize: '12px' }}>({t('shop.level', { level: Math.min(currentLvl, maxLevel), max: maxLevel })})</span>
                </div>
                <div className="shop-item-desc">{t(item.descriptionKey)}</div>

                {/* Level indicator ticks */}
                <div style={{ display: 'flex', gap: '4px', margin: '8px 0' }}>
                  {Array.from({ length: maxLevel }).map((_, idx) => (
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
                  <div className="shop-price">{isMax ? t('shop.maxedLabel') : `🪙 ${cost}`}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  onClick={() => handleBuyUpgrade(item)}
                  disabled={!canBuy || isMax}
                >
                  {isMax ? t('shop.fullyUpgraded') : canBuy ? t('shop.upgrade') : needed > 0 ? t('shop.needMore', { count: needed }) : t('shop.notEnough')}
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
                <div className="shop-item-title" style={{ color: item.color }}>{t(item.nameKey)}</div>
                <div className="shop-item-desc">{t(item.descriptionKey)}</div>
                <div className="shop-item-meta">
                  <div className="shop-price">🪙 {item.cost}</div>
                </div>
                <button
                  className="shop-buy-btn"
                  style={{ background: `linear-gradient(135deg, ${item.color}, #ffffff)` }}
                  onClick={() => handleOpenChest(item.tier, item.cost)}
                  disabled={!canBuy}
                >
                  {canBuy ? t('shop.openChest') : needed > 0 ? t('shop.needMore', { count: needed }) : t('shop.notEnough')}
                </button>
              </div>
            );
          })}

        {activeTab === 'missions' &&
          missions.map((m) => {
            const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
            return (
              <div key={m.id} className="shop-item-card" style={{ padding: '14px' }}>
                <div className="shop-item-title" style={{ fontSize: '14px' }}>{translateMission(m.id, language)}</div>

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
                    {t('shop.reward', { coins: m.rewardCoins, xp: m.rewardXP })}
                  </div>

                  <button
                    className="shop-buy-btn"
                    style={{ margin: 0, padding: '6px 14px', fontSize: '12px', backgroundColor: m.claimed ? 'rgba(255,255,255,0.12)' : m.completed ? '#4caf50' : 'rgba(255,255,255,0.06)' }}
                    onClick={() => handleClaimReward(m.id)}
                    disabled={!m.completed || m.claimed}
                  >
                    {m.claimed ? t('rewards.claimed') : m.completed ? t('common.claim') : t('shop.inProgress')}
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      <div className="shop-footer">
        <p className="shop-note">
          {activeTab === 'upgrades'
            ? t('shop.footerUpgrades')
            : activeTab === 'chests'
            ? t('shop.footerChests')
            : activeTab === 'missions'
            ? t('shop.footerMissions')
            : t('shop.footerPowerups')}
        </p>
      </div>
    </div>
  );
}
