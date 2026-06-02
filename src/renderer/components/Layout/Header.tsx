import React, { useState, useRef, useEffect } from 'react'
import logoImg from '../../ico/ico.png'

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onAISettings: () => void
  onAIOrganize: () => void
  onAIRestore?: () => void
  onDismissBackup?: () => void
  hasAIBackup?: boolean
  isAIOrganizing?: boolean
  aiProgress?: { current: number; total: number; phase: string; message: string } | null
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  accentColor: string
  onAccentColorChange: (color: string) => void
}

const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onAISettings,
  onAIOrganize,
  onAIRestore,
  onDismissBackup,
  hasAIBackup,
  isAIOrganizing,
  aiProgress,
  theme,
  onThemeToggle,
  accentColor,
  onAccentColorChange
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [tempColor, setTempColor] = useState(accentColor)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColorPicker])

  const openPicker = () => {
    setTempColor(accentColor)
    setShowColorPicker(true)
  }

  const confirmColor = () => {
    onAccentColorChange(tempColor)
    setShowColorPicker(false)
  }

  const cancelPicker = () => {
    setShowColorPicker(false)
  }

  const presetColors = ['#5b9bd5', '#27ae60', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db']

  return (
    <header className="header">
      <div className="header-left">
        <img src={logoImg} alt="Logo" className="app-logo" />
        <h1>Link Organizer</h1>
      </div>
      <div className="header-right">
        <input
          type="text"
          placeholder="搜索链接..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="color-picker-wrapper" ref={pickerRef}>
          <button
            onClick={openPicker}
            title="主题颜色"
            className="color-btn"
            style={{ backgroundColor: accentColor }}
          >
            🎨
          </button>
          {showColorPicker && (
            <div className="color-picker-dropdown">
              <div className="color-picker-row">
                <input
                  type="color"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  title="调色板"
                />
                <input
                  type="text"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  placeholder="#5b9bd5"
                  maxLength={7}
                />
              </div>
              <div className="color-presets">
                {presetColors.map(c => (
                  <button
                    key={c}
                    className={`color-preset ${tempColor === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setTempColor(c)}
                    title={c}
                  />
                ))}
              </div>
              <div className="color-picker-actions">
                <button onClick={cancelPicker}>取消</button>
                <button className="primary" onClick={confirmColor}>确定</button>
              </div>
            </div>
          )}
        </div>
        <button onClick={onAIOrganize} title="AI智能整理" disabled={isAIOrganizing}>
          {isAIOrganizing ? '⏳ 整理中...' : '🤖 整理'}
        </button>
        {isAIOrganizing && aiProgress && (
          <span className="ai-progress-text" title={aiProgress.message}>
            {aiProgress.current}/{aiProgress.total}
          </span>
        )}
        {hasAIBackup && onAIRestore && (
          <div className="restore-btn-wrapper">
            <button onClick={onAIRestore} title="撤销AI整理，还原到整理前" className="restore-btn">
              ↩ 撤销整理
            </button>
            {onDismissBackup && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismissBackup() }}
                title="删除备份"
                className="restore-close-btn"
              >
                ×
              </button>
            )}
          </div>
        )}
        <button onClick={onAISettings} title="AI设置">
          AI 设置
        </button>
        <button onClick={onThemeToggle} title="切换主题" className="theme-toggle-btn">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}

export default Header
