import fetch from 'node-fetch'
import type { AIConfig, Link, Folder } from '../types'

// ==================== 分批处理配置 ====================
const BATCH_SIZE = 40        // 每批链接数
const BATCH_DELAY_MS = 1500  // 批次间延迟（避免速率限制）
const MAX_RETRIES = 3        // 最大重试次数
const RETRY_DELAY_MS = 2000  // 重试基础延迟

/** 进度回调类型 */
export type ProgressCallback = (progress: {
  current: number
  total: number
  phase: 'processing' | 'merging' | 'done'
  message: string
}) => void

// ==================== 链接→MD 转换 ====================

/**
 * 将一批链接转为简化 MD 格式（不含已有分类，让 AI 自由分类）
 */
function linksToMdBatch(links: Link[]): string {
  const lines: string[] = []
  for (const link of links) {
    lines.push(`- [${link.title || link.url}](${link.url})`)
    if (link.description) {
      lines.push(`  > ${link.description}`)
    }
  }
  return lines.join('\n')
}

// ==================== Prompt 构建 ====================

/**
 * 为单批链接构建 prompt（更紧凑，减少 token 消耗）
 */
function buildBatchPrompt(links: Link[], batchIndex: number, totalBatches: number): string {
  const md = linksToMdBatch(links)

  return `你是一个链接分类助手。请对以下链接列表按内容主题分类。

## 格式规则
- 使用 ## 开头作为分类标题
- 每个链接格式：[标题](URL)
- 链接有描述时，在下一行用 > 描述
- 只返回 Markdown，不要额外说明

## 链接列表
${md}

## 要求
1. 按主题归类（如：开发工具、技术文档、设计资源、视频娱乐、新闻资讯、社区论坛、学习教程等）
2. 同名同类链接合并到一个分类下
3. 保留原标题和URL
4. 没有描述的可以补充简短描述
5. 无法归类的放在 ## 其他 中

请直接返回整理好的 Markdown。`
}

// ==================== API 调用（带重试） ====================

/**
 * 调用 AI API，返回 MD 内容（带重试和指数退避）
 */
async function callAIWithRetry(
  config: AIConfig,
  prompt: string,
  retries: number = MAX_RETRIES
): Promise<string> {
  const apiUrl = config.baseUrl || 'https://api.openai.com/v1/chat/completions'

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个链接分类助手。请只返回 Markdown 格式的内容，不要加任何解释。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,      // 降低 temperature 提高一致性
          max_tokens: 4000,       // 每批结果最多 4000 token
          top_p: 0.9
        })
      } as any)

      if (!response.ok) {
        const status = response.status
        const errorText = await response.text()

        // 429 Too Many Requests → 指数退避重试
        if (status === 429 && attempt < retries) {
          const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
          console.warn(`Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt}/${retries})...`)
          await sleep(waitMs)
          continue
        }

        // 5xx 服务器错误 → 重试
        if (status >= 500 && attempt < retries) {
          console.warn(`Server error ${status}, retrying (attempt ${attempt}/${retries})...`)
          await sleep(RETRY_DELAY_MS)
          continue
        }

        let errorMsg = `API 请求失败 (${status})`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error?.message) {
            errorMsg = errorJson.error.message
          }
        } catch {}
        throw new Error(errorMsg)
      }

      const data = await response.json() as Record<string, unknown>
      let content = (data as any).choices?.[0]?.message?.content as string

      if (!content || content.trim().length === 0) {
        // 空响应也重试
        if (attempt < retries) {
          console.warn(`Empty response, retrying (attempt ${attempt}/${retries})...`)
          await sleep(RETRY_DELAY_MS)
          continue
        }
        throw new Error('AI 返回了空内容')
      }

      // 清理响应
      content = cleanMdResponse(content)
      return content

    } catch (error: any) {
      // 网络错误 → 重试
      if (attempt < retries) {
        const msg = error?.message || ''
        const isNetworkError =
          msg.includes('fetch') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ECONNRESET')

        if (isNetworkError) {
          console.warn(`Network error, retrying (attempt ${attempt}/${retries}): ${msg}`)
          await sleep(RETRY_DELAY_MS)
          continue
        }
      }
      throw error
    }
  }

  throw new Error(`API 调用失败，已重试 ${retries} 次`)
}

