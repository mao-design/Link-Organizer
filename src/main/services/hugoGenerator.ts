import fs from 'fs/promises'
import path from 'path'
import type { Link, Folder, ExportConfig, ExportResult } from '../types'

/**
 * 生成完整的 Hugo 静态网站
 */
export async function generateHugoSite(
  config: ExportConfig,
  links: Link[],
  folders: Folder[]
): Promise<ExportResult> {
  try {
    const outputPath = config.outputPath

    // 1. 创建目录结构
    await createDirectoryStructure(outputPath)

    // 2. 生成 Hugo 配置文件
    await generateConfigFile(outputPath, config)

    // 3. 生成内容文件
    await generateContentFiles(outputPath, links, folders, config)

    // 4. 生成布局模板
    await generateLayouts(outputPath, config)

    // 5. 生成静态资源（CSS、JS）
    await generateAssets(outputPath, config)

    // 6. 复制 favicons
    await copyFavicons(outputPath, links)

    const filesGenerated = countGeneratedFiles(outputPath)

    return {
      success: true,
      outputPath,
      filesGenerated
    }
  } catch (error) {
    console.error('Hugo generation failed:', error)
    return {
      success: false,
      outputPath: '',
      filesGenerated: 0,
      error: String(error)
    }
  }
}

/**
 * 创建目录结构
 */
async function createDirectoryStructure(basePath: string): Promise<void> {
  const dirs = [
    'content',
    'content/links',
    'layouts',
    'layouts/_default',
    'layouts/partials',
    'static',
    'static/css',
    'static/js',
    'static/images',
    'static/images/favicons'
  ]

  for (const dir of dirs) {
    await fs.mkdir(path.join(basePath, dir), { recursive: true })
  }
}

/**
 * 生成 Hugo 配置文件 (config.toml)
 */
async function generateConfigFile(basePath: string, config: ExportConfig): Promise<void> {
  const tomlContent = `baseURL = "/"
languageCode = "zh-cn"
title = "${escapeToml(config.siteTitle)}"
theme = ""

[params]
  description = "${escapeToml(config.siteDescription)}"
  darkModeToggle = ${config.features.darkModeToggle}
  searchEnabled = ${config.features.searchEnabled}
  sidebarNavigation = ${config.features.sidebarNavigation}
  backToTopButton = ${config.features.backToTopButton}
  showDescriptions = ${config.features.showDescriptions}
  showFavicons = ${config.features.showFavicons}
  showTags = ${config.features.showTags}

[outputs]
  home = ["HTML", "JSON"]

[outputFormats.JSON]
  mediaType = "application/json"
  baseName = "links-data"
  isPlainText = true
`

  await fs.writeFile(path.join(basePath, 'config.toml'), tomlContent, 'utf-8')
}

/**
 * 生成内容文件
 */
async function generateContentFiles(
  basePath: string,
  links: Link[],
  folders: Folder[],
  config: ExportConfig
): Promise<void> {
  // 生成首页内容
  const indexContent = `---
title: "${escapeToml(config.siteTitle)}"
description: "${escapeToml(config.siteDescription)}"
---

# ${escapeMarkdown(config.siteTitle)}

${escapeMarkdown(config.siteDescription)}
`
  await fs.writeFile(path.join(basePath, 'content', '_index.md'), indexContent, 'utf-8')

  // 为每个文件夹生成分类页面
  for (const folder of folders) {
    const folderLinks = links.filter(l => l.folderId === folder.id)
    const folderSlug = slugify(folder.name)

    const folderContent = `---
title: "${escapeToml(folder.name)}"
description: "${folderLinks.length} 个链接"
---

# ${escapeMarkdown(folder.name)}

共 ${folderLinks.length} 个链接
`
    await fs.writeFile(
      path.join(basePath, 'content', 'links', `${folderSlug}.md`),
      folderContent,
      'utf-8'
    )
  }

  // 生成未分类链接页面
  const uncategorizedLinks = links.filter(l => !l.folderId)
  if (uncategorizedLinks.length > 0) {
    const uncategorizedContent = `---
title: "未分类"
description: "${uncategorizedLinks.length} 个链接"
---

# 未分类链接

共 ${uncategorizedLinks.length} 个链接
`
    await fs.writeFile(
      path.join(basePath, 'content', 'links', '_index.md'),
      uncategorizedContent,
      'utf-8'
    )
  }

  // 生成 JSON 数据文件（用于前端搜索）
  const jsonData = links.map(link => ({
    id: link.id,
    title: link.title,
    url: link.url,
    description: link.description,
    tags: link.tags,
    folderId: link.folderId,
    favicon: link.favicon
  }))

  await fs.writeFile(
    path.join(basePath, 'static', 'links-data.json'),
    JSON.stringify(jsonData, null, 2),
    'utf-8'
  )
}

