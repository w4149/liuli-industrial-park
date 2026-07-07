import React, { useState } from 'react'
import { InspirationMessage } from '@/types'
import './index.scss'

interface InspirationBoardProps {
  messages: InspirationMessage[]
  onLike?: (messageId: string) => void
  onAdopt?: (messageId: string) => void
  onAddMessage?: (content: string) => void
}

const InspirationBoard: React.FC<InspirationBoardProps> = ({
  messages,
  onLike,
  onAdopt,
  onAddMessage,
}) => {
  const [newMessage, setNewMessage] = useState('')

  const handleSubmit = () => {
    if (newMessage.trim() && onAddMessage) {
      onAddMessage(newMessage.trim())
      setNewMessage('')
    }
  }

  return (
    <div className="inspiration-board">
      <h2 className="board-title">灵感留言板</h2>

      <div className="input-section">
        <textarea
          className="message-input"
          placeholder="留下你的灵感建议..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button className="submit-btn" onClick={handleSubmit}>
          发布
        </button>
      </div>

      <div className="messages-list">
        {messages.length === 0 ? (
          <p className="empty-message">还没有灵感留言，快来分享你的创意吧！</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="message-item">
              <p className="message-content">{message.content}</p>
              <div className="message-meta">
                <span className="meta-item">
                  <span className="icon">❤️</span> {message.likes}
                </span>
                <span className="meta-item">
                  <span className="icon">✨</span> {message.adoptions}
                </span>
                <span className="meta-item">
                  {new Date(message.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="message-actions">
                <button className="action-btn like-btn" onClick={() => onLike?.(message.id)}>
                  点赞
                </button>
                <button className="action-btn adopt-btn" onClick={() => onAdopt?.(message.id)}>
                  采纳
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default InspirationBoard
