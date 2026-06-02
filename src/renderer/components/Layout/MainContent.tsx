import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Link, Folder } from '../../types'

interface MainContentProps {
  links: Link[]
  folders: Folder[]
  selectedFolderId: string | null
  searchQuery: string
  onDeleteLink: (id: string) => void
  onDeleteLinks: (ids: string[]) => void
  onMoveLinks: (ids: string[], targetFolderId: string | null) => void
  onEditLink: (link: Link) => void
}

const MainContent: React.FC<MainContentProps> = ({
  links,
  folders,
  selectedFolderId,
  searchQuery,
  onDeleteLink,
  onDeleteLinks,
  onMoveLinks,
  onEditLink
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Filter links by search query (只匹配链接名)
  const filteredLinks = searchQuery
    ? links.filter(link =>
        link.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : links

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredLinks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLinks.map(l => l.id)))
    }
  }, [selectedIds, filteredLinks])

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个链接吗？`)) {
      onDeleteLinks(Array.from(selectedIds))
      setSelectedIds(new Set())
    }
  }

  const handleMoveToFolder = (targetFolderId: string | null) => {
    if (selectedIds.size === 0) return
    onMoveLinks(Array.from(selectedIds), targetFolderId)
    setSelectedIds(new Set())
    setShowMoveMenu(false)
  }

  // Scroll listener for back-to-top
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const handleScroll = () => {
      setShowBackToTop(el.scrollTop > 300)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Build folder tree for move menu
  const rootFolders = folders.filter(f => f.parentId === null)

  function renderFolderOption(folder: Folder, depth: number = 0): React.ReactNode {
    const children = folders.filter(f => f.parentId === folder.id)
    return (
      <React.Fragment key={folder.id}>
        <button
          className="move-menu__item"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleMoveToFolder(folder.id)}
        >
          📁 {folder.name}
        </button>
        {children.map(c => renderFolderOption(c, depth + 1))}
      </React.Fragment>
    )
  }

  if (links.length === 0) {
    return (
      <main className="main-content" ref={mainRef}>
        <div className="links-container">
          <div className="empty-state">
            <p className="empty-state__icon">🔗</p>
            <h3>暂无链接</h3>
            <p className="empty-state__hint">点击左侧"导入书签"按钮添加链接</p>
          </div>
        </div>
      </main>
    )
  }

  if (filteredLinks.length === 0 && searchQuery) {
    return (
      <main className="main-content" ref={mainRef}>
        <div className="links-container">
          <div className="empty-state">
            <p className="empty-state__icon">🔍</p>
            <h3>未找到结果</h3>
            <p className="empty-state__hint">尝试其他搜索关键词</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="main-content" ref={mainRef}>
      <div className="links-container">
        <div className="links-header">
          <h2>
            {selectedFolderId
              ? <><span className="links-header__folder">{folders.find(f => f.id === selectedFolderId)?.name || ''}</span> <span className="links-header__count">共 {filteredLinks.length} 个链接</span></>
              : <span>共 {filteredLinks.length} 个链接</span>
            }
          </h2>
          {selectedIds.size > 0 && (
            <div className="batch-toolbar">
              <span className="batch-toolbar__count">已选 {selectedIds.size} 项</span>
              <div className="batch-toolbar__actions">
                <div className="move-menu-wrapper">
                  <button
                    className="batch-toolbar__btn"
                    onClick={() => setShowMoveMenu(!showMoveMenu)}
                  >
                    移动到...
                  </button>
                  {showMoveMenu && (
                    <div className="move-menu">
                      <button
                        className="move-menu__item"
                        onClick={() => handleMoveToFolder(null)}
                      >
                        📂 根目录
                      </button>
                      {rootFolders.map(f => renderFolderOption(f))}
                    </div>
                  )}
                </div>
                <button
                  className="batch-toolbar__btn batch-toolbar__btn--danger"
                  onClick={handleBatchDelete}
                >
                  批量删除
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="links-list">
          {/* 全选复选框行 */}
          <div className="link-row link-row--select-all">
            <label className="link-row__checkbox">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredLinks.length && filteredLinks.length > 0}
                onChange={toggleSelectAll}
              />
            </label>
            <span className="link-row__select-hint">全选</span>
          </div>
          {filteredLinks.map(link => (
            <article
              key={link.id}
              className={`link-row ${selectedIds.has(link.id) ? 'link-row--selected' : ''}`}
            >
              <label className="link-row__checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.has(link.id)}
                  onChange={() => toggleSelect(link.id)}
                />
              </label>
              <div className="link-row__favicon">
                {link.favicon ? (
                  <img
                    src={link.favicon}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      const initial = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (initial) initial.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span
                  className="link-row__favicon-initial"
                  style={{ display: link.favicon ? 'none' : 'flex' }}
                >
                  {(link.title.match(/[a-zA-Z\u4e00-\u9fff]/) || [link.title.charAt(0)])[0].toUpperCase()}
                </span>
              </div>
              <div className="link-row__body">
                <div className="link-row__line">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-row__title"
                  >
                    {link.title}
                  </a>
                </div>
                <div className="link-row__line">
                  <span className="link-row__url">{link.url}</span>
                  {link.tags && link.tags.length > 0 && (
                    <span className="link-row__tags">
                      {link.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </span>
                  )}
                </div>
                {link.description && (
                  <div className="link-row__line">
                    <span className="link-row__description">{link.description}</span>
                  </div>
                )}
              </div>
              <div className="link-row__actions">
                <button
                  className="link-row__action-btn"
                  onClick={() => onEditLink(link)}
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  className="link-row__action-btn delete"
                  onClick={() => {
                    if (confirm(`确定要删除 "${link.title}" 吗？`)) {
                      onDeleteLink(link.id)
                    }
                  }}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {showBackToTop && (
        <button className="back-to-top-btn" onClick={scrollToTop} title="回到顶部">
          ↑
        </button>
      )}
    </main>
  )
}

export default MainContent
