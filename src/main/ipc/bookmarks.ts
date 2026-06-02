import { ipcMain, BrowserWindow, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { parseNetscapeBookmarks } from '../services/bookmarkParser'
import { parseMd } from '../services/mdParser'
import type { ImportResult } from '../types'

export function setupBookmarksIpc(mainWindow: BrowserWindow) {
  // Parse HTML bookmark file
  ipcMain.handle('bookmarks:parse-html', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const result = parseNetscapeBookmarks(content)
      return result
    } catch (error) {
      console.error('Error parsing bookmarks:', error)
      return {
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [{ url: '', reason: String(error) }],
        links: [],
        folders: []
      }
    }
  })

  // Read Chrome bookmarks
  ipcMain.handle('bookmarks:read-chrome', async () => {
    try {
      let bookmarksPath: string

      if (process.platform === 'win32') {
        bookmarksPath = path.join(
          os.homedir(),
          'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'
        )
      } else if (process.platform === 'darwin') {
        bookmarksPath = path.join(
          os.homedir(),
          'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Bookmarks'
        )
      } else {
        bookmarksPath = path.join(
          os.homedir(),
          '.config', 'google-chrome', 'Default', 'Bookmarks'
        )
      }

      await fs.access(bookmarksPath)
      const content = await fs.readFile(bookmarksPath, 'utf-8')
      const data = JSON.parse(content)

      const result = parseChromeBookmarks(data.roots as ChromeBookmarkRoots)
      return result
    } catch (error) {
      console.error('Error reading Chrome bookmarks:', error)
      return {
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [{ url: '', reason: String(error) }],
        links: [],
        folders: []
      }
    }
  })

  // Read Firefox bookmarks
  ipcMain.handle('bookmarks:read-firefox', async () => {
    try {
      // Firefox stores bookmarks in a SQLite database (places.sqlite).
      // We attempt multiple strategies:
      // 1. Parse the latest JSON backup from the bookmarkbackups directory
      // 2. Fall back to parsing the SQLite database via better-sqlite3 if available

      let profilePath: string
      if (process.platform === 'win32') {
        profilePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')
      } else if (process.platform === 'darwin') {
        profilePath = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles')
      } else {
        profilePath = path.join(os.homedir(), '.mozilla', 'firefox')
      }

      // Find the default profile directory
      const profiles = await fs.readdir(profilePath)
      const defaultProfile = profiles.find(p => p.endsWith('.default-release') || p.endsWith('.default'))

      if (!defaultProfile) {
        return {
          success: false,
          importedCount: 0,
          failedCount: 0,
          errors: [{ url: '', reason: '未找到 Firefox 配置文件。请确保 Firefox 已安装并使用过。' }],
          links: [],
          folders: []
        }
      }

      const profileDir = path.join(profilePath, defaultProfile)

      // Strategy 1: Try JSON backup files (most reliable, no native deps needed)
      const backupDir = path.join(profileDir, 'bookmarkbackups')
      try {
        const backups = await fs.readdir(backupDir)
        const jsonBackups = backups
          .filter(f => f.endsWith('.jsonlz4') || f.endsWith('.json'))
          .sort()
          .reverse()

        if (jsonBackups.length > 0) {
          const latestBackup = jsonBackups[0]
          const backupPath = path.join(backupDir, latestBackup)

          // .jsonlz4 files are mozlz4 compressed, .json files are plain JSON
          if (latestBackup.endsWith('.jsonlz4')) {
            const buffer = await fs.readFile(backupPath)
            const decompressed = decompressMozLz4(buffer)
            const data = JSON.parse(decompressed)
            return parseFirefoxJson(data)
          } else {
            const content = await fs.readFile(backupPath, 'utf-8')
            const data = JSON.parse(content)
            return parseFirefoxJson(data)
          }
        }
      } catch (backupErr) {
        console.warn('Could not read Firefox backup:', backupErr)
      }

      // Strategy 2: Try reading places.sqlite with better-sqlite3
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const betterSqlite3 = require('better-sqlite3')
        const dbPath = path.join(profileDir, 'places.sqlite')
        await fs.access(dbPath)
        const result = await parseFirefoxSqlite(dbPath, betterSqlite3)
        return result
      } catch (sqliteErr) {
        console.warn('Could not read Firefox places.sqlite:', sqliteErr)
      }

      return {
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [{ url: '', reason: '无法读取 Firefox 书签。请尝试从 Firefox 导出书签为 HTML 文件，然后使用"从 HTML 文件导入"功能。' }],
        links: [],
        folders: []
      }
    } catch (error) {
      console.error('Error reading Firefox bookmarks:', error)
      return {
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [{ url: '', reason: String(error) }],
        links: [],
        folders: []
      }
    }
  })

  // Read Edge bookmarks
  ipcMain.handle('bookmarks:read-edge', async () => {
    try {
      let bookmarksPath: string

      if (process.platform === 'win32') {
        bookmarksPath = path.join(
          os.homedir(),
          'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks'
        )
      } else {
        return {
          success: false,
          importedCount: 0,
          failedCount: 0,
          errors: [{ url: '', reason: 'Edge only supported on Windows' }],
          links: [],
          folders: []
        }
      }

      await fs.access(bookmarksPath)
      const content = await fs.readFile(bookmarksPath, 'utf-8')
      const data = JSON.parse(content)

      const result = parseChromeBookmarks(data.roots as ChromeBookmarkRoots)
      return result
    } catch (error) {
      console.error('Error reading Edge bookmarks:', error)
      return {
        success: false,
        importedCount: 0,
        failedCount: 0,
        errors: [{ url: '', reason: String(error) }],
        links: [],
        folders: []
      }
    }
  })
}