/**
 * 生成布局模板
 */
async function generateLayouts(basePath: string, config: ExportConfig): Promise<void> {
  // baseof.html - 基础模板
  const baseofHtml = generateBaseofTemplate(config)
  await fs.writeFile(path.join(basePath, 'layouts', '_default', 'baseof.html'), baseofHtml, 'utf-8')

  // index.html - 首页模板
  const indexHtml = generateIndexTemplate(config)
  await fs.writeFile(path.join(basePath, 'layouts', 'index.html'), indexHtml, 'utf-8')

  // list.html - 列表页模板
  const listHtml = generateListTemplate(config)
  await fs.writeFile(path.join(basePath, 'layouts', '_default', 'list.html'), listHtml, 'utf-8')

  // single.html - 单页模板
  const singleHtml = generateSingleTemplate(config)
  await fs.writeFile(path.join(basePath, 'layouts', '_default', 'single.html'), singleHtml, 'utf-8')

  // header.html - 头部局部模板
  const headerHtml = generateHeaderPartial(config)
  await fs.writeFile(path.join(basePath, 'layouts', 'partials', 'header.html'), headerHtml, 'utf-8')

  // sidebar.html - 侧边栏局部模板
  if (config.features.sidebarNavigation) {
    const sidebarHtml = generateSidebarPartial()
    await fs.writeFile(path.join(basePath, 'layouts', 'partials', 'sidebar.html'), sidebarHtml, 'utf-8')
  }

  // footer.html - 底部局部模板
  const footerHtml = generateFooterPartial()
  await fs.writeFile(path.join(basePath, 'layouts', 'partials', 'footer.html'), footerHtml, 'utf-8')

  // search.html - 搜索局部模板
  if (config.features.searchEnabled) {
    const searchHtml = generateSearchPartial()
    await fs.writeFile(path.join(basePath, 'layouts', 'partials', 'search.html'), searchHtml, 'utf-8')
  }
}

/**
 * 生成基础模板
 */
function generateBaseofTemplate(config: ExportConfig): string {
  const darkModeScript = config.features.darkModeToggle ? `
  <script src="{{ "js/theme.js" | relURL }}"></script>` : ''

  const searchScript = config.features.searchEnabled ? `
  <script src="{{ "js/search.js" | relURL }}" defer></script>` : ''

  return `<!DOCTYPE html>
<html lang="{{ .Site.Language.Lang }}" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{ with .Description }}{{ . }}{{ else }}{{ .Site.Params.description }}{{ end }}">
  <title>{{ block "title" . }}{{ .Site.Title }}{{ end }}</title>
  <link rel="stylesheet" href="{{ "css/style.css" | relURL }}">
  ${darkModeScript}
  ${searchScript}
</head>
<body>
  {{ partial "header.html" . }}
  <div class="container">
    {{ if .Site.Params.sidebarNavigation }}
    <aside class="sidebar">
      {{ partial "sidebar.html" . }}
    </aside>
    {{ end }}
    <main class="main-content" id="main-content">
      {{ block "main" . }}{{ end }}
    </main>
  </div>
  {{ partial "footer.html" . }}
  {{ if .Site.Params.backToTopButton }}
  <button id="back-to-top" class="back-to-top" aria-label="回到顶部" hidden>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 4l-8 8h6v8h4v-8h6z"/>
    </svg>
  </button>
  <script src="{{ "js/back-to-top.js" | relURL }}" defer></script>
  {{ end }}
</body>
</html>`
}

