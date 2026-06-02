import { contextBridge, ipcRenderer } from 'electron'
import type {
  Link,
  Folder,
  AIConfig,
  ExportConfig,
  ExportResult,
  ImportResult,
  AppState
} from '../main/types'

const electronAPI = {
  // Links API
  links: {
    getAll: (): Promise<Link[]> => ipcRenderer.invoke('links:get-all'),
    create: (link: Omit<Link, 'id' | 'createdAt' | 'updatedAt'>): Promise<Link> =>
      ipcRenderer.invoke('links:create', link),
    update: (id: string, updates: Partial<Link>): Promise<Link> =>
      ipcRenderer.invoke('links:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('links:delete', id),
    deleteBatch: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke('links:delete-batch', ids),
    moveBatch: (ids: string[], targetFolderId: string | null): Promise<void> =>
      ipcRenderer.invoke('links:move-batch', ids, targetFolderId),
    reorder: (updates: Array<{ id: string; order: number }>): Promise<void> =>
      ipcRenderer.invoke('links:reorder', updates),
    clearAll: (): Promise<void> =>
      ipcRenderer.invoke('links:clear-all')
  },

  // Folders API
  folders: {
    getAll: (): Promise<Folder[]> => ipcRenderer.invoke('folders:get-all'),
    create: (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> =>
      ipcRenderer.invoke('folders:create', folder),
    update: (id: string, updates: Partial<Folder>): Promise<Folder> =>
      ipcRenderer.invoke('folders:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('folders:delete', id),
    deleteRecursive: (id: string): Promise<void> =>
      ipcRenderer.invoke('folders:delete-recursive', id),
    move: (id: string, newParentId: string | null): Promise<void> =>
      ipcRenderer.invoke('folders:move', id, newParentId)
  },

  // Bookmarks API
  bookmarks: {
    parseHTML: (filePath: string): Promise<ImportResult> =>
      ipcRenderer.invoke('bookmarks:parse-html', filePath),
    parseMD: (filePath: string): Promise<ImportResult> =>
      ipcRenderer.invoke('bookmarks:parse-md', filePath),
    readChrome: (): Promise<ImportResult> =>
      ipcRenderer.invoke('bookmarks:read-chrome'),
    readFirefox: (): Promise<ImportResult> =>
      ipcRenderer.invoke('bookmarks:read-firefox'),
    readEdge: (): Promise<ImportResult> =>
      ipcRenderer.invoke('bookmarks:read-edge')
  },

  // AI API
  ai: {
    configure: (config: AIConfig): Promise<void> =>
      ipcRenderer.invoke('ai:configure', config),
    getConfig: (): Promise<AIConfig | null> =>
      ipcRenderer.invoke('ai:get-config'),
    organizeMd: (): Promise<{
      success: boolean
      links: Link[]
      folders: Folder[]
      linkCount: number
      folderCount: number
    }> =>
      ipcRenderer.invoke('ai:organize-md'),
    restoreBackup: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('ai:restore-backup'),
    hasBackup: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:has-backup'),
    clearBackup: (): Promise<void> =>
      ipcRenderer.invoke('ai:clear-backup'),
    testConnection: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:test-connection'),
    onProgress: (callback: (progress: {
      current: number
      total: number
      phase: 'processing' | 'merging' | 'done'
      message: string
    }) => void) => {
      const handler = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('ai:progress', handler)
      return () => ipcRenderer.removeListener('ai:progress', handler)
    }
  },

  // Export API
  export: {
    generate: (config: ExportConfig, links: Link[], folders: Folder[]): Promise<ExportResult> =>
      ipcRenderer.invoke('export:generate', config, links, folders),
    getDefaultPath: (): Promise<string> =>
      ipcRenderer.invoke('export:get-default-path'),
    getLastPath: (): Promise<string> =>
      ipcRenderer.invoke('export:get-last-path'),
    getPrefs: (): Promise<any> =>
      ipcRenderer.invoke('export:get-prefs'),
    savePrefs: (prefs: any): Promise<void> =>
      ipcRenderer.invoke('export:save-prefs', prefs)
  },

  // App API
  app: {
    getState: (): Promise<AppState> =>
      ipcRenderer.invoke('app:get-state'),
    updateState: (updates: Partial<AppState>): Promise<void> =>
      ipcRenderer.invoke('app:update-state', updates),
    getExpandedFolders: (): Promise<string[]> =>
      ipcRenderer.invoke('app:get-expanded-folders'),
    setExpandedFolders: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke('app:set-expanded-folders', ids),
    getLastImportType: (): Promise<string> =>
      ipcRenderer.invoke('app:get-last-import-type'),
    setLastImportType: (type: string): Promise<void> =>
      ipcRenderer.invoke('app:set-last-import-type', type)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)

// TypeScript declaration
declare global {
  interface Window {
    electron: typeof electronAPI
  }
}
