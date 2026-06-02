import fs from 'fs/promises'
import path from 'path'
import type { Link, Folder, ExportConfig, ExportResult } from '../types'

export async function generateSite(
  config: ExportConfig,
  links: Link[],
  folders: Folder[]
): Promise<ExportResult> {
  // 兼容旧版 config
  const safeConfig = {
    ...config,
    accentColor: (config as any).accentColor || '#5b9bd5',
    accentColorLight: (config as any).accentColorLight || (config as any).accentColor || '#5b9bd5',
    accentColorDark: (config as any).accentColorDark || '#6baae6',
    logo: (config as any).logo || '',
    favicon: (config as any).favicon || '',
    faviconText: (config as any).faviconText || '',
    faviconBgColor: (config as any).faviconBgColor || '#5b9bd5',
    faviconTextColor: (config as any).faviconTextColor || '#ffffff'
  }
  try {
    const { outputPath, siteTitle, features, accentColor: siteAccentColor, accentColorLight: siteAccentLight, accentColorDark: siteAccentDark, logo: configLogo, favicon: configFavicon, faviconText: configFaviconText, faviconBgColor: configFaviconBgColor, faviconTextColor: configFaviconTextColor } = safeConfig

    // 确保输出目录存在
    await fs.mkdir(outputPath, { recursive: true })

    // 按文件夹组织链接
    const folderMap = new Map<string | 'root', Link[]>()
    const rootLinks: Link[] = []

    for (const link of links) {
      if (link.folderId) {
        const arr = folderMap.get(link.folderId) || []
        arr.push(link)
        folderMap.set(link.folderId, arr)
      } else {
        rootLinks.push(link)
      }
    }

    // 构建文件夹树
    const rootFolders = folders.filter(f => f.parentId === null)

    function buildFolderTree(parentId: string | null): Folder[] {
      return folders
        .filter(f => f.parentId === parentId)
        .sort((a, b) => a.order - b.order)
    }

    function getFolderLinks(folderId: string): Link[] {
      return folderMap.get(folderId) || []
    }

    // 递归收集所有子文件夹的链接
    function collectFolderLinks(folderId: string): Link[] {
      const result: Link[] = [...getFolderLinks(folderId)]
      const children = folders.filter(f => f.parentId === folderId)
      for (const child of children) {
        result.push(...collectFolderLinks(child.id))
      }
      return result
    }

    // 生成 HTML
    const html = generateHTML(siteTitle, features, links, rootLinks, rootFolders, folders, buildFolderTree, collectFolderLinks, getFolderLinks, configLogo || '', configFavicon || '', configFaviconText || '', configFaviconBgColor, configFaviconTextColor, siteAccentColor || '#5b9bd5', siteAccentLight || '#5b9bd5', siteAccentDark || '#6baae6')

    // 写入文件
    await fs.writeFile(path.join(outputPath, 'index.html'), html, 'utf-8')

    return {
      success: true,
      outputPath,
      filesGenerated: 1,
      error: undefined
    }
  } catch (error) {
    return {
      success: false,
      outputPath: config.outputPath,
      filesGenerated: 0,
      error: String(error)
    }
  }
}