/**
 * 生成首页模板
 */
function generateIndexTemplate(config: ExportConfig): string {
  return `{{ define "title" }}{{ .Site.Title }}{{ end }}

{{ define "main" }}
<div class="home-page">
  <header class="page-header">
    <h1>{{ .Title }}</h1>
    {{ if .Description }}
    <p class="page-description">{{ .Description }}</p>
    {{ end }}
  </header>

  <div class="links-grid">
    {{ range where .Site.RegularPages "Section" "links" }}
    {{ $link := . }}
    {{ range .Resources.ByType "image" }}
    {{ end }}
    <article class="link-card">
      <a href="{{ $link.Params.url }}" target="_blank" rel="noopener noreferrer" class="link-card__link">
        {{ if $.Site.Params.showFavicons }}
        {{ if $link.Params.favicon }}
        <img src="{{ $link.Params.favicon }}" alt="" class="link-card__favicon" loading="lazy" onerror="this.style.display='none'">
        {{ end }}
        {{ end }}
        <div class="link-card__content">
          <h3 class="link-card__title">{{ $link.Title }}</h3>
          {{ if $.Site.Params.showDescriptions }}
          {{ if $link.Params.description }}
          <p class="link-card__description">{{ $link.Params.description }}</p>
          {{ end }}
          {{ end }}
          <span class="link-card__url">{{ $link.Params.url }}</span>
          {{ if $.Site.Params.showTags }}
          {{ if $link.Params.tags }}
          <div class="link-card__tags">
            {{ range $link.Params.tags }}
            <span class="tag">{{ . }}</span>
            {{ end }}
          </div>
          {{ end }}
          {{ end }}
        </div>
        <span class="link-card__external" aria-hidden="true">&#8599;</span>
      </a>
    </article>
    {{ end }}
  </div>
</div>
{{ end }}`
}

/**
 * 生成列表页模板
 */
function generateListTemplate(config: ExportConfig): string {
  return `{{ define "title" }}{{ .Title }} - {{ .Site.Title }}{{ end }}

{{ define "main" }}
<div class="category-page">
  <header class="page-header">
    <h1>{{ .Title }}</h1>
    {{ if .Description }}
    <p class="page-description">{{ .Description }}</p>
    {{ end }}
  </header>

  <div class="links-grid">
    {{ range .Pages }}
    <article class="link-card">
      <a href="{{ .Params.url }}" target="_blank" rel="noopener noreferrer" class="link-card__link">
        {{ if $.Site.Params.showFavicons }}
        {{ if .Params.favicon }}
        <img src="{{ .Params.favicon }}" alt="" class="link-card__favicon" loading="lazy" onerror="this.style.display='none'">
        {{ end }}
        {{ end }}
        <div class="link-card__content">
          <h3 class="link-card__title">{{ .Title }}</h3>
          {{ if $.Site.Params.showDescriptions }}
          {{ if .Params.description }}
          <p class="link-card__description">{{ .Params.description }}</p>
          {{ end }}
          {{ end }}
          <span class="link-card__url">{{ .Params.url }}</span>
        </div>
        <span class="link-card__external" aria-hidden="true">&#8599;</span>
      </a>
    </article>
    {{ end }}
  </div>
</div>
{{ end }}`
}

/**
 * 生成单页模板
 */
