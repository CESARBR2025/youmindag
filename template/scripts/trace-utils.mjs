// scripts/trace-utils.mjs
// Utilidades compartidas por trace-components.mjs y trace-server.mjs

import { existsSync, copyFileSync, unlinkSync, readdirSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { execSync } from 'child_process'

export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const RED = '\x1b[31m'
export const CYAN = '\x1b[36m'
export const RESET = '\x1b[0m'

export function searchRecursive(dir, name, extensions) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        const result = searchRecursive(full, name, extensions)
        if (result) return result
      } else if (e.isFile()) {
        const base = e.name.replace(/\.[^.]+$/, '')
        if (base === name && extensions.includes(extname(e.name))) {
          return full
        }
      }
    }
  } catch {}
  return null
}

export function findSourceFile(name, root, searchDirs, extensions) {
  for (const dir of searchDirs) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    const found = searchRecursive(base, name, extensions)
    if (found) return found
  }
  return null
}

export function checkDirtyFiles(filePaths, root) {
  if (!existsSync(join(root, '.git'))) return []

  const dirty = []
  try {
    const porcelain = String(execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' })).trim()
    if (!porcelain) return []

    const dirtyPaths = porcelain.split('\n').map(line => {
      const parts = line.trim().split(/\s+/)
      return join(root, parts[parts.length - 1])
    })

    for (const fp of filePaths) {
      if (dirtyPaths.some(d => d === fp || fp.startsWith(d) || d.startsWith(fp))) {
        const rel = fp.replace(root + '/', '')
        const statusLine = porcelain.split('\n').find(l =>
          l.includes(rel.replace(/^.*?\//, '')) || l.includes(rel)
        )
        dirty.push({ path: fp, rel, status: statusLine ? statusLine.trim().slice(0, 2) : '?' })
      }
    }
  } catch { return [] }
  return dirty
}

export function restoreBackups(root, bakExt, searchDirs) {
  let restored = 0
  for (const dir of searchDirs) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    restoreRecursive(base)
  }

  function restoreRecursive(d) {
    try {
      const entries = readdirSync(d, { withFileTypes: true })
      for (const e of entries) {
        const full = join(d, e.name)
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          restoreRecursive(full)
        } else if (e.name.endsWith(bakExt)) {
          const original = full.replace(bakExt, '')
          copyFileSync(full, original)
          unlinkSync(full)
          restored++
          console.log(`  ${GREEN}✅ ${original.replace(root + '/', '')}${RESET}`)
        }
      }
    } catch {}
  }
  return restored
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function walkRecursive(dir, extensions, maxDepth = 20) {
  const files = []
  function walk(d, depth) {
    if (depth > maxDepth) return
    try {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.next') continue
        const full = join(d, e.name)
        if (e.isDirectory()) {
          walk(full, depth + 1)
        } else if (extensions.has(extname(e.name))) {
          files.push(full)
        }
      }
    } catch {}
  }
  walk(dir, 0)
  return files
}

export function findFunctionInContent(name, root, searchDirs, extensions) {
  const pat = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escapeRegex(name)}\\s*\\(|const\\s+${escapeRegex(name)}\\s*[=:]`)
  for (const dir of searchDirs) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const file of walkRecursive(base, extensions)) {
      try {
        if (pat.test(readFileSync(file, 'utf-8'))) return file
      } catch {}
    }
  }
  return null
}
