import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getAIConfig, saveAIConfig, saveBackup, restoreBackup, clearBackup, getBackup, getLinks, getFolders } from '../services/storageService'
import { organizeWithAI_Batch, testAIConnection } from '../services/aiOrganizer'
import { parseMd } from '../services/mdParser'
import type { AIConfig } from '../types'

export function setupAIIpc(mainWindow: BrowserWindow) {
  // Configure AI
  ipcMain.handle('ai:configure', async (_event, config: AIConfig) => {
    try {
      saveAIConfig(config)
    } catch (error) {
      console.error('Error configuring AI:', error)
      throw new Error('Failed to configure AI')
    }
  })

  // Get AI config
  ipcMain.handle('ai:get-config', async () => {
    try {
      return getAIConfig()
    } catch (error) {
      console.error('Error getting AI config:', error)
      return null
    }
  })

  // 分批 AI 整理流程
  ipcMain.handle('ai:organize-md', async () => {
    try {
      const config = getAIConfig()
      if (!config) {
        throw new Error('AI 未配置，请先设置 API Key')
      }

      const links = getLinks()
      const folders = getFolders()

      if (links.length === 0) {
        throw new Error('没有可整理的链接')
      }

      // 备份当前数据
      saveBackup()

      // 分批整理，通过 IPC 事件推送进度
      const result = await organizeWithAI_Batch(links, config, (progress) => {
        mainWindow.webContents.send('ai:progress', progress)
      })

      // result.mdContent 已经是分类结构化的 MD
      const mdContent = result.mdContent
      console.log('=== Merged MD (first 1000 chars) ===')
      console.log(mdContent.substring(0, 1000))
      console.log('=== End of merged MD ===')

      const parsed = parseMd(mdContent)

      if (!parsed.success || parsed.links.length === 0) {
        console.error('parseMd failed. Links count:', parsed.links.length)
        // fallback: 直接使用原始合并结果
        console.log('Using fallback: raw merged links')
        return buildFallbackResult(result)
      }

      return {
        success: true,
        links: parsed.links,
        folders: parsed.folders,
        linkCount: parsed.links.length,
        folderCount: parsed.folders.length
      }
    } catch (error: any) {
      console.error('Error organizing with AI:', error)
      throw error
    }
  })

  // 还原到 AI 整理前的状态
  ipcMain.handle('ai:restore-backup', async () => {
    try {
      const success = restoreBackup()
      if (!success) {
        throw new Error('没有可用的备份数据')
      }
      return { success: true }
    } catch (error: any) {
      console.error('Error restoring backup:', error)
      throw error
    }
  })

  // 检查是否有备份
  ipcMain.handle('ai:has-backup', async () => {
    try {
      const backup = getBackup()
      return backup !== null
    } catch {
      return false
    }
  })

  // 清除备份（用户确认整理结果后）
  ipcMain.handle('ai:clear-backup', async () => {
    try {
      clearBackup()
    } catch (error) {
      console.error('Error clearing backup:', error)
    }
  })

  // Test AI connection
  ipcMain.handle('ai:test-connection', async () => {
    try {
      const config = getAIConfig()
      if (!config) return false
      return await testAIConnection(config)
    } catch (error) {
      console.error('Error testing AI connection:', error)
      return false
    }
  })
}

/**
 * fallback：当 parseMd 失败时，直接用分类结构构建返回结果
 */
function buildFallbackResult(result: { links: Array<{ title: string; url: string; description: string; category: string }>; categories: string[] }) {
  // 先创建文件夹
  const folders: Array<{ id: string; name: string; parentId: null; order: number; createdAt: number; updatedAt: number }> = []
  const categoryToFolderId = new Map<string, string>()

  for (const cat of result.categories) {
    const fid = uuidv4()
    categoryToFolderId.set(cat, fid)
    folders.push({
      id: fid,
      name: cat,
      parentId: null,
      order: folders.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  // 确保"其他"分类存在
  if (!categoryToFolderId.has('其他')) {
    const fid = uuidv4()
    categoryToFolderId.set('其他', fid)
    folders.push({
      id: fid,
      name: '其他',
      parentId: null,
      order: folders.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  const links = result.links.map((l, i) => ({
    id: uuidv4(),
    url: l.url,
    title: l.title,
    description: l.description || '',
    favicon: null,
    tags: [] as string[],
    folderId: categoryToFolderId.get(l.category || '其他') || null,
    order: i,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))

  return {
    success: true,
    links,
    folders,
    linkCount: links.length,
    folderCount: folders.length
  }
}
