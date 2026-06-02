import { v4 as uuidv4 } from 'uuid'
import type { Link, Folder, ImportResult } from '../types'

export function parseNetscapeBookmarks(htmlContent: string): ImportResult {
  const links: Link[] = []
  const folders: Folder[] = []
  const errors: Array<{ url: string; reason: string }> = []

  try {
    // 移除注释
    const cleanedHtml = htmlContent.replace(/<!--[\s\S]*?-->/g, '')

    // 找到顶层 DL 并开始流式解析
    const topDlMatch = cleanedHtml.match(/<DL[^>]*>/i)
    if (topDlMatch) {
      const contentStart = topDlMatch.index! + topDlMatch[0].length
      parseDlContent(cleanedHtml, contentStart, links, folders, null, errors)
    }

    return {
      success: true,
      importedCount: links.length,
      failedCount: errors.length,
      errors,
      links,
      folders
    }
  } catch (error: unknown) {
    return {
      success: false,
      importedCount: 0,
      failedCount: 0,
      errors: [{ url: '', reason: `Parse error: ${String(error)}` }],
      links: [],
      folders: []
    }
  }
}

/**
 * 流式解析 DL 内容
 * 从 startPos 开始扫描，逐个处理 DT 元素
 * 遇到嵌套的 DL 时递归调用
 * 返回解析结束的位置（指向 </DL> 之后）
 */
function parseDlContent(
  html: string,
  startPos: number,
  links: Link[],
  folders: Folder[],
  parentFolderId: string | null,
  errors: Array<{ url: string; reason: string }>
): number {
  let pos = startPos

  while (pos < html.length) {
    const remaining = html.substring(pos)

    // 遇到 </DL> — 返回给调用者处理
    if (/^\s*<\/DL>/i.test(remaining)) {
      const dlCloseMatch = remaining.match(/<\/DL>/i)!
      return pos + dlCloseMatch.index! + dlCloseMatch[0].length
    }

    // 查找 DT 开标签
    const dtMatch = remaining.match(/<DT[^>]*>/i)
    if (!dtMatch) {
      // 没有更多 DT，跳到 </DL> 或结尾
      const dlClose = remaining.match(/<\/DL>/i)
      return dlClose ? pos + dlClose.index! : html.length
    }

    // 跳过 DT 标签
    pos = pos + dtMatch.index! + dtMatch[0].length

    // 找到此 DT 的结束位置
    const afterDt = html.substring(pos)
    const nextDtIdx = afterDt.search(/<DT[^>]*>/i)
    const nextDlCloseIdx = afterDt.search(/<\/DL>/i)

    const candidates: number[] = []
    if (nextDtIdx !== -1) candidates.push(nextDtIdx)
    if (nextDlCloseIdx !== -1) candidates.push(nextDlCloseIdx)
    const endOffset = candidates.length > 0 ? Math.min(...candidates) : afterDt.length

    const dtEndPos = pos + endOffset
    const dtContent = html.substring(pos, dtEndPos).trim()

    // 检查是否是文件夹 (H3)
    const isFolder = /<H3[^>]*>/i.test(dtContent)

    if (isFolder) {
      const h3Match = dtContent.match(/<H3[^>]*>([\s\S]*?)<\/H3>/i)
      const h3Attrs = dtContent.match(/<H3([^>]*)>/i)
      const folderName = h3Match ? stripHtmlTags(h3Match[1]).trim() : 'Untitled Folder'
      const addDate = h3Attrs ? extractAttribute(h3Attrs[1], 'ADD_DATE') : null

      const folderId = uuidv4()
      folders.push({
        id: folderId,
        name: folderName,
        parentId: parentFolderId,
        order: folders.length,
        createdAt: addDate ? parseInt(addDate) * 1000 : Date.now(),
        updatedAt: Date.now()
      })

      // 检查此 DT 内容中是否包含子 <DL>
      const dlOpenInDt = afterDt.substring(0, endOffset).search(/<DL[^>]*>/i)
      if (dlOpenInDt !== -1) {
        const dlStart = pos + dlOpenInDt
        const dlTagMatch = html.substring(dlStart).match(/<DL[^>]*>/i)!
        const childContentStart = dlStart + dlTagMatch[0].length
        // 递归解析子 DL
        const afterChild = parseDlContent(html, childContentStart, links, folders, folderId, errors)
        pos = afterChild
      } else {
        pos = dtEndPos
      }
    } else {
      // 检查是否是链接 (A)
      const aMatch = dtContent.match(/<A[^>]*>([\s\S]*?)<\/A>/i)
      if (aMatch) {
        const title = stripHtmlTags(aMatch[1]).trim()
        const urlMatch = dtContent.match(/HREF=["']([^"']+)["']/i)
        const url = urlMatch ? urlMatch[1] : null
        const addDateMatch = dtContent.match(/ADD_DATE=["'](\d+)["']/i)
        const iconMatch = dtContent.match(/ICON(?:_URI)?=["']([^"']+)["']/i)

        if (!url) {
          errors.push({ url: title, reason: 'No URL found' })
        } else {
          try {
            new URL(url)
            links.push({
              id: uuidv4(),
              url,
              title: title || url,
              description: '',
              favicon: iconMatch ? iconMatch[1] : null,
              tags: [],
              folderId: parentFolderId,
              order: links.length,
              createdAt: addDateMatch ? parseInt(addDateMatch[1]) * 1000 : Date.now(),
              updatedAt: Date.now()
            })
          } catch {
            errors.push({ url, reason: 'Invalid URL' })
          }
        }
      }
      pos = dtEndPos
    }
  }

  return html.length
}

function extractAttribute(attrs: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i')
  const match = attrs.match(regex)
  return match ? match[1] : null
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}
