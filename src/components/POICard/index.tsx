import React from 'react'
import { POI } from '@/types'
import './index.scss'

interface POICardProps {
  poi: POI
  onViewInspiration?: () => void
  onStartQuiz?: () => void
}

const POICard: React.FC<POICardProps> = ({ poi, onViewInspiration, onStartQuiz }) => {
  const typeLabels: Record<string, string> = {
    exhibit: '展品',
    interactive: '互动点',
    landmark: '地标',
    shop: '商店',
  }

  const typeColors: Record<string, string> = {
    exhibit: '#667eea',
    interactive: '#f093fb',
    landmark: '#4facfe',
    shop: '#43e97b',
  }

  return (
    <div className="poi-card">
      <div className="poi-header">
        <span className="poi-type" style={{ backgroundColor: typeColors[poi.type] }}>
          {typeLabels[poi.type]}
        </span>
        <h2 className="poi-name">{poi.name}</h2>
      </div>

      <p className="poi-description">{poi.description}</p>

      {poi.interactions.length > 0 && (
        <div className="poi-interactions">
          <h3>互动内容</h3>
          {poi.interactions.map((interaction) => (
            <div key={interaction.id} className="interaction-item">
              <span className="interaction-type">
                {interaction.type === 'guide' && '导览'}
                {interaction.type === 'achievement' && '成就'}
                {interaction.type === 'hidden' && '隐藏'}
              </span>
              <p>{interaction.content}</p>
              {interaction.reward && (
                <span className="reward">奖励: +{interaction.reward.value}灵感值</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="poi-actions">
        {poi.type === 'interactive' && onViewInspiration && (
          <button className="btn-primary" onClick={onViewInspiration}>
            查看灵感留言
          </button>
        )}
        {poi.type === 'exhibit' && onStartQuiz && (
          <button className="btn-primary" onClick={onStartQuiz}>
            参与答题
          </button>
        )}
      </div>
    </div>
  )
}

export default POICard