function generateSingleTemplate(config: ExportConfig): string {
  return `{{ define "title" }}{{ .Title }} - {{ .Site.Title }}{{ end }}

{{ define "main" }}
<article class="link-detail">
  <header class="page-header">
    <a href="{{ .Parent.Permalink }}" class="back-link">&larr; 返回</a>
    <h1>{{ .Title }}</h1>
  </header>

  <div class="link-detail__card">
    {{ if $.Site.Params.showFavicons }}
    {{ if .Params.favicon }}
    <img src="{{ .Params.favicon }}" alt="" class="link-detail__favicon">
    {{ end }}
    {{ end }}
    <h2><a href="{{ .Params.url }}" target="_blank" rel="noopener noreferrer">{{ .Params.url }}</a></h2>
    {{ if $.Site.Params.showDescriptions }}
    {{ if .Params.description }}
    <p class="link-detail__description">{{ .Params.description }}</p>
    {{ end }}
    {{ end }}
    {{ if $.Site.Params.showTags }}
    {{ if .Params.tags }}
    <div class="link-detail__tags">
      {{ range .Params.tags }}
      <span class="tag">{{ . }}</span>
      {{ end }}
    </div>
    {{ end }}
    {{ end }}
  </div>
</article>
{{ end }}`
}

/**
 * 生成头部局部模板
 */
function generateHeaderPartial(config: ExportConfig): string {
  const darkModeToggle = config.features.darkModeToggle ? `
  <button id="theme-toggle" class="theme-toggle" aria-label="切换暗夜模式" title="切换亮色/暗色模式">
    <svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>` : ''

  const searchBox = config.features.searchEnabled ? `
  <div class="search-container" role="search">
    <input type="search" id="search-input" class="search-input" placeholder="搜索链接..." autocomplete="off" aria-label="搜索链接">
    <div id="search-results" class="search-results" hidden></div>
  </div>` : ''

  return `<header class="site-header">
  <div class="header-content">
    <a href="{{ .Site.Home.Permalink }}" class="site-title">{{ .Site.Title }}</a>
    <div class="header-actions">
      ${searchBox}
      ${darkModeToggle}
    </div>
  </div>
</header>`
}

/**
 * 生成侧边栏局部模板
 */
function generateSidebarPartial(): string {
  return `<nav class="sidebar-nav" aria-label="导航">
  <div class="sidebar-section">
    <h2 class="sidebar-heading">分类</h2>
    <ul class="sidebar-list">
      {{ range $name, $taxonomy := .Site.Taxonomies.categories }}
      <li class="sidebar-item">
        <a href="{{ "/categories/" | relLangURL }}{{ $name | urlize }}/" class="sidebar-link">
          {{ $name | humanize }}
          <span class="sidebar-count">{{ len $taxonomy }}</span>
        </a>
      </li>
      {{ end }}
    </ul>
  </div>
  <div class="sidebar-section">
    <h2 class="sidebar-heading">所有链接</h2>
    <ul class="sidebar-list">
      {{ range where .Site.RegularPages "Section" "links" }}
      <li class="sidebar-item">
        <a href="{{ .Permalink }}" class="sidebar-link">{{ .Title }}</a>
      </li>
      {{ end }}
    </ul>
  </div>
</nav>`
}

/**
 * 生成底部局部模板
 */
function generateFooterPartial(): string {
  return `<footer class="site-footer">
  <p>Generated by <a href="https://gohugo.io/" target="_blank" rel="noopener">Hugo</a> & Link Organizer</p>
</footer>`
}

/**
 * 生成搜索局部模板
 */
function generateSearchPartial(): string {
  return `<!-- Search functionality handled by search.js -->`
}

/**
 * 生成静态资源
 */
async function generateAssets(basePath: string, config: ExportConfig): Promise<void> {
  // CSS 样式文件
  const cssContent = generateCSS(config)
  await fs.writeFile(path.join(basePath, 'static', 'css', 'style.css'), cssContent, 'utf-8')

  // 主题切换 JS
  if (config.features.darkModeToggle) {
    const themeJs = generateThemeScript()
    await fs.writeFile(path.join(basePath, 'static', 'js', 'theme.js'), themeJs, 'utf-8')
  }

  // 搜索 JS
  if (config.features.searchEnabled) {
    const searchJs = generateSearchScript()
    await fs.writeFile(path.join(basePath, 'static', 'js', 'search.js'), searchJs, 'utf-8')
  }

  // 回到顶部 JS
  if (config.features.backToTopButton) {
    const backToTopJs = generateBackToTopScript()
    await fs.writeFile(path.join(basePath, 'static', 'js', 'back-to-top.js'), backToTopJs, 'utf-8')
  }
}

