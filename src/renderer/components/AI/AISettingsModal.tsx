import React, { useState, useEffect } from 'react'
import type { AIConfig } from '../../types'

interface AISettingsModalProps {
  onClose: () => void
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    baseUrl: '',
    temperature: 0.7,
    maxTokens: 1000
  })
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const savedConfig = await window.electron.ai.getConfig()
      if (savedConfig) {
        setConfig(savedConfig)
      }
    } catch (error) {
      console.error('Failed to load AI config:', error)
    }
  }

  async function handleTestConnection() {
    if (!config.apiKey) {
      alert('请先输入 API Key')
      return
    }

    try {
      setIsTesting(true)
      setTestResult(null)

      // Save config first
      await window.electron.ai.configure(config)

      const result = await window.electron.ai.testConnection()
      setTestResult(result)
    } catch (error) {
      console.error('Test connection failed:', error)
      setTestResult(false)
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSave() {
    if (!config.apiKey) {
      alert('请输入 API Key')
      return
    }

    try {
      setIsSaving(true)
      await window.electron.ai.configure(config)
      onClose()
    } catch (error) {
      console.error('Failed to save AI config:', error)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'custom', label: 'DeepSeek' },
    { value: 'custom', label: '自定义' }
  ]

  const getModelPlaceholder = () => {
    switch (config.provider) {
      case 'openai': return 'gpt-4 或 gpt-3.5-turbo'
      case 'anthropic': return 'claude-3-opus-20240229'
      default: return 'deepseek-chat'
    }
  }

  const getDefaultModel = () => {
    switch (config.provider) {
      case 'openai': return 'gpt-4'
      case 'anthropic': return 'claude-3-sonnet-20240229'
      default: return 'deepseek-chat'
    }
  }

  const handleProviderChange = (provider: AIConfig['provider']) => {
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4',
      anthropic: 'claude-3-sonnet-20240229',
      custom: 'deepseek-chat'
    }
    const defaultUrls: Record<string, string> = {
      openai: '',
      anthropic: '',
      custom: 'https://api.deepseek.com/v1/chat/completions'
    }
    setConfig(prev => ({
      ...prev,
      provider,
      model: defaultModels[provider] || '',
      baseUrl: defaultUrls[provider] || prev.baseUrl || ''
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>AI 智能整理设置</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Provider Selection */}
          <div className="form-section">
            <h3>AI 提供商</h3>
            <div className="provider-options">
              {providerOptions.map(option => (
                <label key={option.value} className="provider-option">
                  <input
                    type="radio"
                    name="provider"
                    value={option.value}
                    checked={config.provider === option.value}
                    onChange={() => handleProviderChange(option.value as AIConfig['provider'])}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* API Configuration */}
          <div className="form-section">
            <h3>API 配置</h3>

            <div className="form-group">
              <label htmlFor="apiKey">API Key</label>
              <input
                type="password"
                id="apiKey"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="输入您的 API Key"
              />
              <p className="form-hint">
                API Key 将加密存储在本地，不会上传到我们的服务器
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="baseUrl">API 端点 URL{config.provider === 'custom' ? '' : '（可选）'}</label>
              <input
                type="text"
                id="baseUrl"
                value={config.baseUrl || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder={config.provider === 'custom' ? 'https://api.deepseek.com/v1/chat/completions' : '默认 OpenAI/Anthropic 官方地址'}
              />
              {config.provider === 'custom' && (
                <p className="form-hint">DeepSeek 使用 OpenAI 兼容 API，已自动填入默认地址</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="model">模型</label>
              <input
                type="text"
                id="model"
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder={getModelPlaceholder()}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="temperature">Temperature ({config.temperature})</label>
                <input
                  type="range"
                  id="temperature"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
                <p className="form-hint">较低的值更确定性，较高的值更有创造性</p>
              </div>

              <div className="form-group">
                <label htmlFor="maxTokens">最大 Token ({config.maxTokens})</label>
                <input
                  type="number"
                  id="maxTokens"
                  min="100"
                  max="4000"
                  step="100"
                  value={config.maxTokens}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Test Connection */}
          {testResult !== null && (
            <div className={`test-result ${testResult ? 'success' : 'error'}`}>
              {testResult ? (
                <p>✓ 连接成功！API 配置正确。</p>
              ) : (
                <p>✕ 连接失败。请检查 API Key 和网络连接。</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !config.apiKey}
            >
              {isTesting ? '测试中...' : '测试连接'}
            </button>
            <div className="modal-actions-right">
              <button onClick={onClose}>取消</button>
              <button
                className="primary"
                onClick={handleSave}
                disabled={isSaving || !config.apiKey}
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AISettingsModal
