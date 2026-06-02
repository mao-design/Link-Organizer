import { BrowserWindow } from 'electron'
import { setupLinksIpc } from './links'
import { setupFoldersIpc } from './folders'
import { setupBookmarksIpc } from './bookmarks'
import { setupAIIpc } from './ai'
import { setupExportIpc } from './export'
import { setupAppIpc } from './app'

export function setupIpcHandlers(mainWindow: BrowserWindow) {
  setupLinksIpc(mainWindow)
  setupFoldersIpc(mainWindow)
  setupBookmarksIpc(mainWindow)
  setupAIIpc(mainWindow)
  setupExportIpc(mainWindow)
  setupAppIpc(mainWindow)
}
