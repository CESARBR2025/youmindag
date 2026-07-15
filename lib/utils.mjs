// YouMindAG — utility functions (pure, no side effects)

export const RESET = '\x1b[0m'
export const CYAN = '\x1b[36m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const BOLD = '\x1b[1m'

export function pascalCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\s+/g, '')
}

export function kebabCase(str) {
  const result = str
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return result || 'proyecto'
}
