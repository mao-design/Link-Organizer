import React, { useState, useEffect } from 'react'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'
import MainContent from './components/Layout/MainContent'
import ImportModal from './components/Import/ImportModal'
import ExportModal from './components/Export/ExportModal'
import AISettingsModal from './components/AI/AISettingsModal'
import EditLinkModal from './components/Link/EditLinkModal'
import type { Link, Folder } from './types'
import './styles/globals.css'

function App() {
  const [links, setLinks] = useState<Link[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 切换文件夹时清空搜索并持久化
  function handleSelectFolder(id: string | null) {
    setSelectedFolderId(id)
    setSearchQuery('')
    localStorage.setItem('app-selected-folder', id ?? '')
  }
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [accentColorLight, setAccentColorLight] = useState('#5b9bd5')
  const [accentColorDark, setAccentColorDark] = useState('#6baae6')
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showAISettingsModal, setShowAISettingsModal] = useState(false)
  const [editingLink, setEditingLink] = useState<Link | null>(null)

  const currentAccentColor = theme === 'dark' ? accentColorDark : accentColorLight

  // Apply accent color
  useEffect(() => {
    const root = document.documentElement
    const color = theme === 'dark' ? accentColorDark : accentColorLight
    root.style.setProperty('--accent-color', color)
    root.style.setProperty('--accent-hover', adjustColor(color, -15))
    localStorage.setItem('app-accent-light', accentColorLight)
    localStorage.setItem('app-accent-dark', accentColorDark)
  }, [accentColorLight, accentColorDark, theme])

  // Load data on mount
  useEffect(() => {
    loadData()
    loadTheme()
  }, [])

  // Apply theme
  useEffect(() => {
    if (!themeLoaded) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    // 同步 localStorage 用于下次启动时立即生效
    localStorage.setItem('app-theme', theme)
    // 持久化主题到 electron-store
    window.electron.app.updateState({ theme, accentColor: accentColorLight, accentColorDark }).catch(() => {})
  }, [theme, themeLoaded])

  async function loadTheme() {
    const localTheme = localStorage.getItem('app-theme')
    if (localTheme === 'dark' || localTheme === 'light') {
      setTheme(localTheme)
    }
    const savedLight = localStorage.getItem('app-accent-light')
    if (savedLight) setAccentColorLight(savedLight)
    const savedDark = localStorage.getItem('app-accent-dark')
    if (savedDark) setAccentColorDark(savedDark)
    try {
      const state = await window.electron.app.getState()
      if (state && (state.theme === 'dark' || state.theme === 'light')) {
        setTheme(state.theme)
        localStorage.setItem('app-theme', state.theme)
      }
      if (state?.accentColor) setAccentColorLight(state.accentColor)
      if (state?.accentColorDark) setAccentColorDark(state.accentColorDark)
    } catch (_) {}
    setThemeLoaded(true)
  }

  async function loadData() {
    try {
      const [loadedLinks, loadedFolders] = await Promise.all([
        window.electron.links.getAll(),
        window.electron.folders.getAll()
      ])
      setLinks(loadedLinks)
      setFolders(loadedFolders)
      // 恢复上次选中的文件夹
      const savedFolderId = localStorage.getItem('app-selected-folder')
      if (savedFolderId && loadedFolders.some(f => f.id === savedFolderId)) {
        setSelectedFolderId(savedFolderId)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  async function handleCreateFolder(name: string, parentId: string | null) {
    try {
      const newFolder = await window.electron.folders.create({
        name,
        parentId,
        order: folders.length
      })
      setFolders([...folders, newFolder])
    } catch (error) {
      console.error('Failed to create folder:', error)
      alert('创建文件夹失败')
    }
  }

  async function handleDeleteFolder(id: string) {
    const idsToDelete = getAllSubFolderIds(id)
    if (!confirm(`确定要删除该文件夹及其所有子文件夹和链接吗？`)) return

    try {
      await window.electron.folders.deleteRecursive(id)
      setFolders(folders.filter(f => !idsToDelete.includes(f.id)))
      setLinks(links.filter(l => !l.folderId || !idsToDelete.includes(l.folderId)))
      if (selectedFolderId && idsToDelete.includes(selectedFolderId)) {
        setSelectedFolderId(null)
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
      alert('删除文件夹失败')
      await loadData()
    }
  }

  async function handleDeleteFolders(ids: string[]) {
    const allIds = new Set<string>()
    for (const id of ids) {
      getAllSubFolderIds(id).forEach(i => allIds.add(i))
    }
    if (!confirm(`确定要删除选中的文件夹及其所有子文件夹和链接吗？`)) return

    try {
      for (const id of ids) {
        await window.electron.folders.deleteRecursive(id)
      }
      setFolders(folders.filter(f => !allIds.has(f.id)))
      setLinks(links.filter(l => !l.folderId || !allIds.has(l.folderId)))
      if (selectedFolderId && allIds.has(selectedFolderId)) {
        setSelectedFolderId(null)
      }
    } catch (error) {
      console.error('Failed to batch delete folders:', error)
      alert('批量删除文件夹失败')
      await loadData()
    }
  }

  async function handleMoveFolders(ids: string[], targetParentId: string | null) {
    try {
      for (const id of ids) {
        await window.electron.folders.move(id, targetParentId)
      }
      setFolders(folders.map(f =>
        ids.includes(f.id) ? { ...f, parentId: targetParentId, updatedAt: Date.now() } : f
      ))
    } catch (error) {
      console.error('Failed to move folders:', error)
      alert('移动文件夹失败')
      await loadData()
    }
  }

  async function handleDeleteLink(id: string) {
    try {
      await window.electron.links.delete(id)
      setLinks(links.filter(l => l.id !== id))
    } catch (error) {
      console.error('Failed to delete link:', error)
      alert('删除链接失败')
    }
  }

  async function handleDeleteLinks(ids: string[]) {
    try {
      await window.electron.links.deleteBatch(ids)
      setLinks(links.filter(l => !ids.includes(l.id)))
    } catch (error) {
      console.error('Failed to batch delete links:', error)
      alert('批量删除失败')
    }
  }

  async function handleMoveLinks(ids: string[], targetFolderId: string | null) {
    try {
      await window.electron.links.moveBatch(ids, targetFolderId)
      setLinks(links.map(l =>
        ids.includes(l.id) ? { ...l, folderId: targetFolderId, updatedAt: Date.now() } : l
      ))
    } catch (error) {
      console.error('Failed to move links:', error)
      alert('移动链接失败')
    }
  }

  function handleEditLink(link: Link) {
    setEditingLink(link)
  }

  async function handleUpdateLink(id: string, updates: Partial<Link>) {
    try {
      const updated = await window.electron.links.update(id, updates)
      setLinks(links.map(l => l.id === id ? updated : l))
    } catch (error) {
      console.error('Failed to update link:', error)
      alert('更新链接失败')
    }
  }

  function handleThemeToggle() {
    document.documentElement.classList.add('theme-transitioning')
    setTheme(theme === 'light' ? 'dark' : 'light')
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning')
    }, 200)
  }

  const [isAIOrganizing, setIsAIOrganizing] = useState(false)
  const [hasAIBackup, setHasAIBackup] = useState(false)
  const [aiProgress, setAiProgress] = useState<{
    current: number
    total: number
    phase: string
    message: string
  } | null>(null)

  // 监听 AI 整理进度
  useEffect(() => {
    const cleanup = window.electron.ai.onProgress((progress) => {
      setAiProgress(progress)
    })
    return () => { cleanup() }
  }, [])

  // 新的 AI 整理流程：分批 MD 格式交互
  async function handleAIOrganize() {
    try {
      const config = await window.electron.ai.getConfig()
      if (!config || !config.apiKey) {
        alert('请先在 AI 设置中配置 API Key')
        return
      }

      if (links.length === 0) {
        alert('没有可整理的链接')
        return
      }

      const batchCount = Math.ceil(links.length / 40)

      // 检查是否有未清除的上次备份
      const hasOldBackup = await window.electron.ai.hasBackup()
      if (hasOldBackup) {
        if (!confirm(
          '检测到上次 AI 整理后还有未确认的备份。\n\n' +
          '点击"确定"将覆盖旧备份，继续新的整理。\n' +
          '点击"取消"返回，你可以先手动撤销上次整理。'
        )) return
      }

      if (!confirm(
        'AI 将分批重新整理你的所有链接分类。\n\n' +
        `共 ${links.length} 个链接，分 ${batchCount} 批处理。\n` +
        '整理前会自动备份当前数据，如果结果不满意可以还原。\n\n' +
        '确认开始整理？'
      )) return

      setIsAIOrganizing(true)
      setHasAIBackup(false)
      setAiProgress(null)

      const result = await window.electron.ai.organizeMd()

      // AI 整理成功后，导入整理好的数据（替换当前数据）
      await window.electron.links.clearAll()

      // 建立旧 ID → 新 ID 映射
      const idMap = new Map<string, string>()

      // 按层级深度排序文件夹
      function getDepth(f: any): number {
        let depth = 0
        let current = f
        while (current.parentId) {
          depth++
          const parent = result.folders.find((pf: any) => pf.id === current.parentId)
          if (!parent) break
          current = parent
        }
        return depth
      }

      const sortedFolders = [...result.folders].sort((a: any, b: any) => getDepth(a) - getDepth(b))

      for (const folder of sortedFolders) {
        try {
          const newParentId = folder.parentId ? (idMap.get(folder.parentId) || null) : null
          const newFolder = await window.electron.folders.create({
            name: folder.name,
            parentId: newParentId,
            order: folder.order
          })
          idMap.set(folder.id, newFolder.id)
        } catch (e) {
          console.warn('Failed to create folder:', e)
        }
      }

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

      await loadData()
      setIsAIOrganizing(false)
      setAiProgress(null)
      setHasAIBackup(true)
    } catch (error: any) {
      console.error('AI organize failed:', error)
      setIsAIOrganizing(false)
      setAiProgress(null)
      const msg = error?.message || error?.toString() || '未知错误'
      alert(`AI 整理失败: ${msg}`)
    }
  }

  // 撤销 AI 整理，还原到之前的状态
  async function handleAIRestore() {
    try {
      await window.electron.ai.restoreBackup()
      await loadData()
      setHasAIBackup(false)
    } catch (error: any) {
      const msg = error?.message || error?.toString() || '未知错误'
      alert(`还原失败: ${msg}`)
    }
  }

  // 删除备份（× 按钮，仅删除备份不还原）
  async function handleDismissBackup() {
    if (!confirm('确定要删除整理前的备份文件吗？\n\n删除后无法再还原到整理前的状态。')) return
    try {
      await window.electron.ai.clearBackup?.()
      setHasAIBackup(false)
    } catch (error: any) {
      const msg = error?.message || error?.toString() || '未知错误'
      alert(`删除备份失败: ${msg}`)
    }
  }

  // 加载时检查是否有 AI 备份
  useEffect(() => {
    window.electron.ai.hasBackup().then(setHasAIBackup).catch(() => {})
  }, [links.length > 0 ? undefined : links]) // 数据变化后重新检查

  function adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  // 递归获取文件夹及其所有子文件夹的 ID
  function getAllSubFolderIds(folderId: string): string[] {
    const ids: string[] = [folderId]
    const children = folders.filter(f => f.parentId === folderId)
    for (const child of children) {
      ids.push(...getAllSubFolderIds(child.id))
    }
    return ids
  }

  // Filter links by selected folder (包括子文件夹中的链接)
  const filteredLinks = React.useMemo(() => {
    if (selectedFolderId === null) return links
    const folderIds = getAllSubFolderIds(selectedFolderId)
    return links.filter(l => l.folderId !== null && folderIds.includes(l.folderId))
  }, [links, selectedFolderId, folders])

  return (
    <div className="app-container">
      <Sidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteFolders={handleDeleteFolders}
        onMoveFolders={handleMoveFolders}
        onImport={() => setShowImportModal(true)}
        onExport={() => setShowExportModal(true)}
      />
      <div className="main-area">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAISettings={() => setShowAISettingsModal(true)}
          onAIOrganize={handleAIOrganize}
          onAIRestore={handleAIRestore}
          onDismissBackup={handleDismissBackup}
          hasAIBackup={hasAIBackup}
          isAIOrganizing={isAIOrganizing}
          aiProgress={aiProgress}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          accentColor={currentAccentColor}
          onAccentColorChange={(color) => {
            if (theme === 'dark') setAccentColorDark(color)
            else setAccentColorLight(color)
          }}
        />
        <MainContent
          links={filteredLinks}
          folders={folders}
          selectedFolderId={selectedFolderId}
          searchQuery={searchQuery}
          onDeleteLink={handleDeleteLink}
          onDeleteLinks={handleDeleteLinks}
          onMoveLinks={handleMoveLinks}
          onEditLink={handleEditLink}
        />
      </div>

      {/* Modals */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            await loadData()
            setShowImportModal(false)
          }}
        />
      )}

      {showExportModal && (
        <ExportModal
          links={links}
          folders={folders}
          accentColor={currentAccentColor}
          accentColorLight={accentColorLight}
          accentColorDark={accentColorDark}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showAISettingsModal && (
        <AISettingsModal
          onClose={() => setShowAISettingsModal(false)}
        />
      )}

      {editingLink && (
        <EditLinkModal
          link={editingLink}
          folders={folders}
          onClose={() => setEditingLink(null)}
          onSave={async (id, updates) => {
            await handleUpdateLink(id, updates)
            setEditingLink(null)
          }}
        />
      )}
    </div>
  )
}

export default App
