import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'path'
import { createMainWindow } from './window'
import { setupIpcHandlers } from './ipc'
import { initializeStorage } from './services/storageService'

let mainWindow: BrowserWindow | null = null

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  // 初始化存储
  await initializeStorage()

  // 创建主窗口
  mainWindow = createMainWindow()

  // 设置IPC处理器
  setupIpcHandlers(mainWindow)

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme-changed', {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  mainWindow = null
})
