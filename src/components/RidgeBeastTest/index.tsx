import React, { useState } from 'react'
import { RidgeBeastPersonality } from '@/types'
import { BEAST_QUESTIONS } from '@/data/ridgeBeasts'
import { buildPersonality } from '@/utils/beastMatch'
import './index.scss'

interface RidgeBeastTestProps {
  onComplete: (personality: RidgeBeastPersonality) => void
}

const OPTION_KEYS = ['A', 'B', 'C', 'D']

const RidgeBeastTest: React.FC<RidgeBeastTestProps> = ({ onComplete }) => {
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<number[]>(() => Array(BEAST_QUESTIONS.length).fill(-1))

  const handleSelect = (optionIndex: number) => {
    const next = [...answers]
    next[current] = optionIndex
    setAnswers(next)
  }

  const handleNext = () => {
    if (current < BEAST_QUESTIONS.length - 1) {
      setCurrent(current + 1)
    } else {
      onComplete(buildPersonality(answers))
    }
  }

  const handlePrev = () => {
    if (current > 0) {
      setCurrent(current - 1)
    }
  }

  if (!started) {
    return (
      <div className="ridge-beast-test">
        <div className="test-intro">
          <div className="intro-emblem">🏯</div>
          <h2 className="intro-title">脊兽人格测试</h2>
          <p className="intro-subtitle">太和殿垂脊十兽 · 十种人格原型</p>
          <p className="intro-text">
            紫禁城太和殿的垂脊上，立着中国古建规格最高的十尊琉璃脊兽——
            龙、凤、狮子、天马、海马、狻猊、狎鱼、獬豸、斗牛、行什。
            它们各司其职，护佑殿宇六百年。
          </p>
          <p className="intro-text">
            回答 10 道园区情境题，找到屋脊上属于你的那尊脊兽。
          </p>
          <button className="intro-start-btn" onClick={() => setStarted(true)}>
            开始测试
          </button>
        </div>
      </div>
    )
  }

  const question = BEAST_QUESTIONS[current]
  const selected = answers[current]

  return (
    <div className="ridge-beast-test">
      <div className="test-header">
        <span className="progress">
          {current + 1} / {BEAST_QUESTIONS.length}
        </span>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((current + 1) / BEAST_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="question-card">
        <p className="question-text">{question.question}</p>

        <div className="options-list">
          {question.options.map((option, index) => (
            <button
              key={index}
              className={`option-btn ${selected === index ? 'selected' : ''}`}
              onClick={() => handleSelect(index)}
            >
              <span className="option-key">{OPTION_KEYS[index]}</span>
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-buttons">
          <button className="nav-btn" onClick={handlePrev} disabled={current === 0}>
            上一题
          </button>
          <button className="nav-btn primary" onClick={handleNext} disabled={selected < 0}>
            {current === BEAST_QUESTIONS.length - 1 ? '揭晓脊兽' : '下一题'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RidgeBeastTest
