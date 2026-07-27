import React, { useState } from 'react'
import { Badge } from '@/types'
import './index.scss'

interface BadgeDisplayProps {
  badges: Badge[]
  earnedIds?: string[]
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badges, earnedIds }) => {
  const earnedSet = new Set(earnedIds || [])
  // 默认收起，避免个人主页过长
  const [expanded, setExpanded] = useState(false)
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

  const earnedCount = badges.filter((b) => earnedSet.has(b.id)).length

  return (
    <div className="badge-display">
      <div className="display-header" onClick={() => setExpanded(!expanded)}>
        <h2 className="display-title">我的徽章 <span className="badge-count">{earnedCount}/{badges.length}</span></h2>
        <span className="display-toggle">{expanded ? '收起 ▴' : '展开 ▾'}</span>
      </div>

      {expanded && (badges.length === 0 ? (
        <p className="empty-message">还没有获得徽章，快去探索园区吧！</p>
      ) : (
        <div className="badges-grid">
          {badges.map((badge) => {
            const earned = earnedSet.has(badge.id)
            return (
              <div key={badge.id} className={`badge-item ${earned ? 'earned' : 'locked'}`}>
                <div
                  className="badge-icon"
                  style={{ backgroundColor: earned ? rarityColors[badge.rarity] : '#e0e0e0' }}
                >
                  <span>{earned ? (badge.pixel_image || '🏅') : '🔒'}</span>
                </div>
                <h3 className="badge-name">{badge.name}</h3>
                <span
                  className="badge-rarity"
                  style={{ backgroundColor: earned ? rarityColors[badge.rarity] : '#bbb' }}
                >
                  {rarityLabels[badge.rarity]}
                </span>
                <p className="badge-description">{earned ? badge.description : '尚未解锁：' + badge.description}</p>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default BadgeDisplay
