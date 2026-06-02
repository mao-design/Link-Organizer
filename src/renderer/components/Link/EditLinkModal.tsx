import React, { useState } from 'react'
import type { Link, Folder } from '../../types'

interface EditLinkModalProps {
  link: Link
  folders: Folder[]
  onClose: () => void
  onSave: (id: string, updates: Partial<Link>) => Promise<void>
}

const EditLinkModal: React.FC<EditLinkModalProps> = ({
  link,
  folders,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState(link.title)
  const [url, setUrl] = useState(link.url)
  const [description, setDescription] = useState(link.description || '')
  const [folderId, setFolderId] = useState<string | null>(link.folderId)
  const [tagsInput, setTagsInput] = useState(link.tags?.join(', ') || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!url.trim()) {
      alert('请输入链接地址')
      return
    }

    try {
      setIsSaving(true)
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      await onSave(link.id, {
        title: title.trim() || url.trim(),
        url: url.trim(),
        description: description.trim(),
        folderId,
        tags
      })
    } catch (error) {
      console.error('Failed to save link:', error)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑链接</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="edit-url">URL</label>
              <input
                type="text"
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-title">标题</label>
              <input
                type="text"
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="链接标题"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-description">描述</label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="链接描述（可选）"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-folder">所属文件夹</label>
              <select
                id="edit-folder"
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
              >
                <option value="">无（根目录）</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-tags">标签</label>
              <input
                type="text"
                id="edit-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="多个标签用逗号分隔，如: 技术, 前端, React"
              />
              <p className="form-hint">多个标签用逗号分隔</p>
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose}>取消</button>
            <button
              className="primary"
              onClick={handleSave}
              disabled={isSaving || !url.trim()}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditLinkModal
