// 链接数据模型
export interface Link {
  id: string
  url: string
  title: string
  description: string
  favicon: string | null
  tags: string[]
  folderId: string | null
  order: number
  createdAt: number
  updatedAt: number
}

// 文件夹数据模型
export interface Folder {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: number
  updatedAt: number
}

// AI配置
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
  temperature: number
  maxTokens: number
}

// AI任务
export interface AITask {
  type: 'categorize' | 'tag' | 'describe' | 'organize'
  links: Link[]
  folders: Folder[]
  context?: string
}

// AI建议
export interface AISuggestion {
  linkId: string
  suggestedFolderId: string | null
  suggestedTags: string[]
  generatedDescription?: string
  reasoning?: string
  confidence: number
}

// AI响应
export interface AIResponse {
  suggestions: AISuggestion[]
  confidence: number
}

// 导出配置
export interface ExportConfig {
  outputPath: string
  siteTitle: string
  accentColor?: string  // 当前主题色（兼容）
  accentColorLight?: string  // 白天主题色
  accentColorDark?: string  // 暗夜主题色
  logo?: string  // 自定义logo: 图片URL或文字
  favicon?: string  // 自定义favicon: 图片URL (image模式)
  faviconText?: string  // favicon 文字
  faviconBgColor?: string  // favicon 背景色
  faviconTextColor?: string  // favicon 文字颜色
  features: ExportFeatures
}

export interface ExportFeatures {
  darkModeToggle: boolean
  searchEnabled: boolean
  sidebarNavigation: boolean
  backToTopButton: boolean
  showFavicons: 'icon' | 'initial' | 'none'
}

// 导出结果
export interface ExportResult {
  success: boolean
  outputPath: string
  filesGenerated: number
  error?: string
}

// 导入来源
export interface ImportSource {
  type: 'html-file' | 'chrome' | 'firefox' | 'edge' | 'manual'
  filePath?: string
  urls?: string[]
}

// 导入结果
export interface ImportResult {
  success: boolean
  importedCount: number
  failedCount: number
  errors: ImportError[]
  links: Link[]
  folders: Folder[]
}

// 导入错误
export interface ImportError {
  url: string
  reason: string
}

// 网站元数据
export interface LinkMetadata {
  title: string
  description: string
  favicon: string | null
  domain: string
  ogImage?: string
  fetchStatus: 'pending' | 'success' | 'failed'
}

// 应用状态
export interface AppState {
  version: string
  lastOpened: number
  theme: 'light' | 'dark' | 'system'
  accentColor?: string  // 白天主题色
  accentColorDark?: string  // 暗夜主题色
}