// Chrome/Edge bookmark node types
interface ChromeBookmarkNode {
  id: string
  name: string
  type: 'folder' | 'url'
  url?: string
  date_added: string
  children?: ChromeBookmarkNode[]
}

interface ChromeBookmarkRoots {
  [key: string]: ChromeBookmarkNode
}

function parseChromeBookmarks(roots: ChromeBookmarkRoots): ImportResult {
  const links: Array<Record<string, unknown>> = []
  const folders: Array<Record<string, unknown>> = []
  const errors: Array<{ url: string; reason: string }> = []

  function traverse(node: ChromeBookmarkNode, parentFolderId: string | null = null) {
    if (!node.children) return

    node.children.forEach((child) => {
      if (child.type === 'folder') {
        const folderId = child.id
        folders.push({
          id: folderId,
          name: child.name,
          parentId: parentFolderId,
          order: folders.length,
          createdAt: convertChromeTimestamp(child.date_added),
          updatedAt: Date.now()
        })

        traverse(child, folderId)
      } else if (child.type === 'url' && child.url) {
        links.push({
          id: child.id,
          url: child.url,
          title: child.name,
          description: '',
          favicon: null,
          tags: [],
          folderId: parentFolderId,
          order: links.length,
          createdAt: convertChromeTimestamp(child.date_added),
          updatedAt: Date.now()
        })
      }
    })
  }

  Object.values(roots).forEach((root) => traverse(root))

  return {
    success: true,
    importedCount: links.length,
    failedCount: errors.length,
    errors,
    links,
    folders
  }
}

function convertChromeTimestamp(microseconds: string): number {
  const chromeEpoch = 11644473600000000
  const milliseconds = (parseInt(microseconds) - chromeEpoch) / 1000
  return milliseconds
}

// Parse Firefox JSON bookmarks structure (from bookmarkbackups)
function parseFirefoxJson(data: Record<string, unknown>): ImportResult {
  const links: Array<Record<string, unknown>> = []
  const folders: Array<Record<string, unknown>> = []
  const errors: Array<{ url: string; reason: string }> = []

  function traverse(node: Record<string, unknown>, parentFolderId: string | null = null) {
    const children = node.children as Array<Record<string, unknown>> | undefined
    if (!children) return

    children.forEach((child: Record<string, unknown>) => {
      const childType = child.type as string

      if (childType === 'text/x-moz-place-container') {
        // It's a folder
        const folderId = child.id as string
        folders.push({
          id: folderId,
          name: (child.title as string) || '未命名文件夹',
          parentId: parentFolderId,
          order: folders.length,
          createdAt: child.dateAdded ? (child.dateAdded as number) / 1000 : Date.now(),
          updatedAt: Date.now()
        })
        traverse(child, folderId)
      } else if (childType === 'text/x-moz-place') {
        // It's a bookmark
        const uri = child.uri as string
        if (!uri || (!uri.startsWith('http://') && !uri.startsWith('https://'))) {
          return
        }

        links.push({
          id: child.id as string,
          url: uri,
          title: (child.title as string) || uri,
          description: '',
          favicon: child.iconuri || null,
          tags: (child.tags as string) ? (child.tags as string).split(',').map((t: string) => t.trim()) : [],
          folderId: parentFolderId,
          order: links.length,
          createdAt: child.dateAdded ? (child.dateAdded as number) / 1000 : Date.now(),
          updatedAt: Date.now()
        })
      }
    })
  }

  // Start traversal from the root
  const roots = data.roots || data
  traverse(roots as Record<string, unknown>)

  return {
    success: true,
    importedCount: links.length,
    failedCount: errors.length,
    errors,
    links: links as ImportResult['links'],
    folders: folders as ImportResult['folders']
  }
}

