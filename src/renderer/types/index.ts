// Type declarations for the electron API exposed via preload script
// Types are re-exported from the main process to avoid duplication

export type {
  Link,
  Folder,
  AIConfig,
  AITask,
  AISuggestion,
  AIResponse,
  ExportConfig,
  ExportFeatures,
  ExportResult,
  ImportError,
  ImportResult,
  AppState,
} from '../../main/types'

interface ElectronAPI {
  links: {
    getAll: () => Promise<import('../../main/types').Link[]>
    create: (link: Omit<import('../../main/types').Link, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('../../main/types').Link>
    update: (id: string, updates: Partial<import('../../main/types').Link>) => Promise<import('../../main/types').Link>
    delete: (id: string) => Promise<void>
    deleteBatch: (ids: string[]) => Promise<void>
    moveBatch: (ids: string[], targetFolderId: string | null) => Promise<void>
    reorder: (updates: Array<{ id: string; order: number }>) => Promise<void>
    clearAll: () => Promise<void>
  }
  folders: {
    getAll: () => Promise<import('../../main/types').Folder[]>
    create: (folder: Omit<import('../../main/types').Folder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('../../main/types').Folder>
    update: (id: string, updates: Partial<import('../../main/types').Folder>) => Promise<import('../../main/types').Folder>
    delete: (id: string) => Promise<void>
    deleteRecursive: (id: string) => Promise<void>
    move: (id: string, newParentId: string | null) => Promise<void>
  }
  bookmarks: {
    parseHTML: (filePath: string) => Promise<import('../../main/types').ImportResult>
    parseMD: (filePath: string) => Promise<import('../../main/types').ImportResult>
    readChrome: () => Promise<import('../../main/types').ImportResult>
    readFirefox: () => Promise<import('../../main/types').ImportResult>
    readEdge: () => Promise<import('../../main/types').ImportResult>
  }
  ai: {
    configure: (config: import('../../main/types').AIConfig) => Promise<void>
    getConfig: () => Promise<import('../../main/types').AIConfig | null>
    organize: (task: import('../../main/types').AITask) => Promise<import('../../main/types').AIResponse>
    testConnection: () => Promise<boolean>
  }
  export: {
    generate: (config: import('../../main/types').ExportConfig, links: import('../../main/types').Link[], folders: import('../../main/types').Folder[]) => Promise<import('../../main/types').ExportResult>
    getDefaultPath: () => Promise<string>
    getLastPath: () => Promise<string>
    getPrefs: () => Promise<{
      lastExportPath: string
      logoMode: string
      logoValue: string
      faviconMode: string
      faviconValue: string
      faviconBgColor: string
      faviconTextColor: string
      siteTitle: string
      showFavicons: 'icon' | 'initial' | 'none'
    }>
    savePrefs: (prefs: any) => Promise<void>
  }
  app: {
    getState: () => Promise<import('../../main/types').AppState>
    updateState: (updates: Partial<import('../../main/types').AppState>) => Promise<void>
    getExpandedFolders: () => Promise<string[]>
    setExpandedFolders: (ids: string[]) => Promise<void>
    getLastImportType: () => Promise<string>
    setLastImportType: (type: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