/** 清理 AI 返回的 MD 内容 */
function cleanMdResponse(content: string): string {
  // 移除 markdown 代码块包裹
  const codeBlockMatch = content.match(/```(?:markdown|md)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim()
  }

  // 去除前置废话（如 "好的，以下是..."）
  const firstHashIndex = content.indexOf('##')
  if (firstHashIndex > 0 && firstHashIndex < 500) {
    content = content.substring(firstHashIndex)
  }

  return content.trim()
}

// ==================== 结果合并 ====================

export interface CategorizedLink {
  title: string
  url: string
  description: string
  category: string  // 所属分类名
}

/**
 * 从多批 MD 结果中提取分类和链接，去重合并，保留分类关系
 */
function mergeBatchResults(
  batchResults: string[],
  allOriginalLinks: Link[]
): { links: CategorizedLink[]; categories: string[] } {
  const seenUrls = new Set<string>()
  const links: CategorizedLink[] = []
  const categories: string[] = []

  for (const md of batchResults) {
    const lines = md.split(/\r?\n/)

    let currentCategory = '其他'
    let pendingDesc = ''

    for (const line of lines) {
      // 匹配分类标题 (## 或 ###)
      const headingMatch = line.match(/^(#{2,3})\s+(.+)/)
      if (headingMatch) {
        const name = headingMatch[2].trim()
        if (name) {
          currentCategory = name
          if (!categories.includes(name)) {
            categories.push(name)
          }
        }
        pendingDesc = ''
        continue
      }

      // 匹配引用行（描述）
      const quoteMatch = line.match(/^>\s*(.*)/)
      if (quoteMatch) {
        pendingDesc = quoteMatch[1].trim()
        continue
      }

      // 匹配链接
      const linkMatch = line.match(/\[([^\]]+)\]\((.+)\)/)
      if (linkMatch) {
        const title = linkMatch[1].trim()
        let url = linkMatch[2].trim()
        url = url.replace(/[。，,\.;；]+$/, '').trim()

        if (!url || !title) continue
        if (!/^https?:\/\//i.test(url)) continue

        // 去重（按 URL）
        if (seenUrls.has(url)) {
          pendingDesc = ''
          continue
        }
        seenUrls.add(url)

        links.push({
          title,
          url,
          description: pendingDesc,
          category: currentCategory
        })
        pendingDesc = ''
      }
    }
  }

  // 检查是否有遗漏的原始链接
  for (const orig of allOriginalLinks) {
    if (!seenUrls.has(orig.url)) {
      seenUrls.add(orig.url)
      links.push({
        title: orig.title || orig.url,
        url: orig.url,
        description: orig.description || '',
        category: '其他'
      })
    }
  }

  return { links, categories }
}

/**
 * 将合并结果转为分类结构化的 MD（用于 parseMd 解析）
 */
function categorizedToMarkdown(result: { links: CategorizedLink[]; categories: string[] }): string {
  // 按分类分组
  const categoryMap = new Map<string, CategorizedLink[]>()
  for (const link of result.links) {
    const cat = link.category || '其他'
    if (!categoryMap.has(cat)) categoryMap.set(cat, [])
    categoryMap.get(cat)!.push(link)
  }

  const lines: string[] = []

  // 先输出有分类名的分组
  for (const cat of result.categories) {
    const catLinks = categoryMap.get(cat)
    if (!catLinks || catLinks.length === 0) continue
    lines.push(`## ${cat}`)
    lines.push('')
    for (const link of catLinks) {
      lines.push(`[${link.title}](${link.url})`)
      if (link.description) {
        lines.push(`> ${link.description}`)
      }
      lines.push('')
    }
  }

  // 再输出"其他"（未在 categories 列表中但属于"其他"的链接）
  const otherLinks = categoryMap.get('其他')
  if (otherLinks && otherLinks.length > 0) {
    lines.push('## 其他')
    lines.push('')
    for (const link of otherLinks) {
      lines.push(`[${link.title}](${link.url})`)
      if (link.description) {
        lines.push(`> ${link.description}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}

// ==================== 主入口：分批整理 ====================

export interface BatchOrganizeResult {
  success: boolean
  links: CategorizedLink[]
  categories: string[]
  mdContent: string  // 合并后的完整 MD（已按分类组织）
}

/**
 * 分批整理链接（支持任意数量）
 * @param links 所有链接
 * @param config AI 配置
 * @param onProgress 进度回调
 */
export async function organizeWithAI_Batch(
  links: Link[],
  config: AIConfig,
  onProgress?: ProgressCallback
): Promise<BatchOrganizeResult> {
  if (links.length === 0) {
    throw new Error('没有可整理的链接')
  }

  // 分割批次
  const batches: Link[][] = []
  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    batches.push(links.slice(i, i + BATCH_SIZE))
  }

  const totalBatches = batches.length
  const batchResults: string[] = []
  const failedBatches: number[] = []

  console.log(`Starting batch AI organization: ${links.length} links in ${totalBatches} batches`)

  // 逐批处理
  for (let i = 0; i < totalBatches; i++) {
    const batch = batches[i]

    onProgress?.({
      current: i + 1,
      total: totalBatches,
      phase: 'processing',
      message: `正在整理第 ${i + 1}/${totalBatches} 批（${batch.length} 个链接）...`
    })

    try {
      const prompt = buildBatchPrompt(batch, i, totalBatches)
      const mdContent = await callAIWithRetry(config, prompt)
      batchResults.push(mdContent)
      console.log(`Batch ${i + 1}/${totalBatches} completed, output length: ${mdContent.length}`)
    } catch (error: any) {
      console.error(`Batch ${i + 1}/${totalBatches} failed:`, error?.message)
      failedBatches.push(i + 1)

      // 如果第一批就失败了，直接抛出
      if (i === 0 && batchResults.length === 0) {
        throw error
      }
      // 否则跳过失败批次继续
      continue
    }

    // 批次间延迟（避免速率限制）
    if (i < totalBatches - 1) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  if (batchResults.length === 0) {
    throw new Error('所有批次都处理失败了，请检查 API 配置')
  }

  // 合并结果
  onProgress?.({
    current: totalBatches,
    total: totalBatches,
    phase: 'merging',
    message: '正在合并结果并去重...'
  })

  const merged = mergeBatchResults(batchResults, links)

  // 生成分类结构化的 MD
  const finalMd = categorizedToMarkdown(merged)

  onProgress?.({
    current: totalBatches,
    total: totalBatches,
    phase: 'done',
    message: `整理完成！共 ${merged.links.length} 个链接，${merged.categories.length} 个分类`
  })

  return {
    success: true,
    links: merged.links,
    categories: merged.categories,
    mdContent: finalMd
  }
}

// ==================== 工具函数 ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== 测试连接 ====================

export async function testAIConnection(config: AIConfig): Promise<boolean> {
  try {
    const simplePrompt = 'Reply with just "ok".'
    const apiUrl = config.baseUrl || 'https://api.openai.com/v1/chat/completions'

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: simplePrompt }],
        max_tokens: 20
      })
    } as any)
    return response.ok
  } catch {
    return false
  }
}
