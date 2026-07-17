// YouMindAG — versión del paquete (no confundir con la versión instalada en un proyecto)
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const PKG_VERSION = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
).version
