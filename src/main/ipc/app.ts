import { ipcMain, BrowserWindow } from 'electron'
import { getAppState, updateAppState, getExpandedFolderIds, setExpandedFolderIds, getLastImportType, setLastImportType } from '../services/storageService'
import type { AppState } from '../types'

export function setupAppIpc(mainWindow: BrowserWindow) {
  // Get app state
  ipcMain.handle('app:get-state', async () => {
    try {
      return getAppState()
    } catch (error) {
      console.error('Error getting app state:', error)
      throw new Error('Failed to get app state')
    }
  })

  // Update app state
  ipcMain.handle('app:update-state', async (_event, updates: Partial<AppState>) => {
    try {
      updateAppState(updates)
    } catch (error) {
      console.error('Error updating app state:', error)
      throw new Error('Failed to update app state')
    }
  })

  // Expanded folder IDs
  ipcMain.handle('app:get-expanded-folders', async () => {
    return getExpandedFolderIds()
  })

  ipcMain.handle('app:set-expanded-folders', async (_event, ids: string[]) => {
    setExpandedFolderIds(ids)
  })

  // Import type
  ipcMain.handle('app:get-last-import-type', async () => {
    return getLastImportType()
  })

  ipcMain.handle('app:set-last-import-type', async (_event, type: string) => {
    setLastImportType(type)
  })
}
