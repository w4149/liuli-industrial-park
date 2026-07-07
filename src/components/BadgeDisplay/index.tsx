import React from 'react'
import { Badge } from '@/types'
import './index.scss'

interface BadgeDisplayProps {
  badges: Badge[]
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badges }) => {
  const rarityColors: Record<string, string> = {
    common: '#999999',
    rare: '#4facfe',
    legendary: '#ffd700',
  }

  const rarityLabels: Record<string, string> = {
    common: '普通',
    rare: '稀有',
    legendary: '传说',
  }

  return (
    <div className="badge-display">
      <h2 className="display-title">我的徽章</h2>
      
      {badges.length === 0 ? (
        <p className="empty-message">还没有获得徽章，快去探索园区吧！</p>
      ) : (
        <div className="badges-grid">
          {badges.map((badge) => (
            <div key={badge.id} className="badge-item">
              <div className="badge-icon" style={{ backgroundColor: rarityColors[badge.rarity] }}>
                <span>🏅</span>
              </div>
              <h3 className="badge-name">{badge.name}</h3>
              <span className="badge-rarity">{rarityLabels[badge.rarity]}</span>
              <p className="badge-description">{badge.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BadgeDisplay
