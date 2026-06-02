import { BrowserWindow, Menu, nativeTheme, app } from 'electron'
import { join } from 'path'

// Vite dev server URL — vite-plugin-electron 自动注入
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

export function createMainWindow(): BrowserWindow {
  // 开发模式直接使用源文件路径，生产模式用 app.getAppPath()
  const isDev = !!VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(app.getAppPath(), 'src', 'renderer', 'ico', 'Favicon.png')
    : join(app.getAppPath(), 'ico', 'Favicon.png')

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false
    },
    autoHideMenuBar: true
  })

  // 隐藏菜单栏
  Menu.setApplicationMenu(null)

  // 加载应用 — vite-plugin-electron 自动处理 dev/prod
  if (VITE_DEV_SERVER_URL) {
    window.loadURL(VITE_DEV_SERVER_URL)
    window.webContents.openDevTools()
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口准备好后显示
  window.once('ready-to-show', () => {
    window.show()
  })

  // 禁用缩放并重置缩放级别
  window.webContents.on('did-finish-load', () => {
    window.webContents.setZoomLevel(0)
  })

  // 禁止缩放快捷键
  window.webContents.on('before-input-event', (_event, input) => {
    if ((input.control || input.meta) && (input.key === '-' || input.key === '=' || input.key === '0')) {
      _event.preventDefault()
    }
  })

  // 阻止导航到外部URL
  window.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })

  return window
}
