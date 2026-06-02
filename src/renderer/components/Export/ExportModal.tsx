import React, { useState, useEffect } from 'react'
import type { Link, Folder } from '../../types'

interface ExportModalProps {
  links: Link[]
  folders: Folder[]
  accentColor: string
  accentColorLight: string
  accentColorDark: string
  onClose: () => void
}

interface ExportFeatures {
  darkModeToggle: boolean
  searchEnabled: boolean
  backToTopButton: boolean
  sidebarNavigation: boolean
  showFavicons: 'icon' | 'initial' | 'none'
}

const ExportModal: React.FC<ExportModalProps> = ({ links, folders, accentColor, accentColorLight, accentColorDark, onClose }) => {
  const [siteTitle, setSiteTitle] = useState('我的链接收藏')
  const [outputPath, setOutputPath] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ success: boolean; path?: string; error?: string } | null>(null)
  const [logo, setLogo] = useState('')
  const [logoMode, setLogoMode] = useState<'text' | 'image' | 'none'>('none')
  const [favicon, setFavicon] = useState('')
  const [faviconMode, setFaviconMode] = useState<'text' | 'image' | 'none'>('none')
  const [faviconBgColor, setFaviconBgColor] = useState('#5b9bd5')
  const [faviconTextColor, setFaviconTextColor] = useState('#ffffff')

  const [features, setFeatures] = useState<ExportFeatures>({
    darkModeToggle: true,
    searchEnabled: true,
    backToTopButton: true,
    sidebarNavigation: true,
    showFavicons: 'icon'
  })

  // 加载上次的导出偏好
  useEffect(() => {
    window.electron.export.getPrefs().then(prefs => {
      if (prefs) {
        if (prefs.lastExportPath) setOutputPath(prefs.lastExportPath)
        if (prefs.siteTitle) setSiteTitle(prefs.siteTitle)
        if (prefs.logoMode) setLogoMode(prefs.logoMode as 'text' | 'image' | 'none')
        if (prefs.logoValue) setLogo(prefs.logoValue)
        if (prefs.faviconMode) setFaviconMode(prefs.faviconMode as 'text' | 'image' | 'none')
        if (prefs.faviconValue) setFavicon(prefs.faviconValue)
        if (prefs.faviconBgColor) setFaviconBgColor(prefs.faviconBgColor)
        if (prefs.faviconTextColor) setFaviconTextColor(prefs.faviconTextColor)
        if (prefs.showFavicons) setFeatures(prev => ({ ...prev, showFavicons: prefs.showFavicons }))
        setFeatures(prev => ({
          ...prev,
          darkModeToggle: prefs.darkModeToggle ?? true,
          searchEnabled: prefs.searchEnabled ?? true,
          backToTopButton: prefs.backToTopButton ?? true,
          sidebarNavigation: prefs.sidebarNavigation ?? true
        }))
      }
    }).catch(() => {})
  }, [])

  const handleSelectPath = async () => {
    try {
      const path = await window.electron.export.getDefaultPath()
      if (path) setOutputPath(path)
    } catch (error) {
      console.error('Failed to select path:', error)
    }
  }

  const handleExport = async () => {
    if (!outputPath) {
      alert('请选择输出目录')
      return
    }
    if (links.length === 0) {
      alert('没有可导出的链接')
      return
    }

    try {
      setIsExporting(true)

      const plainConfig = JSON.parse(JSON.stringify({
        outputPath,
        siteTitle,
        accentColor,
        accentColorLight,
        accentColorDark,
        logo: logoMode === 'none' ? undefined : logo,
        favicon: faviconMode === 'image' ? favicon : undefined,
        faviconText: faviconMode === 'text' ? favicon : undefined,
        faviconBgColor,
        faviconTextColor,
        features
      }))
      const plainLinks = JSON.parse(JSON.stringify(links))
      const plainFolders = JSON.parse(JSON.stringify(folders))

      const result = await window.electron.export.generate(
        plainConfig,
        plainLinks,
        plainFolders
      )

      setExportResult({
        success: result.success,
        path: result.outputPath,
        error: result.error
      })
    } catch (error) {
      console.error('Export failed:', error)
      setExportResult({ success: false, error: String(error) })
    } finally {
      setIsExporting(false)
    }
  }

  const toggleFeature = (key: keyof ExportFeatures) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 关闭时保存当前偏好
  const handleClose = () => {
    window.electron.export.savePrefs({
      siteTitle,
      logoMode,
      logoValue: logo,
      faviconMode,
      faviconValue: favicon,
      faviconBgColor,
      faviconTextColor,
      showFavicons: features.showFavicons,
      darkModeToggle: features.darkModeToggle,
      searchEnabled: features.searchEnabled,
      backToTopButton: features.backToTopButton,
      sidebarNavigation: features.sidebarNavigation
    }).catch(() => {})
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导出为网站</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {exportResult ? (
            <div className={`export-result ${exportResult.success ? 'success' : 'error'}`}>
              {exportResult.success ? (
                <>
                  <p className="success-icon">✓</p>
                  <h3>导出成功！</h3>
                  <p>网站已生成到: {exportResult.path}</p>
                  <p className="hint">
                    用浏览器打开 <code>index.html</code> 即可查看网站
                  </p>
                </>
              ) : (
                <>
                  <p className="error-icon">✕</p>
                  <h3>导出失败</h3>
                  <p>{exportResult.error}</p>
                </>
              )}
              <div className="export-result-actions">
                <button onClick={handleClose}>关闭</button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-section">
                <h3>网站信息</h3>
                <div className="form-group">
                  <label htmlFor="siteTitle">网站标题</label>
                  <input
                    type="text"
                    id="siteTitle"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder="我的链接收藏"
                  />
                </div>
                <div className="form-group">
                  <label>网站 Logo（可选）</label>
                  <div className="logo-mode-select">
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="logoMode"
                        checked={logoMode === 'none'}
                        onChange={() => setLogoMode('none')}
                      />
                      <span>无 Logo</span>
                    </label>
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="logoMode"
                        checked={logoMode === 'text'}
                        onChange={() => setLogoMode('text')}
                      />
                      <span>文字 Logo</span>
                    </label>
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="logoMode"
                        checked={logoMode === 'image'}
                        onChange={() => setLogoMode('image')}
                      />
                      <span>图片 Logo</span>
                    </label>
                  </div>
                  {logoMode === 'text' && (
                    <input
                      type="text"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                      placeholder="输入文字Logo，如：My Links"
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {logoMode === 'image' && (
                    <input
                      type="text"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                      placeholder="输入图片URL，如：https://example.com/logo.png"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>网站 Favicon（可选，浏览器标签页图标）</label>
                  <div className="logo-mode-select">
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="faviconMode"
                        checked={faviconMode === 'none'}
                        onChange={() => setFaviconMode('none')}
                      />
                      <span>无 Favicon</span>
                    </label>
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="faviconMode"
                        checked={faviconMode === 'text'}
                        onChange={() => setFaviconMode('text')}
                      />
                      <span>文字 Favicon</span>
                    </label>
                    <label className="toggle-item toggle-item--inline">
                      <input
                        type="radio"
                        name="faviconMode"
                        checked={faviconMode === 'image'}
                        onChange={() => setFaviconMode('image')}
                      />
                      <span>图片 Favicon</span>
                    </label>
                  </div>
                  {faviconMode === 'text' && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>文字</label>
                          <input
                            type="text"
                            value={favicon}
                            onChange={(e) => setFavicon(e.target.value)}
                            placeholder="如：如"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>背景色</label>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="color"
                              value={faviconBgColor}
                              onChange={(e) => setFaviconBgColor(e.target.value)}
                              style={{ width: 36, height: 36, padding: 2, cursor: 'pointer' }}
                              title="调色板"
                            />
                            <input
                              type="text"
                              value={faviconBgColor}
                              onChange={(e) => setFaviconBgColor(e.target.value)}
                              placeholder="#5b9bd5"
                              style={{ width: 90, fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>文字颜色</label>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="color"
                              value={faviconTextColor}
                              onChange={(e) => setFaviconTextColor(e.target.value)}
                              style={{ width: 36, height: 36, padding: 2, cursor: 'pointer' }}
                              title="调色板"
                            />
                            <input
                              type="text"
                              value={faviconTextColor}
                              onChange={(e) => setFaviconTextColor(e.target.value)}
                              placeholder="#ffffff"
                              style={{ width: 90, fontSize: 13 }}
                            />
                          </div>
                        </div>
                        {favicon && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>预览</label>
                            <div style={{
                              width: 48, height: 48, borderRadius: 12,
                              backgroundColor: faviconBgColor,
                              color: faviconTextColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 26, fontWeight: 700,
                              border: '2px solid var(--border-color)'
                            }}>
                              {favicon.charAt(0)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {faviconMode === 'image' && (
                    <input
                      type="text"
                      value={favicon}
                      onChange={(e) => setFavicon(e.target.value)}
                      placeholder="输入图片URL，如：https://example.com/favicon.ico"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              </div>

              <div className="form-section">
                <h3>输出位置</h3>
                <div className="form-group form-group--row">
                  <input
                    type="text"
                    value={outputPath}
                    placeholder="选择输出目录..."
                    readOnly
                  />
                  <button onClick={handleSelectPath}>浏览...</button>
                </div>
              </div>

              <div className="form-section">
                <h3>功能选项</h3>
                <div className="feature-toggles">
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={features.darkModeToggle}
                      onChange={() => toggleFeature('darkModeToggle')}
                    />
                    <span>暗夜模式切换</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={features.searchEnabled}
                      onChange={() => toggleFeature('searchEnabled')}
                    />
                    <span>搜索功能</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={features.sidebarNavigation}
                      onChange={() => toggleFeature('sidebarNavigation')}
                    />
                    <span>左侧导航栏</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={features.backToTopButton}
                      onChange={() => toggleFeature('backToTopButton')}
                    />
                    <span>一键置顶按钮</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="radio"
                      name="faviconMode"
                      checked={features.showFavicons === 'icon'}
                      onChange={() => setFeatures(prev => ({ ...prev, showFavicons: 'icon' }))}
                    />
                    <span>显示网站图标（无图标时显示首字母）</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="radio"
                      name="faviconMode"
                      checked={features.showFavicons === 'initial'}
                      onChange={() => setFeatures(prev => ({ ...prev, showFavicons: 'initial' }))}
                    />
                    <span>只显示首字母</span>
                  </label>
                  <label className="toggle-item">
                    <input
                      type="radio"
                      name="faviconMode"
                      checked={features.showFavicons === 'none'}
                      onChange={() => setFeatures(prev => ({ ...prev, showFavicons: 'none' }))}
                    />
                    <span>不显示图标</span>
                  </label>
                </div>
              </div>

              <div className="export-stats">
                <p>即将导出 <strong>{links.length}</strong> 个链接</p>
                {folders.length > 0 && (
                  <p>分布在 <strong>{folders.length}</strong> 个文件夹中</p>
                )}
              </div>

              <div className="modal-actions">
                <button onClick={handleClose}>取消</button>
                <button
                  className="primary"
                  onClick={handleExport}
                  disabled={isExporting || !outputPath}
                >
                  {isExporting ? '生成中...' : '开始导出'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExportModal
