import React, { useState, useEffect } from 'react'
import type { Folder } from '../../types'

interface SidebarProps {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (name: string, parentId: string | null) => void
  onDeleteFolder: (id: string) => void
  onDeleteFolders: (ids: string[]) => void
  onMoveFolders: (ids: string[], targetParentId: string | null) => void
  onImport: () => void
  onExport: () => void
}

// 树节点组件
const FolderTreeNode: React.FC<{
  folder: Folder
  allFolders: Folder[]
  selectedFolderId: string | null
  selectedFolderIds: Set<string>
  expandedFolderIds: Set<string>
  depth: number
  onSelectFolder: (id: string | null) => void
  onToggleSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onDeleteFolder: (id: string) => void
}> = ({ folder, allFolders, selectedFolderId, selectedFolderIds, expandedFolderIds, depth, onSelectFolder, onToggleSelect, onToggleExpand, onDeleteFolder }) => {
  const expanded = expandedFolderIds.has(folder.id)
  const children = allFolders.filter(f => f.parentId === folder.id)
  const hasChildren = children.length > 0

  return (
    <div className="tree-node">
      <div
        className={`sidebar-item tree-item ${selectedFolderId === folder.id ? 'active' : ''} ${selectedFolderIds.has(folder.id) ? 'sidebar-item--selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <label className="sidebar-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedFolderIds.has(folder.id)}
            onChange={() => onToggleSelect(folder.id)}
          />
        </label>
        <span
          className="tree-toggle"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folder.id)
          }}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : '  '}
        </span>
        <span className="tree-label" onClick={() => onSelectFolder(folder.id)}>{folder.name}</span>
        <button
          className="delete-folder-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteFolder(folder.id)
          }}
          title="删除文件夹（含子文件夹）"
        >
          ×
        </button>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {children.map(child => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              selectedFolderId={selectedFolderId}
              selectedFolderIds={selectedFolderIds}
              expandedFolderIds={expandedFolderIds}
              depth={depth + 1}
              onSelectFolder={onSelectFolder}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const Sidebar: React.FC<SidebarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onDeleteFolders,
  onMoveFolders,
  onImport,
  onExport
}) => {
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())
  const [expandedLoaded, setExpandedLoaded] = useState(false)

  // 加载展开状态
  useEffect(() => {
    window.electron.app.getExpandedFolders().then(ids => {
      if (ids && ids.length > 0) {
        setExpandedFolderIds(new Set(ids))
      } else {
        // 首次使用：全部展开
        setExpandedFolderIds(new Set(folders.map(f => f.id)))
      }
      setExpandedLoaded(true)
    }).catch(() => {
      setExpandedFolderIds(new Set(folders.map(f => f.id)))
      setExpandedLoaded(true)
    })
  }, [])

  // 持久化展开状态
  useEffect(() => {
    if (!expandedLoaded) return
    window.electron.app.setExpandedFolders(Array.from(expandedFolderIds)).catch(() => {})
  }, [expandedFolderIds, expandedLoaded])

  const toggleExpand = (id: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderParentId)
      setNewFolderName('')
      setShowNewFolderInput(false)
      setNewFolderParentId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder()
    } else if (e.key === 'Escape') {
      setShowNewFolderInput(false)
      setNewFolderName('')
      setNewFolderParentId(null)
    }
  }

  // 递归获取子文件夹 ID
  const getSubIds = (folderId: string): string[] => {
    const ids: string[] = [folderId]
    const children = folders.filter(f => f.parentId === folderId)
    for (const child of children) {
      ids.push(...getSubIds(child.id))
    }
    return ids
  }

  const toggleSelect = (id: string) => {
    setSelectedFolderIds(prev => {
      const next = new Set(prev)
      const subIds = getSubIds(id)
      if (next.has(id)) {
        // 取消选中：移除父文件夹及所有子文件夹
        subIds.forEach(sid => next.delete(sid))
      } else {
        // 选中：添加父文件夹及所有子文件夹
        subIds.forEach(sid => next.add(sid))
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const allIds = new Set(folders.map(f => f.id))
    if (selectedFolderIds.size === allIds.size) {
      setSelectedFolderIds(new Set())
    } else {
      setSelectedFolderIds(allIds)
    }
  }

  const handleBatchDelete = () => {
    if (selectedFolderIds.size === 0) return
    if (confirm(`确定要删除选中的 ${selectedFolderIds.size} 个文件夹及其所有子文件夹和链接吗？`)) {
      onDeleteFolders(Array.from(selectedFolderIds))
      setSelectedFolderIds(new Set())
    }
  }

  const handleMoveTo = (targetParentId: string | null) => {
    if (selectedFolderIds.size === 0) return
    onMoveFolders(Array.from(selectedFolderIds), targetParentId)
    setSelectedFolderIds(new Set())
    setShowMoveMenu(false)
  }

  const rootFolders = folders.filter(f => f.parentId === null)

  function renderMoveOption(folder: Folder, depth: number = 0): React.ReactNode {
    const children = folders.filter(f => f.parentId === folder.id)
    return (
      <React.Fragment key={folder.id}>
        <button
          className="move-menu__item"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleMoveTo(folder.id)}
        >
          📁 {folder.name}
        </button>
        {children.map(c => renderMoveOption(c, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <h2>文件夹</h2>
          <button
            className="sidebar-expand-toggle"
            onClick={() => {
              const allExpandable = folders.filter(f =>
                folders.some(child => child.parentId === f.id)
              )
              if (allExpandable.length === 0) return
              // 如果所有有子文件夹的节点都展开了 → 全部收起；否则 → 全部展开
              const allExpanded = allExpandable.every(f => expandedFolderIds.has(f.id))
              if (allExpanded) {
                // 全部收起
                setExpandedFolderIds(new Set())
              } else {
                // 全部展开
                setExpandedFolderIds(new Set(folders.map(f => f.id)))
              }
            }}
            title="切换全部展开/收起"
          >
            {(() => {
              const allExpandable = folders.filter(f =>
                folders.some(child => child.parentId === f.id)
              )
              if (allExpandable.length === 0) return '⊞'
              const allExpanded = allExpandable.every(f => expandedFolderIds.has(f.id))
              return allExpanded ? '⊟' : '⊞'
            })()}
          </button>
        </div>
        {selectedFolderIds.size > 0 && (
          <div className="sidebar-batch-actions">
            <div className="move-menu-wrapper">
              <button
                className="sidebar-batch-btn"
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                title="移动到..."
              >
                📂
              </button>
              {showMoveMenu && (
                <div className="move-menu move-menu--left">
                  <button className="move-menu__item" onClick={() => handleMoveTo(null)}>
                    📂 根目录
                  </button>
                  {rootFolders
                    .filter(f => !selectedFolderIds.has(f.id))
                    .map(f => renderMoveOption(f))}
                </div>
              )}
            </div>
            <button
              className="sidebar-batch-btn sidebar-batch-btn--danger"
              onClick={handleBatchDelete}
              title="批量删除"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-content">
        {/* 全选 */}
        <div className="sidebar-item sidebar-item--select-all" onClick={toggleSelectAll}>
          <label className="sidebar-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={folders.length > 0 && selectedFolderIds.size === folders.length}
              onChange={toggleSelectAll}
            />
          </label>
          <span className="sidebar-select-hint">
            {selectedFolderIds.size === folders.length && folders.length > 0 ? '取消全选' : '全选文件夹'}
          </span>
        </div>

        {/* 全部链接 */}
        <div
          className={`sidebar-item ${selectedFolderId === null ? 'active' : ''}`}
          onClick={() => onSelectFolder(null)}
        >
          <span>全部链接</span>
        </div>

        {rootFolders.map(folder => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            allFolders={folders}
            selectedFolderId={selectedFolderId}
            selectedFolderIds={selectedFolderIds}
            expandedFolderIds={expandedFolderIds}
            depth={0}
            onSelectFolder={onSelectFolder}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
            onDeleteFolder={onDeleteFolder}
          />
        ))}

        {showNewFolderInput && (
          <div className="new-folder-input">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="文件夹名称"
              autoFocus
            />
            <div className="new-folder-actions">
              <button onClick={handleCreateFolder}>确定</button>
              <button onClick={() => {
                setShowNewFolderInput(false)
                setNewFolderName('')
                setNewFolderParentId(null)
              }}>取消</button>
            </div>
          </div>
        )}

        {folders.length === 0 && !showNewFolderInput && (
          <p className="empty-hint">暂无文件夹</p>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          className="primary"
          style={{ width: '100%', marginBottom: '8px' }}
          onClick={() => setShowNewFolderInput(true)}
        >
          + 新建文件夹
        </button>
        <button style={{ width: '100%', marginBottom: '8px' }} onClick={onImport}>
          导入书签
        </button>
        <button style={{ width: '100%' }} onClick={onExport}>
          导出为网站
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
