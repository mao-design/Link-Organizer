import React, { useState, useEffect } from 'react'
import type { ImportResult } from '../../types'

interface ImportModalProps {
  onClose: () => void
  onImported: () => void
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [importType, setImportType] = useState<'html' | 'md' | 'chrome' | 'edge' | 'firefox' | 'manual'>('html')
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ success: number; failed: number } | null>(null)
  const [manualUrls, setManualUrls] = useState('')

  // 加载上次导入类型
  useEffect(() => {
    window.electron.app.getLastImportType().then(type => {
      if (type) setImportType(type as any)
    }).catch(() => {})
  }, [])

  const handleImportTypeChange = (type: 'html' | 'md' | 'chrome' | 'edge' | 'firefox' | 'manual') => {
    setImportType(type)
    window.electron.app.setLastImportType(type).catch(() => {})
  }

  const handleFileImport = async () => {
    try {
      setIsImporting(true)

      const filePath = await selectFile()
      if (!filePath) {
        setIsImporting(false)
        return
      }

      const result = await window.electron.bookmarks.parseHTML(filePath)

      if (result.success && result.links.length > 0) {
        await saveImportedData(result)
        setImportStatus({ success: result.importedCount, failed: result.failedCount })
      } else {
        alert('导入失败：未找到有效的书签数据')
      }
    } catch (error) {
      console.error('Import error:', error)
      alert(`导入失败: ${error}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleMdImport = async () => {
    try {
      setIsImporting(true)

      const filePath = await selectMdFile()
      if (!filePath) {
        setIsImporting(false)
        return
      }

      const result = await window.electron.bookmarks.parseMD(filePath)

      if (result.success && result.links.length > 0) {
        await saveImportedData(result)
        setImportStatus({ success: result.importedCount, failed: result.failedCount })
      } else {
        alert('导入失败：未找到有效的书签数据')
      }
    } catch (error) {
      console.error('MD import error:', error)
      alert(`导入失败: ${error}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleBrowserImport = async (browser: 'chrome' | 'edge' | 'firefox') => {
    try {
      setIsImporting(true)

      let result: ImportResult

      switch (browser) {
        case 'chrome':
          result = await window.electron.bookmarks.readChrome()
          break
        case 'edge':
          result = await window.electron.bookmarks.readEdge()
          break
        case 'firefox':
          result = await window.electron.bookmarks.readFirefox()
          break
      }

      if (result.success && result.links.length > 0) {
        await saveImportedData(result)
        setImportStatus({ success: result.importedCount, failed: result.failedCount })
      } else {
        const browserName = browser === 'chrome' ? 'Chrome' : browser === 'edge' ? 'Edge' : 'Firefox'
        alert(`无法读取 ${browserName} 书签。${result.errors?.[0]?.reason || '请确保浏览器已关闭。'}`)
      }
    } catch (error) {
      console.error('Browser import error:', error)
      alert(`导入失败: ${error}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleManualImport = async () => {
    if (!manualUrls.trim()) {
      alert('请输入至少一个URL')
      return
    }

    try {
      setIsImporting(true)

      const urls = manualUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0)

      for (const url of urls) {
        try {
          new URL(url) // Validate URL
          await window.electron.links.create({
            url,
            title: url,
            description: '',
            favicon: null,
            tags: [],
            folderId: null
          })
        } catch (e) {
          console.warn(`Invalid URL skipped: ${url}`)
        }
      }

      await onImported()
    } catch (error) {
      console.error('Manual import error:', error)
      alert('导入失败')
    } finally {
      setIsImporting(false)
    }
  }

  async function selectFile(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.html,.htm'
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          resolve((file as File & { path?: string }).path || null)
        } else {
          resolve(null)
        }
      }
      input.click()
    })
  }

  async function selectMdFile(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown'
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          resolve((file as File & { path?: string }).path || null)
        } else {
          resolve(null)
        }
      }
      input.click()
    })
  }

  async function saveImportedData(result: ImportResult) {
    // 清空旧数据
    await window.electron.links.clearAll()

    // 建立旧 ID → 新 ID 的映射
    const idMap = new Map<string, string>()

    // 先按层级排序文件夹（确保父文件夹先创建）
    function getDepth(folder: typeof result.folders[0]): number {
      let depth = 0
      let current = folder
      while (current.parentId) {
        depth++
        const parent = result.folders.find(f => f.id === current.parentId)
        if (!parent) break
        current = parent
      }
      return depth
    }

    const sortedFolders = [...result.folders].sort((a, b) => getDepth(a) - getDepth(b))

    // 保存文件夹
    for (const folder of sortedFolders) {
      try {
        // 将 parentId 映射到新的 ID
        const newParentId = folder.parentId ? (idMap.get(folder.parentId) || null) : null
        const newFolder = await window.electron.folders.create({
          name: folder.name,
          parentId: newParentId,
          order: folder.order
        })
        // 记录旧 ID → 新 ID
        idMap.set(folder.id, newFolder.id)
      } catch (e) {
        console.warn('Failed to create folder:', e)
      }
    }

    // 保存链接，用映射后的 folderId
    for (const link of result.links) {
      try {
        const mappedFolderId = link.folderId ? (idMap.get(link.folderId) || null) : null

        await window.electron.links.create({
          url: link.url,
          title: link.title,
          description: link.description || '',
          favicon: link.favicon,
          tags: link.tags || [],
          folderId: mappedFolderId
        })
      } catch (e) {
        console.warn('Failed to create link:', e)
      }
    }

    await onImported()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导入书签</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {importStatus ? (
            <div className="import-success">
              <p className="success-icon">✓</p>
              <h3>导入完成！</h3>
              <p>成功导入 {importStatus.success} 个链接</p>
              {importStatus.failed > 0 && (
                <p className="warning">跳过 {importStatus.failed} 个无效链接</p>
              )}
              <button className="primary" onClick={onImported}>
                完成
              </button>
            </div>
          ) : (
            <>
              <div className="import-options">
                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="html"
                    checked={importType === 'html'}
                    onChange={() => handleImportTypeChange('html')}
                  />
                  <span>从 HTML 文件导入</span>
                </label>

                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="md"
                    checked={importType === 'md'}
                    onChange={() => handleImportTypeChange('md')}
                  />
                  <span>从 Markdown 文件导入</span>
                </label>

                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="chrome"
                    checked={importType === 'chrome'}
                    onChange={() => handleImportTypeChange('chrome')}
                  />
                  <span>从 Chrome 导入</span>
                </label>

                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="edge"
                    checked={importType === 'edge'}
                    onChange={() => handleImportTypeChange('edge')}
                  />
                  <span>从 Edge 导入</span>
                </label>

                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="firefox"
                    checked={importType === 'firefox'}
                    onChange={() => handleImportTypeChange('firefox')}
                  />
                  <span>从 Firefox 导入</span>
                </label>

                <label className="import-option">
                  <input
                    type="radio"
                    name="importType"
                    value="manual"
                    checked={importType === 'manual'}
                    onChange={() => handleImportTypeChange('manual')}
                  />
                  <span>手动输入 URL</span>
                </label>
              </div>

              <div className="import-action">
                {importType === 'html' && (
                  <button
                    className="primary"
                    onClick={handleFileImport}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '选择 HTML 文件'}
                  </button>
                )}

                {importType === 'md' && (
                  <button
                    className="primary"
                    onClick={handleMdImport}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '选择 Markdown 文件'}
                  </button>
                )}

                {importType === 'chrome' && (
                  <button
                    className="primary"
                    onClick={() => handleBrowserImport('chrome')}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '从 Chrome 导入'}
                  </button>
                )}

                {importType === 'edge' && (
                  <button
                    className="primary"
                    onClick={() => handleBrowserImport('edge')}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '从 Edge 导入'}
                  </button>
                )}

                {importType === 'firefox' && (
                  <button
                    className="primary"
                    onClick={() => handleBrowserImport('firefox')}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '从 Firefox 导入'}
                  </button>
                )}

                {importType === 'manual' && (
                  <div className="manual-input">
                    <textarea
                      placeholder="每行一个 URL，例如：&#10;https://example.com&#10;https://github.com"
                      value={manualUrls}
                      onChange={(e) => setManualUrls(e.target.value)}
                      rows={8}
                    />
                    <button
                      className="primary"
                      onClick={handleManualImport}
                      disabled={isImporting || !manualUrls.trim()}
                    >
                      {isImporting ? '导入中...' : '导入'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportModal
