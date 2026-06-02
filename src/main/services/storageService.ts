import Store from 'electron-store'
import { Link, Folder, AIConfig, AppState } from '../types'

interface ExportPreferences {
  lastExportPath: string
  logoMode: 'text' | 'image' | 'none'
  logoValue: string
  faviconMode: 'text' | 'image' | 'none'
  faviconValue: string
  faviconBgColor: string
  faviconTextColor: string
  siteTitle: string
  showFavicons: 'icon' | 'initial' | 'none'
  darkModeToggle: boolean
  searchEnabled: boolean
  backToTopButton: boolean
  sidebarNavigation: boolean
}

interface AppStore {
  links: Link[]
  folders: Folder[]
  aiConfig: AIConfig | null
  appState: AppState
  lastExportPath: string
  exportPrefs: ExportPreferences
  expandedFolderIds: string[]
  lastImportType: string
  backupLinks: Link[] | null
  backupFolders: Folder[] | null
}

let store: Store<AppStore> | null = null

export function initializeStorage(): Store<AppStore> {
  store = new Store<AppStore>({
    defaults: {
      links: [],
      folders: [],
      aiConfig: null,
      appState: {
        version: '1.0.0',
        lastOpened: Date.now(),
        theme: 'system'
      },
      lastExportPath: '',
      exportPrefs: {
        lastExportPath: '',
        logoMode: 'none',
        logoValue: '',
        faviconMode: 'none',
        faviconValue: '',
        faviconBgColor: '#5b9bd5',
        faviconTextColor: '#ffffff',
        siteTitle: '我的链接收藏',
        showFavicons: 'icon',
        darkModeToggle: true,
        searchEnabled: true,
        backToTopButton: true,
        sidebarNavigation: true
      },
      expandedFolderIds: [],
      lastImportType: 'html',
      backupLinks: null,
      backupFolders: null
    }
  })

  return store
}

export function getStore(): Store<AppStore> {
  if (!store) {
    throw new Error('Store not initialized')
  }
  return store
}

// Links CRUD
export function getLinks(): Link[] {
  return getStore().get('links', [])
}

export function saveLink(link: Link): void {
  const links = getLinks()
  const index = links.findIndex(l => l.id === link.id)

  if (index >= 0) {
    links[index] = link
  } else {
    links.push(link)
  }

  getStore().set('links', links)
}

export function deleteLink(id: string): void {
  const links = getLinks().filter(l => l.id !== id)
  getStore().set('links', links)
}

export function saveLinks(links: Link[]): void {
  getStore().set('links', links)
}

// Folders CRUD
export function getFolders(): Folder[] {
  return getStore().get('folders', [])
}

export function saveFolder(folder: Folder): void {
  const folders = getFolders()
  const index = folders.findIndex(f => f.id === folder.id)

  if (index >= 0) {
    folders[index] = folder
  } else {
    folders.push(folder)
  }

  getStore().set('folders', folders)
}

export function deleteFolder(id: string): void {
  const folders = getFolders().filter(f => f.id !== id)
  // Also remove folder reference from links
  const links = getLinks().map(l =>
    l.folderId === id ? { ...l, folderId: null } : l
  )
  getStore().set('folders', folders)
  getStore().set('links', links)
}

export function saveFolders(folders: Folder[]): void {
  getStore().set('folders', folders)
}

// AI Config
export function getAIConfig(): AIConfig | null {
  return getStore().get('aiConfig', null)
}

export function saveAIConfig(config: AIConfig): void {
  getStore().set('aiConfig', config)
}

// App State
export function getAppState(): AppState {
  return getStore().get('appState')
}

export function updateAppState(updates: Partial<AppState>): void {
  const currentState = getAppState()
  getStore().set('appState', { ...currentState, ...updates })
}

// Export Path
export function getLastExportPath(): string {
  return getStore().get('lastExportPath', '')
}

export function setLastExportPath(filePath: string): void {
  getStore().set('lastExportPath', filePath)
}

// Export Preferences
const defaultExportPrefs: ExportPreferences = {
  lastExportPath: '',
  logoMode: 'none',
  logoValue: '',
  faviconMode: 'none',
  faviconValue: '',
  faviconBgColor: '#5b9bd5',
  faviconTextColor: '#ffffff',
  siteTitle: '我的链接收藏',
  showFavicons: 'icon',
  darkModeToggle: true,
  searchEnabled: true,
  backToTopButton: true,
  sidebarNavigation: true
}

export function getExportPrefs(): ExportPreferences {
  return { ...defaultExportPrefs, ...getStore().get('exportPrefs') }
}

export function setExportPrefs(prefs: Partial<ExportPreferences>): void {
  const current = getExportPrefs()
  getStore().set('exportPrefs', { ...current, ...prefs })
}

// Expanded folder IDs (sidebar tree)
export function getExpandedFolderIds(): string[] {
  return getStore().get('expandedFolderIds', [])
}

export function setExpandedFolderIds(ids: string[]): void {
  getStore().set('expandedFolderIds', ids)
}

// Last import type
export function getLastImportType(): string {
  return getStore().get('lastImportType', 'html')
}

export function setLastImportType(type: string): void {
  getStore().set('lastImportType', type)
}

// Backup & Restore (for AI organize undo)
export function saveBackup(): void {
  getStore().set('backupLinks', getLinks())
  getStore().set('backupFolders', getFolders())
}

export function getBackup(): { links: Link[]; folders: Folder[] } | null {
  const links = getStore().get('backupLinks', null) as Link[] | null
  const folders = getStore().get('backupFolders', null) as Folder[] | null
  if (!links && !folders) return null
  return { links: links || [], folders: folders || [] }
}

export function restoreBackup(): boolean {
  const backup = getBackup()
  if (!backup) return false
  saveLinks(backup.links)
  saveFolders(backup.folders)
  // 清除备份
  getStore().set('backupLinks', null)
  getStore().set('backupFolders', null)
  return true
}

export function clearBackup(): void {
  getStore().set('backupLinks', null)
  getStore().set('backupFolders', null)
}
