// YouMindAG — project detection functions

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export function detectLang(cwd) {
  const indicators = [
    { file: 'package.json', lang: 'TypeScript / JavaScript', framework: 'Node.js' },
    { file: 'tsconfig.json', lang: 'TypeScript', framework: 'Node.js / Next.js' },
    { file: 'go.mod', lang: 'Go', framework: 'Go' },
    { file: 'Cargo.toml', lang: 'Rust', framework: 'Rust' },
    { file: 'pyproject.toml', lang: 'Python', framework: 'Python' },
    { file: 'requirements.txt', lang: 'Python', framework: 'Python' },
    { file: 'Gemfile', lang: 'Ruby', framework: 'Ruby' },
    { file: 'composer.json', lang: 'PHP', framework: 'PHP' },
    { file: '.csproj', lang: 'C#', framework: '.NET' },
  ]
  for (const ind of indicators) {
    if (existsSync(join(cwd, ind.file))) return ind
    if (ind.file === '.csproj') {
      try {
        const files = readdirSync(cwd).filter(f => f.endsWith('.csproj'))
        if (files.length > 0) return ind
      } catch {}
    }
  }
  return { lang: 'Unknown', framework: 'Unknown' }
}

export function hasPostgres(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return !!(pkg.dependencies?.pg || pkg.devDependencies?.pg || pkg.dependencies?.['@neondatabase/serverless'])
  } catch { return false }
}

export function detectDBEngine(cwd) {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps['@supabase/supabase-js']) return 'supabase'
    if (deps.pg || deps['@neondatabase/serverless']) return 'postgres'
    if (deps.mysql2 || deps.mysql) return 'mysql'
    if (deps['better-sqlite3'] || deps.sqlite3) return 'sqlite'
    if (deps.mongodb || deps.mongoose) return 'mongodb'
    if (deps['@prisma/client']) return 'prisma'
    if (deps['drizzle-orm']) return 'drizzle'
  } catch {}
  return null
}

export function getDBMigrationCommands(engine) {
  const commands = {
    supabase: { cmd: 'npx supabase db push', desc: 'Sincroniza schema local → remoto' },
    postgres: { cmd: 'psql $DATABASE_URL -f migrations/...', desc: 'Ejecuta archivo SQL contra PostgreSQL' },
    mysql: { cmd: 'mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < migrations/...', desc: 'Ejecuta archivo SQL contra MySQL' },
    sqlite: { cmd: 'sqlite3 $DB_PATH < migrations/...', desc: 'Ejecuta archivo SQL contra SQLite' },
    mongodb: { cmd: 'mongosh $MONGO_URI --eval "load(...)"', desc: 'Ejecuta script contra MongoDB' },
    prisma: { cmd: 'npx prisma migrate dev', desc: 'Aplica migraciones de Prisma' },
    drizzle: { cmd: 'npx drizzle-kit push', desc: 'Sincroniza schema de Drizzle' },
  }
  const extra = {
    supabase: '| `npx supabase db diff` | Genera migración SQL del estado actual |',
    prisma: '| `npx prisma db push` | Sincroniza schema sin generar migración |',
    drizzle: '| `npx drizzle-kit generate` | Genera archivos de migración SQL |',
  }
  const main = commands[engine]
  if (!main) return ''
  let section = '\n## Migraciones DB\n\n'
  section += `Motor detectado: **${engine}**\n\n`
  section += `| Comando | Propósito |\n|---------|----------|\n`
  section += `| \`${main.cmd}\` | ${main.desc} |\n`
  if (extra[engine]) section += `${extra[engine]}\n`
  section += '\nPara DDL manual: usar SQL Editor en el dashboard de tu proveedor de BD.\n'
  return section
}
