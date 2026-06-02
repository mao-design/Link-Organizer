import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getLinks, saveLink, deleteLink, saveLinks, saveFolders } from '../services/storageService'
import type { Link } from '../types'

export function setupLinksIpc(mainWindow: BrowserWindow) {
  // Get all links
  ipcMain.handle('links:get-all', async () => {
    try {
      const links = getLinks()
      return links.sort((a, b) => a.order - b.order)
    } catch (error) {
      console.error('Error getting links:', error)
      throw new Error('Failed to retrieve links')
    }
  })

  // Create link
  ipcMain.handle('links:create', async (_event, data) => {
    try {
      const links = getLinks()
      const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order)) : -1

      const newLink: Link = {
        ...data,
        id: uuidv4(),
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      saveLink(newLink)
      mainWindow.webContents.send('links:updated', newLink)
      return newLink
    } catch (error) {
      console.error('Error creating link:', error)
      throw new Error('Failed to create link')
    }
  })

  // Update link
  ipcMain.handle('links:update', async (_event, id, updates) => {
    try {
      const links = getLinks()
      const index = links.findIndex(l => l.id === id)

      if (index === -1) {
        throw new Error('Link not found')
      }

      links[index] = {
        ...links[index],
        ...updates,
        updatedAt: Date.now()
      }

      saveLink(links[index])
      mainWindow.webContents.send('links:updated', links[index])
      return links[index]
    } catch (error) {
      console.error('Error updating link:', error)
      throw error
    }
  })

  // Delete link
  ipcMain.handle('links:delete', async (_event, id) => {
    try {
      deleteLink(id)
      mainWindow.webContents.send('links:deleted', id)
    } catch (error) {
      console.error('Error deleting link:', error)
      throw new Error('Failed to delete link')
    }
  })

  // Batch delete links
  ipcMain.handle('links:delete-batch', async (_event, ids: string[]) => {
    try {
      const links = getLinks().filter(l => !ids.includes(l.id))
      saveLinks(links)
      mainWindow.webContents.send('links:batch-deleted', ids)
    } catch (error) {
      console.error('Error batch deleting links:', error)
      throw new Error('Failed to batch delete links')
    }
  })

  // Batch move links to folder
  ipcMain.handle('links:move-batch', async (_event, ids: string[], targetFolderId: string | null) => {
    try {
      const links = getLinks()
      for (const link of links) {
        if (ids.includes(link.id)) {
          link.folderId = targetFolderId
          link.updatedAt = Date.now()
        }
      }
      saveLinks(links)
      mainWindow.webContents.send('links:batch-moved', { ids, targetFolderId })
    } catch (error) {
      console.error('Error batch moving links:', error)
      throw new Error('Failed to batch move links')
    }
  })

  // Reorder links
  ipcMain.handle('links:reorder', async (_event, updates) => {
    try {
      const links = getLinks()

      updates.forEach(({ id, order }) => {
        const link = links.find(l => l.id === id)
        if (link) {
          link.order = order
          link.updatedAt = Date.now()
        }
      })

      saveLinks(links)
      mainWindow.webContents.send('links:reordered', updates)
    } catch (error) {
      console.error('Error reordering links:', error)
      throw new Error('Failed to reorder links')
    }
  })

  // Clear all links and folders
  ipcMain.handle('links:clear-all', async () => {
    try {
      saveLinks([])
      saveFolders([])
      mainWindow.webContents.send('links:cleared-all')
    } catch (error) {
      console.error('Error clearing all:', error)
      throw new Error('Failed to clear all data')
    }
  })
}
