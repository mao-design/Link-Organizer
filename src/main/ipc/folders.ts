import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getFolders, saveFolder, deleteFolder, saveFolders, getLinks, saveLinks } from '../services/storageService'
import type { Folder } from '../types'

export function setupFoldersIpc(mainWindow: BrowserWindow) {
  // Get all folders
  ipcMain.handle('folders:get-all', async () => {
    try {
      const folders = getFolders()
      return folders.sort((a, b) => a.order - b.order)
    } catch (error) {
      console.error('Error getting folders:', error)
      throw new Error('Failed to retrieve folders')
    }
  })

  // Create folder
  ipcMain.handle('folders:create', async (_event, data) => {
    try {
      const folders = getFolders()
      const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.order)) : -1

      const newFolder: Folder = {
        ...data,
        id: uuidv4(),
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      saveFolder(newFolder)
      mainWindow.webContents.send('folders:updated', newFolder)
      return newFolder
    } catch (error) {
      console.error('Error creating folder:', error)
      throw new Error('Failed to create folder')
    }
  })

  // Update folder
  ipcMain.handle('folders:update', async (_event, id, updates) => {
    try {
      const folders = getFolders()
      const index = folders.findIndex(f => f.id === id)

      if (index === -1) {
        throw new Error('Folder not found')
      }

      folders[index] = {
        ...folders[index],
        ...updates,
        updatedAt: Date.now()
      }

      saveFolder(folders[index])
      mainWindow.webContents.send('folders:updated', folders[index])
      return folders[index]
    } catch (error) {
      console.error('Error updating folder:', error)
      throw error
    }
  })

  // Delete folder
  ipcMain.handle('folders:delete', async (_event, id) => {
    try {
      deleteFolder(id)
      mainWindow.webContents.send('folders:deleted', id)
    } catch (error) {
      console.error('Error deleting folder:', error)
      throw new Error('Failed to delete folder')
    }
  })

  // Delete folder recursively (including subfolders and their links)
  ipcMain.handle('folders:delete-recursive', async (_event, id: string) => {
    try {
      const folders = getFolders()
      const links = getLinks()

      // 收集所有需要删除的文件夹 ID（包括子文件夹）
      function collectSubFolderIds(folderId: string): string[] {
        const ids: string[] = [folderId]
        const children = folders.filter(f => f.parentId === folderId)
        for (const child of children) {
          ids.push(...collectSubFolderIds(child.id))
        }
        return ids
      }

      const idsToDelete = collectSubFolderIds(id)
      const remainingFolders = folders.filter(f => !idsToDelete.includes(f.id))
      const remainingLinks = links.filter(l => !l.folderId || !idsToDelete.includes(l.folderId))

      saveFolders(remainingFolders)
      saveLinks(remainingLinks)
      mainWindow.webContents.send('folders:recursive-deleted', { ids: idsToDelete })
    } catch (error) {
      console.error('Error recursive deleting folder:', error)
      throw new Error('Failed to recursive delete folder')
    }
  })

  // Move folder (change parentId)
  ipcMain.handle('folders:move', async (_event, id: string, newParentId: string | null) => {
    try {
      const folders = getFolders()
      const folder = folders.find(f => f.id === id)
      if (!folder) throw new Error('Folder not found')
      folder.parentId = newParentId
      folder.updatedAt = Date.now()
      saveFolders(folders)
      mainWindow.webContents.send('folders:moved', { id, newParentId })
    } catch (error) {
      console.error('Error moving folder:', error)
      throw new Error('Failed to move folder')
    }
  })
}
