import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { generateSite } from '../services/siteGenerator'
import { getLastExportPath, setLastExportPath, getExportPrefs, setExportPrefs } from '../services/storageService'
import type { ExportConfig, Link, Folder } from '../types'

export function setupExportIpc(mainWindow: BrowserWindow) {
  // Generate static website
  ipcMain.handle('export:generate', async (_event, config: ExportConfig, links: Link[], folders: Folder[]) => {
    try {
      const result = await generateSite(config, links, folders)

      if (result.success) {
        // 记住输出路径和导出偏好
        setLastExportPath(config.outputPath)
        setExportPrefs({
          lastExportPath: config.outputPath,
          siteTitle: config.siteTitle,
          siteDescription: config.siteDescription || '',
          logoMode: config.logo ? (/^https?:\/\//.test(config.logo) ? 'image' : 'text') : 'none',
          logoValue: config.logo || '',
          faviconMode: config.favicon ? 'image' : (config.faviconText ? 'text' : 'none'),
          faviconValue: config.favicon || config.faviconText || '',
          faviconBgColor: config.faviconBgColor || '#5b9bd5',
          faviconTextColor: config.faviconTextColor || '#ffffff',
          showFavicons: config.features.showFavicons,
          darkModeToggle: config.features.darkModeToggle,
          searchEnabled: config.features.searchEnabled,
          backToTopButton: config.features.backToTopButton,
          sidebarNavigation: config.features.sidebarNavigation,
          showDescriptions: config.features.showDescriptions,
          showTags: config.features.showTags
        })
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '导出成功',
          message: `网站已生成到: ${result.outputPath}`,
          detail: '用浏览器打开 index.html 即可查看网站',
          buttons: ['打开文件夹', '确定'],
          defaultId: 0,
          cancelId: 1
        })

        if (choice.response === 0) {
          shell.openPath(result.outputPath)
        }
      }

      return result
    } catch (error) {
      console.error('Error generating site:', error)
      return {
        success: false,
        outputPath: '',
        filesGenerated: 0,
        error: String(error)
      }
    }
  })

  // Get default export path
  ipcMain.handle('export:get-default-path', async () => {
    try {
      const lastPath = getLastExportPath()
      const result = await dialog.showOpenDialog({
        defaultPath: lastPath || undefined,
        properties: ['openDirectory', 'createDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return ''
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('Error getting default path:', error)
      return ''
    }
  })

  // Get last export path
  ipcMain.handle('export:get-last-path', async () => {
    return getLastExportPath()
  })

  // Get export preferences
  ipcMain.handle('export:get-prefs', async () => {
    return getExportPrefs()
  })

  // Save export preferences (不依赖导出成功)
  ipcMain.handle('export:save-prefs', async (_event, prefs: any) => {
    setExportPrefs(prefs)
  })
}
