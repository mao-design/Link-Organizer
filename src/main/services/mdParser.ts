import { v4 as uuidv4 } from 'uuid'
import type { Link, Folder, ImportResult } from '../types'

export function parseMd(fileContent: string): ImportResult {
  const errors: ImportResult['errors'] = []
  const links: Link[] = []
  const folders: Folder[] = []

  const lines = fileContent.split(/\r?\n/)

  // folderStack: 每个元素 = { level: number, folder: Folder }
  const folderStack: { level: number; folder: Folder }[] = []

  function getOrCreateFolder(level: number, name: string): Folder {
    const cleanName = name.trim()

    // 回退：移除 level >= 当前 level 的所有层级
    while (folderStack.length > 0 && folderStack[folderStack.length - 1].level >= level) {
      folderStack.pop()
    }

    const parentId = folderStack.length > 0 ? folderStack[folderStack.length - 1].folder.id : null

    // 每个标题都创建独立文件夹（不合并同名）
    const folder: Folder = {
      id: uuidv4(),
      name: cleanName,
      parentId,
      order: folders.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    folders.push(folder)
    folderStack.push({ level, folder })
    return folder
  }

  let pendingDescription = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 匹配 Markdown 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const name = headingMatch[2].trim()
      if (name) {
        getOrCreateFolder(level, name)
      }
      pendingDescription = ''
      continue
    }

    // 匹配引用行 - 关联到上一个链接，而不是下一个链接
    const quoteMatch = line.match(/^>\s*(.*)/)
    if (quoteMatch) {
      const desc = quoteMatch[1].trim()
      if (desc && links.length > 0) {
        // 将描述赋值给上一个链接
        links[links.length - 1].description = desc
      } else if (desc) {
        // 如果前面还没有链接，暂存为 pendingDescription（兼容旧格式）
        pendingDescription = desc
      }
      continue
    }

    // 匹配链接 - 支持 URL 中包含括号
    const linkMatch = line.match(/\[([^\]]+)\]\((.+)\)/)
    if (!linkMatch) continue

    const title = linkMatch[1].trim()
    let url = linkMatch[2].trim()

    // 清理 URL 末尾可能的标点
    url = url.replace(/[。，,\.;；]+$/, '').trim()

    // 验证 URL
    if (!url || !title) continue
    if (!/^https?:\/\//i.test(url)) continue

    const folderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].folder.id : null
    const link: Link = {
      id: uuidv4(),
      title,
      url,
      description: pendingDescription,
      favicon: null,
      tags: [],
      folderId,
      order: links.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    links.push(link)
    pendingDescription = ''
  }

  // 收集所有被引用的文件夹 ID（向上递归）
  const usedFolderIds = new Set(links.map(l => l.folderId).filter(Boolean) as string[])
  function addParentIds(folderId: string) {
    const folder = folders.find(f => f.id === folderId)
    if (folder && folder.parentId && !usedFolderIds.has(folder.parentId)) {
      usedFolderIds.add(folder.parentId)
      addParentIds(folder.parentId)
    }
  }
  for (const id of [...usedFolderIds]) {
    addParentIds(id)
  }

  const usedFolders = folders.filter(f => usedFolderIds.has(f.id))

  return {
    success: links.length > 0,
    importedCount: links.length,
    failedCount: 0,
    errors,
    links,
    folders: usedFolders
  }
}
