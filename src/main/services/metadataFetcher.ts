import fetch from 'node-fetch'
import type { LinkMetadata } from '../types'

interface FetchOptions {
  timeout?: number
}

const DEFAULT_TIMEOUT = 10000 // 10 seconds

/**
 * 从URL获取网站元数据（标题、描述、favicon等）
 */
export async function fetchMetadata(url: string, options: FetchOptions = {}): Promise<LinkMetadata> {
  const timeout = options.timeout || DEFAULT_TIMEOUT

  try {
    // 验证URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are supported')
    }

    // 获取页面内容
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkOrganizer/1.0)'
      },
      signal: controller.signal
    } as any)

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const html = await response.text()

    // 提取元数据
    const metadata: LinkMetadata = {
      title: extractTitle(html),
      description: extractDescription(html),
      favicon: extractFavicon(html, parsedUrl.origin),
      domain: parsedUrl.hostname,
      fetchStatus: 'success'
    }

    return metadata
  } catch (error) {
    console.error(`Failed to fetch metadata for ${url}:`, error)
    return {
      title: '',
      description: '',
      favicon: null,
      domain: extractDomain(url),
      fetchStatus: 'failed'
    }
  }
}

/**
 * 批量获取元数据（带并发控制）
 */
export async function fetchMetadataBatch(
  urls: string[],
  concurrency: number = 5
): Promise<Map<string, LinkMetadata>> {
  const results = new Map<string, LinkMetadata>()
  const queue = [...urls]

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) break

      const metadata = await fetchMetadata(url)
      results.set(url, metadata)

      // 小延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // 启动并发worker
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker())
  await Promise.all(workers)

  return results
}

/**
 * 提取页面标题
 */
function extractTitle(html: string): string {
  // 优先使用 OG title
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) return decodeHtmlEntities(ogMatch[1].trim())

  // 其次使用 <title> 标签
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim())

  // 最后使用 meta title
  const metaMatch = html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i)
  if (metaMatch) return decodeHtmlEntities(metaMatch[1].trim())

  return ''
}

/**
 * 提取页面描述
 */
function extractDescription(html: string): string {
  // 优先使用 OG description
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) return decodeHtmlEntities(ogMatch[1].trim())

  // 其次使用 meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  if (metaMatch) return decodeHtmlEntities(metaMatch[1].trim())

  return ''
}

/**
 * 提取favicon URL
 */
function extractFavicon(html: string, baseUrl: string): string | null {
  // 尝试各种favicon link标签
  const selectors = [
    /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ]

  for (const regex of selectors) {
    const match = html.match(regex)
    if (match) {
      try {
        // 解析相对URL
        return new URL(match[1], baseUrl).href
      } catch {
        continue
      }
    }
  }

  // 回退到默认位置
  return `${baseUrl}/favicon.ico`
}

/**
 * 从URL提取域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * 解码HTML实体
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  }
  return text.replace(/&[a-zA-Z0-9#]+;/g, entity => entities[entity] || entity)
}

/**
 * 将favicon转换为Base64（可选，用于嵌入）
 */
export async function faviconToBase64(faviconUrl: string): Promise<string | null> {
  try {
    const response = await fetch(faviconUrl)
    if (!response.ok) return null

    const buffer = await response.buffer()
    const base64 = buffer.toString('base64')
    const contentType = response.headers.get('content-type') || 'image/x-icon'

    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}