function generateHTML(
  siteTitle: string,
  features: ExportConfig['features'],
  links: Link[],
  rootLinks: Link[],
  rootFolders: Folder[],
  allFolders: Folder[],
  buildFolderTree: (parentId: string | null) => Folder[],
  collectFolderLinks: (folderId: string) => Link[],
  getFolderLinks: (folderId: string) => Link[],
  customLogo: string,
  customFavicon: string,
  faviconText: string,
  faviconBgColor: string,
  faviconTextColor: string,
  siteAccentColor: string,
  siteAccentLight: string,
  siteAccentDark: string
): string {
  const hasDarkMode = features.darkModeToggle
  const hasSearch = features.searchEnabled
  const hasSidebar = features.sidebarNavigation
  const hasBackToTop = features.backToTopButton
  const faviconMode = features.showFavicons
  const showFaviconArea = faviconMode !== 'none'

  // 生成导航栏文件夹内容
  function renderNavFolders(parentId: string | null): string {
    const children = buildFolderTree(parentId)
    if (children.length === 0) return ''
    return `<ul>${children.map(f => {
      const folderLinks = collectFolderLinks(f.id)
      const subFolders = allFolders.filter(sf => sf.parentId === f.id)
      const hasChildren = subFolders.length > 0
      return `
        <li class="nav-folder">
          <div class="nav-folder-header" data-folder-id="${escapeAttr(f.id)}">
            ${hasChildren
              ? `<span class="nav-arrow" onclick="event.stopPropagation();this.parentElement.parentElement.classList.toggle('collapsed')">▾</span>`
              : `<span class="nav-arrow nav-arrow--hidden">▾</span>`
            }
            <span class="nav-folder-name">${escapeHTML(f.name)}</span>
            <span class="nav-count">${folderLinks.length}</span>
          </div>
          ${hasChildren ? `<div class="nav-folder-content">${renderNavFolders(f.id)}</div>` : ''}
        </li>`
    }).join('')}</ul>`
  }

  // 生成链接内容区域
  function renderLinkSection(folder: Folder, links: Link[], level: number): string {
    if (links.length === 0) return ''
    return `
      <section class="link-section" id="folder-${folder.id}">
        <h${Math.min(level + 2, 6)} class="section-title">${escapeHTML(folder.name)}</h${Math.min(level + 2, 6)}>
        ${links.map(l => renderLinkRow(l)).join('')}
      </section>`
  }

  function renderLinkRow(link: Link): string {
    const title = escapeHTML(link.title)
    const initialMatch = title.match(/[a-zA-Z\u4e00-\u9fff]/)
    const initial = initialMatch ? initialMatch[0].toUpperCase() : title.charAt(0).toUpperCase()
    const domain = getDomain(link.url)
    const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    // 使用 App 的 accent 色作为首字母背景色
    let faviconHTML = ''
    if (faviconMode === 'icon') {
      // 首字母始终显示作为背景，favicon 图片覆盖在上面
      faviconHTML = `<div class="link-favicon">
        <span class="link-favicon-initial">${initial}</span>
        <img src="${escapeAttr(link.favicon || googleFavicon)}" alt="" loading="lazy" decoding="async" onload="if(this.naturalWidth>16&&this.naturalHeight>16){this.style.opacity='1';this.previousElementSibling.style.opacity='0'}else{this.remove()}" onerror="this.remove()" class="link-favicon-img" />
      </div>`
    } else if (faviconMode === 'initial') {
      faviconHTML = `<div class="link-favicon"><span class="link-favicon-initial">${initial}</span></div>`
    }

    const descLine = link.description ? `<div class="link-line"><span class="link-desc">${escapeHTML(link.description)}</span></div>` : ''

    return `
      <article class="link-row">
        ${faviconHTML}
        <div class="link-body">
          <div class="link-line">
            <a href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer" class="link-title">${title}</a>
          </div>
          <div class="link-line">
            <span class="link-url">${escapeHTML(link.url)}</span>
          </div>
          ${descLine}
        </div>
      </article>`
  }

  // Logo HTML
  let logoHTML = ''
  if (customLogo) {
    const isImage = /^https?:\/\//.test(customLogo) && /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(customLogo)
    if (isImage) {
      logoHTML = `<img src="${escapeAttr(customLogo)}" alt="Logo" class="header-logo-img" />`
    } else {
      logoHTML = `<span class="header-logo-text">${escapeHTML(customLogo)}</span>`
    }
  }

  function getDomain(url: string): string {
    try { return new URL(url).hostname } catch { return '' }
  }

  // 递归生成文件夹和链接
  function renderContent(parentId: string | null): string {
    const children = buildFolderTree(parentId)
    if (children.length === 0) return ''
    return children.map(f => {
      const folderLinks = getFolderLinks(f.id)
      const subFolders = allFolders.filter(sf => sf.parentId === f.id)
      let section = ''
      if (folderLinks.length > 0 || subFolders.length > 0) {
        section += renderLinkSection(f, folderLinks, 1)
        section += renderContent(f.id)
      }
      return section
    }).join('')
  }

  // Favicon HTML
  let faviconLink = ''
  if (customFavicon) {
    // 自定义图片 favicon
    faviconLink = `<link rel="icon" href="${escapeAttr(customFavicon)}" />`
  } else if (faviconText) {
    // 文字 favicon → 生成带颜色的 SVG
    const char = faviconText.trim().charAt(0)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='${escapeAttr(faviconBgColor)}'/><text x='50' y='72' text-anchor='middle' font-size='70' font-weight='bold' fill='${escapeAttr(faviconTextColor)}' font-family='sans-serif'>${escapeHTML(char)}</text></svg>`
    faviconLink = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`
  }

  // 白天/暗夜使用各自独立的主题色
  const lightAccent = siteAccentLight || siteAccentColor || '#5b9bd5'
  const darkAccent = siteAccentDark || '#6baae6'

  return `<!DOCTYPE html>
<html lang="zh-CN"${hasDarkMode ? '' : ' class="light-only"'}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(siteTitle)}</title>
${faviconLink}
<style>
/* ===== Reset & Base ===== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root {
  --bg: #fafafa; --bg-card: #fff; --bg-hover: #f0f0f0;
  --text: #2c2c2c; --text-secondary: #6b6b6b;
  --accent: ${lightAccent}; --border: #d0d0d0; --shadow: rgba(0,0,0,0.08);
  --radius: 10px;
}
${hasDarkMode ? `.dark{--bg:#1a1a1a;--bg-card:#252525;--bg-hover:#303030;--text:#e8e8e8;--text-secondary:#a0a0a0;--accent:${darkAccent};--border:#404040;--shadow:rgba(0,0,0,0.3)}` : ''}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;transition:background .2s,color .2s}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}

/* ===== Layout ===== */
.app{display:flex;min-height:100vh}
${hasSidebar ? `.sidebar{width:260px;background:var(--bg-card);border-right:2px solid var(--border);position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:100;padding:16px}
.sidebar-title-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border)}
.sidebar-title-row h2{font-size:16px;font-weight:600;margin:0;padding:0;border:none}
.sidebar-toggle-btns{display:flex;gap:4px}
.sidebar-toggle-btn{width:28px;height:28px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text-secondary);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1}
.sidebar-toggle-btn:hover{background:var(--bg-hover);color:var(--text)}
.main-area{margin-left:260px;flex:1;min-width:0}` : `.main-area{flex:1;min-width:0;margin:0 auto;max-width:1200px}`}

/* ===== Header ===== */
.header{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:var(--bg-card);border-bottom:2px solid var(--border);position:sticky;top:0;z-index:50;gap:12px;flex-wrap:wrap}
.header-title-wrap{display:flex;align-items:center;gap:10px}
.header-logo{flex-shrink:0}
.header-logo-img{height:32px;width:auto;border-radius:4px}
.header-logo-text{font-size:18px;font-weight:700;color:var(--accent);padding:2px 10px;border:2px solid var(--accent);border-radius:6px}
.header h1{font-size:20px;font-weight:700}
.header-actions{display:flex;align-items:center;gap:8px}
${hasSearch ? `.search-input{padding:8px 14px;border:2px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:14px;width:220px;outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}` : ''}
${hasDarkMode ? `.theme-btn{width:36px;height:36px;border:2px solid var(--border);border-radius:var(--radius);background:var(--bg-card);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .15s;color:var(--text)}
.theme-btn:hover{border-color:var(--accent);background:var(--bg-hover)}` : ''}

/* ===== Main Content ===== */
.main-content{padding:20px;max-width:1200px}

/* ===== Section ===== */
.link-section{scroll-margin-top:64px}
.section-title{font-size:18px;font-weight:600;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--border);color:var(--text)}

/* ===== Link Row ===== */
.links-list{display:flex;flex-direction:column;gap:1px;background:var(--border);border:2px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:16px}
.link-row{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:var(--bg-card);transition:background .12s}
.link-row:hover{background:var(--bg-hover)}
${showFaviconArea ? `.link-favicon{flex-shrink:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;position:relative;overflow:hidden}
.link-favicon-img{position:absolute;top:0;left:0;width:24px;height:24px;border-radius:4px;object-fit:contain;opacity:0;transition:opacity .15s}
.link-favicon-initial{width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:var(--accent);border-radius:4px;text-transform:uppercase;flex-shrink:0;transition:opacity .15s}` : ''}
.link-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.link-line{display:flex;align-items:center;gap:8px;min-width:0}
.link-title{font-size:14px;font-weight:500;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.link-url{font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.link-desc{font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ===== Navigation ===== */
${hasSidebar ? `.nav-folder{list-style:none}
.nav-folder-header{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;border-radius:6px;font-size:14px;transition:background .15s;user-select:none}
.nav-folder-header:hover{background:var(--bg-hover)}
.nav-folder.collapsed .nav-folder-content{display:none}
.nav-folder.collapsed .nav-arrow{transform:rotate(-90deg)}
.nav-arrow{display:inline-flex;align-items:center;justify-content:center;font-size:16px;transition:transform .15s;color:var(--text-secondary);width:24px;height:24px;cursor:pointer;border-radius:4px;flex-shrink:0}
.nav-arrow:hover{background:var(--bg-hover)}
.nav-arrow--hidden{visibility:hidden;cursor:default}
.nav-folder-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-count{font-size:11px;color:var(--text-secondary);background:var(--bg-hover);padding:1px 6px;border-radius:10px}
.nav-folder-content{padding-left:12px}
.nav-folder-content ul{list-style:none}
.sidebar ul{list-style:none}` : ''}

/* ===== Back to Top ===== */
${hasBackToTop ? `.back-to-top{position:fixed;bottom:24px;right:24px;width:44px;height:44px;border:2px solid var(--border);border-radius:50%;background:var(--bg-card);color:var(--text);font-size:20px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:999;transition:all .2s;box-shadow:0 2px 8px var(--shadow)}
.back-to-top:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.back-to-top.visible{display:flex}` : ''}

/* ===== Scrollbar ===== */
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:var(--bg-hover)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}

/* ===== No Results ===== */
.no-results{text-align:center;padding:60px 20px;color:var(--text-secondary)}
.no-results .icon{font-size:48px;margin-bottom:12px}

/* ===== Responsive ===== */
@media(max-width:768px){
  ${hasSidebar ? `.sidebar{display:none}.main-area{margin-left:0}` : ''}
  .header{flex-direction:column;align-items:stretch}
  ${hasSearch ? `.search-input{width:100%}` : ''}
}
</style>
</head>
<body${hasDarkMode ? ' class="light"' : ''}>
<div class="app">
  ${hasSidebar ? `
  <aside class="sidebar">
    <div class="sidebar-title-row">
      <h2>文件夹</h2>
      <div class="sidebar-toggle-btns">
        <button class="sidebar-toggle-btn" id="toggleAllBtn" onclick="var btn=this;var all=document.querySelectorAll('.nav-folder');if(all.length===0)return;var any=Array.from(all).some(f=>!f.classList.contains('collapsed'));all.forEach(f=>f.classList.toggle('collapsed',any));btn.textContent=any?'⊞':'⊟';btn.title=any?'全部展开':'全部收起'" title="切换展开/收起">⊟</button>
      </div>
    </div>
    <ul>
      <li class="nav-folder">
        <div class="nav-folder-header" onclick="document.querySelectorAll('.link-section').forEach(s=>s.style.display='')">
          <span class="nav-arrow" style="visibility:hidden">▾</span>
          <span class="nav-folder-name">全部链接</span>
          <span class="nav-count">${links.length}</span>
        </div>
      </li>
      ${renderNavFolders(null)}
    </ul>
  </aside>` : ''}

  <div class="main-area">
    <header class="header">
      <div class="header-title-wrap">
        ${logoHTML ? `<div class="header-logo">${logoHTML}</div>` : ''}
        <h1>${escapeHTML(siteTitle)}</h1>
      </div>
      <div class="header-actions">
        ${hasSearch ? `<input type="text" class="search-input" id="searchInput" placeholder="搜索链接标题..." oninput="handleSearch()" />` : ''}
        ${hasDarkMode ? `<button class="theme-btn" id="themeBtn" onclick="toggleTheme()" title="切换暗夜模式">🌙</button>` : ''}
      </div>
    </header>

    <main class="main-content">
      ${rootLinks.length > 0 ? `
      <section class="link-section" id="folder-root">
        <h2 class="section-title">未分类</h2>
        ${rootLinks.map(l => renderLinkRow(l)).join('')}
      </section>` : ''}
      ${renderContent(null)}
      <div class="no-results" id="noResults" style="display:none">
        <div class="icon">🔍</div>
        <p>未找到匹配的链接</p>
      </div>
    </main>
  </div>
</div>

${hasBackToTop ? `<button class="back-to-top" id="backToTop" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="回到顶部">↑</button>` : ''}

<script>
${hasDarkMode ? `
// 暗夜模式
(function(){
  const saved = localStorage.getItem('theme');
  if(saved === 'dark') document.body.className = 'dark';
  if(saved === 'dark') document.getElementById('themeBtn').textContent = '☀️';
})();
function toggleTheme(){
  const isDark = document.body.className === 'dark';
  document.body.className = isDark ? 'light' : 'dark';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '🌙' : '☀️';
}
` : ''}

${hasBackToTop ? `
// 回到顶部
window.addEventListener('scroll', function(){
  var btn = document.getElementById('backToTop');
  if(window.scrollY > 300) btn.classList.add('visible');
  else btn.classList.remove('visible');
});
` : ''}

${hasSearch ? `
// 搜索
function handleSearch(){
  var q = document.getElementById('searchInput').value.toLowerCase().trim();
  var sections = document.querySelectorAll('.link-section');
  var rows = document.querySelectorAll('.link-row');
  var noResults = document.getElementById('noResults');
  var hasVisible = false;
  
  if(!q){
    // 恢复所有 section 和 row 的显示
    sections.forEach(function(s){ s.style.display = '' });
    rows.forEach(function(r){ r.style.display = '' });
    noResults.style.display = 'none';
    return;
  }
  
  // 先隐藏所有 section，然后显示匹配的
  sections.forEach(function(s){ s.style.display = 'none' });
  
  rows.forEach(function(row){
    var title = row.querySelector('.link-title');
    if(title && title.textContent.toLowerCase().includes(q)){
      row.style.display = '';
      hasVisible = true;
      var section = row.closest('.link-section');
      if(section) section.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  
  noResults.style.display = hasVisible ? 'none' : '';
}
` : ''}

${hasSidebar ? `
// 导航点击跳转（通过 data-folder-id 精确匹配）
document.querySelectorAll('.nav-folder-header').forEach(function(el){
  el.addEventListener('click', function(e){
    var folderId = this.getAttribute('data-folder-id');
    if(folderId){
      var section = document.getElementById('folder-' + folderId);
      if(section){
        e.stopPropagation();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});
` : ''}
</script>
</body>
</html>`
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
