import React, { useState } from 'react'
import './index.scss'

interface QuizModalProps {
  question: string
  options: string[]
  correctAnswer: string
  onAnswer: (isCorrect: boolean) => void
  onClose: () => void
}

const QuizModal: React.FC<QuizModalProps> = ({
  question,
  options,
  correctAnswer,
  onAnswer,
  onClose,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)

  const handleSelect = (answer: string) => {
    if (showResult) return
    setSelectedAnswer(answer)
  }

  const handleSubmit = () => {
    if (!selectedAnswer) return
    const isCorrect = selectedAnswer === correctAnswer
    setShowResult(true)
    onAnswer(isCorrect)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">成就答题</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="quiz-question">
          <p>{question}</p>
        </div>

        <div className="quiz-options">
          {options.map((option, index) => {
            const isSelected = selectedAnswer === option
            const isCorrectOption = option === correctAnswer
            let optionClass = 'option-item'

            if (showResult) {
              if (isCorrectOption) {
                optionClass += ' correct'
              } else if (isSelected && !isCorrectOption) {
                optionClass += ' wrong'
              }
            } else if (isSelected) {
              optionClass += ' selected'
            }

            return (
              <button
                key={index}
                className={optionClass}
                onClick={() => handleSelect(option)}
                disabled={showResult}
              >
                {option}
              </button>
            )
          })}
        </div>

        {showResult ? (
          <div className={`result-message ${selectedAnswer === correctAnswer ? 'success' : 'error'}`}>
            {selectedAnswer === correctAnswer ? (
              <>
                <span className="emoji">🎉</span>
                <p>回答正确！获得徽章奖励！</p>
              </>
            ) : (
              <>
                <span className="emoji">😅</span>
                <p>回答错误，正确答案是：{correctAnswer}</p>
              </>
            )}
          </div>
        ) : (
          <button className="submit-btn" onClick={handleSubmit} disabled={!selectedAnswer}>
            提交答案
          </button>
        )}
      </div>
    </div>
  )
}

export default QuizModal
