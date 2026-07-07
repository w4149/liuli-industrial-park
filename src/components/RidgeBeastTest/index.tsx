import React, { useState } from 'react'
import { RidgeBeastPersonality } from '@/types'
import './index.scss'

interface RidgeBeastTestProps {
  onComplete: (personality: RidgeBeastPersonality) => void
}

const QUESTIONS = [
  {
    id: 'q1',
    question: '你更倾向于在园区中如何探索？',
    options: [
      { key: 'A', label: '有明确目标，直奔主题' },
      { key: 'B', label: '随兴所至，发现惊喜' },
      { key: 'C', label: '仔细观察，深入了解' },
      { key: 'D', label: '快速浏览，多看多走' },
    ],
  },
  {
    id: 'q2',
    question: '当你遇到一个有趣的灵感留言，你会？',
    options: [
      { key: 'E', label: '默默阅读，不予置评' },
      { key: 'F', label: '点赞表示认可' },
      { key: 'G', label: '采纳并尝试' },
      { key: 'H', label: '留下自己的见解' },
    ],
  },
  {
    id: 'q3',
    question: '你更喜欢哪种类型的展品？',
    options: [
      { key: 'I', label: '历史悠久的文物' },
      { key: 'J', label: '现代创意作品' },
      { key: 'A', label: '实用功能型展品' },
      { key: 'B', label: '艺术观赏型展品' },
    ],
  },
  {
    id: 'q4',
    question: '在团队合作中，你通常是？',
    options: [
      { key: 'C', label: '领导者，指引方向' },
      { key: 'D', label: '执行者，高效完成' },
      { key: 'E', label: '创意者，提供想法' },
      { key: 'F', label: '协调者，调和各方' },
    ],
  },
]

const RidgeBeastTest: React.FC<RidgeBeastTestProps> = ({ onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [personality, setPersonality] = useState<RidgeBeastPersonality | null>(null)

  const handleSelect = (optionKey: string) => {
    const questionId = QUESTIONS[currentQuestion].id
    setAnswers({ ...answers, [questionId]: optionKey })
  }

  const handleNext = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResult(true)
      const mockPersonality: RidgeBeastPersonality = {
        type: '龙',
        traits: ['威严', '智慧', '领导力'],
        description: '你如同传说中的龙，拥有强大的领导力和智慧，是团队中的核心人物。',
        customized_image: '',
      }
      setPersonality(mockPersonality)
      onComplete(mockPersonality)
    }
  }

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  if (showResult && personality) {
    return (
      <div className="test-result">
        <div className="result-card">
          <div className="beast-icon">
            <span>{personality.type}</span>
          </div>
          <h2 className="beast-title">你的脊兽人格是：{personality.type}</h2>
          <div className="traits-list">
            {personality.traits.map((trait, index) => (
              <span key={index} className="trait-tag">{trait}</span>
            ))}
          </div>
          <p className="beast-description">{personality.description}</p>
        </div>
      </div>
    )
  }

  const question = QUESTIONS[currentQuestion]
  const selectedAnswer = answers[question.id]

  return (
    <div className="ridge-beast-test">
      <div className="test-header">
        <span className="progress">
          {currentQuestion + 1} / {QUESTIONS.length}
        </span>
        <h2 className="test-title">脊兽人格测试</h2>
      </div>

      <div className="question-card">
        <p className="question-text">{question.question}</p>

        <div className="options-list">
          {question.options.map((option) => (
            <button
              key={option.key}
              className={`option-btn ${selectedAnswer === option.key ? 'selected' : ''}`}
              onClick={() => handleSelect(option.key)}
            >
              <span className="option-key">{option.key}</span>
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-buttons">
          <button
            className="nav-btn"
            onClick={handlePrev}
            disabled={currentQuestion === 0}
          >
            上一题
          </button>
          <button
            className="nav-btn primary"
            onClick={handleNext}
            disabled={!selectedAnswer}
          >
            {currentQuestion === QUESTIONS.length - 1 ? '查看结果' : '下一题'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RidgeBeastTest