/**
 * 生成 CSS 样式
 */
function generateCSS(config: ExportConfig): string {
  return `/* ===== CSS Variables ===== */
:root {
  --bg-primary: #fafafa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0f0f0;
  --text-primary: #2c2c2c;
  --text-secondary: #6b6b6b;
  --accent-color: #5b9bd5;
  --accent-hover: #4a8bc5;
  --border-color: #d0d0d0;
  --border-width: 2px;
  --shadow-color: rgba(0, 0, 0, 0.08);
  --radius: 10px;
  --max-width: 1200px;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #252525;
  --bg-tertiary: #303030;
  --text-primary: #e8e8e8;
  --text-secondary: #a0a0a0;
  --accent-color: #6baae6;
  --accent-hover: #7bbaf6;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
}

/* ===== Reset & Base ===== */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  transition: background-color 0.2s ease, color 0.2s ease;
}

a {
  color: var(--accent-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* ===== Layout ===== */
.container {
  display: grid;
  grid-template-columns: 1fr;
  max-width: var(--max-width);
  margin: 0 auto;
  min-height: calc(100vh - 120px);
}

@media (min-width: 768px) {
  .container {
    grid-template-columns: 240px 1fr;
  }
}

.main-content {
  padding: 20px;
}

/* ===== Header ===== */
.site-header {
  background: var(--bg-secondary);
  border-bottom: var(--border-width) solid var(--border-color);
  padding: 12px 20px;
}

.header-content {
  max-width: var(--max-width);
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.site-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* ===== Search ===== */
.search-container {
  position: relative;
}

.search-input {
  width: 200px;
  padding: 8px 12px;
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius);
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.search-result-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--bg-tertiary);
}

.search-result-item a {
  display: block;
  color: var(--text-primary);
}

.search-result-item strong {
  display: block;
  margin-bottom: 2px;
}

.search-result-item small {
  color: var(--text-secondary);
  font-size: 12px;
}

.search-no-results {
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
}

/* ===== Sidebar ===== */
.sidebar {
  background: var(--bg-secondary);
  border-right: var(--border-width) solid var(--border-color);
  padding: 16px;
}

.sidebar-nav {
  position: sticky;
  top: 16px;
}

.sidebar-section {
  margin-bottom: 24px;
}

.sidebar-heading {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.sidebar-list {
  list-style: none;
}

.sidebar-item {
  margin-bottom: 4px;
}

.sidebar-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  color: var(--text-primary);
  border-radius: var(--radius);
  transition: background-color 0.15s ease;
}

.sidebar-link:hover {
  background: var(--bg-tertiary);
  text-decoration: none;
}

.sidebar-count {
  font-size: 11px;
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 12px;
  color: var(--text-secondary);
}

/* ===== Page Header ===== */
.page-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: var(--border-width) solid var(--border-color);
}

.page-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.page-description {
  color: var(--text-secondary);
}

.back-link {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 14px;
}

/* ===== Links Grid ===== */
.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* ===== Link Card ===== */
.link-card {
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.link-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.link-card__link {
  display: flex;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  gap: 12px;
}

.link-card__link:hover {
  text-decoration: none;
}

.link-card__favicon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 4px;
}

.link-card__content {
  flex: 1;
  min-width: 0;
}

.link-card__title {
  font-size: 16px;
  margin-bottom: 6px;
  color: var(--accent-color);
  word-break: break-word;
}

.link-card__description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.link-card__url {
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.link-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  color: var(--text-secondary);
}

.link-card__external {
  flex-shrink: 0;
  color: var(--text-secondary);
  opacity: 0.5;
}

/* ===== Link Detail ===== */
.link-detail__card {
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
}

.link-detail__favicon {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  border-radius: 8px;
}

.link-detail__description {
  margin: 16px 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.link-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

/* ===== Theme Toggle ===== */
.theme-toggle {
  width: 40px;
  height: 40px;
  padding: 0;
  border: var(--border-width) solid var(--border-color);
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.theme-toggle:hover {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.sun-icon { display: none; }
.moon-icon { display: block; }

[data-theme="dark"] .sun-icon { display: block; }
[data-theme="dark"] .moon-icon { display: none; }

/* ===== Back to Top ===== */
.back-to-top {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  padding: 0;
  border: var(--border-width) solid var(--border-color);
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--shadow-color);
  transition: all 0.15s ease;
  z-index: 100;
}

.back-to-top:hover {
  background: var(--accent-hover);
  transform: scale(1.1);
}

.back-to-top[hidden] {
  opacity: 0;
  pointer-events: none;
}

/* ===== Footer ===== */
.site-footer {
  background: var(--bg-secondary);
  border-top: var(--border-width) solid var(--border-color);
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

/* ===== Responsive ===== */
@media (max-width: 767px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .links-grid {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }
}

/* ===== Accessibility ===== */
:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}`
}