// Decompress Mozilla LZ4 format (.jsonlz4 files)
function decompressMozLz4(buffer: Buffer): string {
  // MozLZ4 format: 8-byte magic "mozLz40\0" + 4-byte uncompressed size + LZ4 compressed data
  const magic = buffer.slice(0, 8).toString()
  if (magic !== 'mozLz40\u0000') {
    throw new Error('Not a valid mozLz4 file')
  }

  const uncompressedSize = buffer.readUInt32LE(8)
  const compressedData = buffer.slice(12)

  // Use simple LZ4 decompression (a minimal implementation)
  // For production, you'd use the lz4 package, but we implement a minimal version
  try {
    const decompressed = simpleLz4Decompress(compressedData, uncompressedSize)
    return decompressed
  } catch {
    // If native LZ4 fails, try requiring the lz4 npm package
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const lz4 = require('lz4') as { decodeBlock: (input: Buffer, output: Buffer) => number }
      const output = Buffer.alloc(uncompressedSize)
      const decoded = lz4.decodeBlock(compressedData, output)
      return output.slice(0, decoded).toString('utf-8')
    } catch {
      throw new Error(`LZ4 decompression failed. Try exporting bookmarks as HTML from Firefox instead.`)
    }
  }
}

// Minimal LZ4 block decompression for mozLz4 files
function simpleLz4Decompress(input: Buffer, outputSize: number): string {
  let inputPos = 0
  const output = Buffer.alloc(outputSize)
  let outputPos = 0

  while (inputPos < input.length && outputPos < outputSize) {
    // Read token byte
    const token = input[inputPos++]
    let literalLength = (token >> 4) & 0x0f

    // Handle extended literal length
    if (literalLength === 15) {
      let extra: number
      while ((extra = input[inputPos++]) === 255) {
        literalLength += 255
      }
      literalLength += extra
    }

    // Copy literals
    if (literalLength > 0) {
      input.copy(output, outputPos, inputPos, inputPos + literalLength)
      inputPos += literalLength
      outputPos += literalLength
    }

    if (inputPos >= input.length) break

    // Read match offset
    const offset = input.readUInt16LE(inputPos)
    inputPos += 2

    let matchLength = (token & 0x0f) + 4

    // Handle extended match length
    if ((token & 0x0f) === 15) {
      let extra: number
      while ((extra = input[inputPos++]) === 255) {
        matchLength += 255
      }
      matchLength += extra
    }

    // Copy from match
    for (let i = 0; i < matchLength; i++) {
      output[outputPos] = output[outputPos - offset]
      outputPos++
    }
  }

  return output.slice(0, outputSize).toString('utf-8')
}

// Parse Firefox SQLite database (fallback strategy)
async function parseFirefoxSqlite(
  dbPath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  betterSqlite3: any
): Promise<ImportResult> {
  const db = betterSqlite3(dbPath) as {
    prepare: (sql: string) => { all: () => Array<Record<string, unknown>> }
    close: () => void
  }

  const links: Array<Record<string, unknown>> = []
  const folders: Array<Record<string, unknown>> = []
  const errors: Array<{ url: string; reason: string }> = []

  // Query bookmarks from moz_bookmarks and moz_places
  const rows = db.prepare(`
    SELECT b.id, b.parent, b.title, b.type, b.position,
           p.url, p.title AS page_title
    FROM moz_bookmarks b
    LEFT JOIN moz_places p ON b.fk = p.id
    WHERE b.type IN (1, 2)
    ORDER BY b.parent, b.position
  `).all()

  const folderMap = new Map<number, string>()

  rows.forEach((row: Record<string, unknown>) => {
    const type = row.type as number
    const title = (row.title || row.page_title || '') as string
    const url = row.url as string | undefined

    if (type === 2 && url) {
      // Bookmark
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return
      }

      const parentId = row.parent as number
      const folderId = folderMap.get(parentId) || null

      links.push({
        id: String(row.id),
        url,
        title: title || url,
        description: '',
        favicon: null,
        tags: [],
        folderId,
        order: links.length,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    } else if (type === 2 && !url) {
      // Folder
      const folderId = String(row.id)
      folders.push({
        id: folderId,
        name: title || '未命名文件夹',
        parentId: null,
        order: folders.length,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      folderMap.set(row.id as number, folderId)
    }
  })

  db.close()

  return {
    success: true,
    importedCount: links.length,
    failedCount: errors.length,
    errors,
    links: links as ImportResult['links'],
    folders: folders as ImportResult['folders']
  }
}

// Parse Markdown bookmark file
ipcMain.handle('bookmarks:parse-md', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = parseMd(content)
    return result
  } catch (error) {
    console.error('Error parsing MD bookmarks:', error)
    return {
      success: false,
      importedCount: 0,
      failedCount: 0,
      errors: [{ url: '', reason: String(error) }],
      links: [],
      folders: []
    }
  }
})