/**
 * 生成主题切换脚本
 */
function generateThemeScript(): string {
  return `// Theme toggle functionality
(function() {
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    html.setAttribute('data-theme', 'dark');
  }

  document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
})();`
}

/**
 * 生成搜索脚本
 */
function generateSearchScript(): string {
  return `// Search functionality
(function() {
  let searchData = [];
  let fuse = null;

  document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    if (!input || !results) return;

    // Load search data
    fetch('/links-data.json')
      .then(r => r.json())
      .then(data => {
        searchData = data;
        // Simple search implementation
      })
      .catch(err => console.error('Failed to load search data:', err));

    let debounceTimer;
    input.addEventListener('input', function(e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(e.target.value, results);
      }, 200);
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-container')) {
        results.hidden = true;
      }
    });
  });

  function performSearch(query, resultsEl) {
    if (!query || !searchData.length) {
      resultsEl.hidden = true;
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = searchData.filter(item =>
      item.title?.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery) ||
      item.url?.toLowerCase().includes(lowerQuery) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    ).slice(0, 10);

    if (matches.length === 0) {
      resultsEl.innerHTML = '<div class="search-no-results">未找到结果</div>';
    } else {
      resultsEl.innerHTML = matches.map(item => \`
        <div class="search-result-item">
          <a href="\${item.url}" target="_blank" rel="noopener">
            <strong>\${escapeHtml(item.title)}</strong>
            <small>\${escapeHtml(item.url)}</small>
          </a>
        </div>
      \`).join('');
    }

    resultsEl.hidden = false;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();`
}

/**
 * 生成回到顶部脚本
 */
function generateBackToTopScript(): string {
  return `// Back to top button
(function() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 300) {
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  }, { passive: true });

  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();`
}

/**
 * 复制 favicons 到静态目录
 */
async function copyFavicons(basePath: string, links: Link[]): Promise<void> {
  const faviconDir = path.join(basePath, 'static', 'images', 'favicons')

  for (const link of links) {
    if (link.favicon && link.favicon.startsWith('data:')) {
      // Skip base64 encoded favicons for now
      continue
    } else if (link.favicon) {
      // Could download and save external favicons
      // For now, we'll just reference the URL directly in templates
    }
  }
}

/**
 * 统计生成的文件数量
 */
async function countGeneratedFiles(basePath: string): Promise<number> {
  let count = 0

  async function countDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await countDir(fullPath)
      } else {
        count++
      }
    }
  }

  await countDir(basePath)
  return count
}

/**
 * 转义 TOML 字符串
 */
function escapeToml(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 转义 Markdown 字符串
 */
function escapeMarkdown(str: string): string {
  return str.replace(/([#*[\]])/g, '\\$1')
}

/**
 * 生成 slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}
