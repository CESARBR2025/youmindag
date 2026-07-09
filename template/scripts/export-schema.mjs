// scripts/export-schema.mjs
// Exporta el esquema de BD a markdown desde information_schema

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let pool
try {
  const pg = await import('pg')
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
} catch {
  console.log('[youmindag] pg not installed — skipping schema export')
  process.exit(0)
}

async function getSchemas() {
  const result = await pool.query(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT LIKE 'pg\\_%' AND schema_name != 'information_schema'
     ORDER BY schema_name`
  )
  return result.rows.map(r => r.schema_name)
}

async function getTables(schema) {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema],
  )
  return result.rows.map(r => r.table_name)
}

async function getColumns(schema, table) {
  const result = await pool.query(
    `SELECT column_name, data_type, is_nullable,
            column_default::text AS column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table],
  )
  return result.rows
}

async function getEnums(schema) {
  const result = await pool.query(
    `SELECT t.typname AS enum_name, e.enumlabel AS enum_value
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = $1
     ORDER BY t.typname, e.enumsortorder`,
    [schema],
  )
  const enums = {}
  for (const r of result.rows) {
    if (!enums[r.enum_name]) enums[r.enum_name] = []
    enums[r.enum_name].push(r.enum_value)
  }
  return enums
}

function typeToReadable(t) {
  if (t.startsWith('timestamp')) return 'timestamp'
  if (t.startsWith('character varying')) return 'text'
  if (t === 'USER-DEFINED') return 'enum'
  return t
}

async function main() {
  const schemas = await getSchemas()

  let md = `# Esquema de Base de Datos

> Documentación generada desde \`information_schema\` el ${new Date().toISOString().split('T')[0]}.
> Fuente de verdad del schema real en PostgreSQL.

---

## Convenciones

- Los nombres están en **snake_case** (convención de PostgreSQL)
- Se excluyen schemas del sistema (\`pg_*\`, \`information_schema\`)

---

`

  for (const schema of schemas) {
    md += `## Schema \\\`${schema}\\\`\n\n`

    const enums = await getEnums(schema)
    if (Object.keys(enums).length > 0) {
      md += `### Enums\n\n`
      for (const [name, values] of Object.entries(enums)) {
        md += `- \`${name}\`: ${values.map(v => `\`${v}\``).join(', ')}\n`
      }
      md += '\n'
    }

    const tables = await getTables(schema)
    for (const table of tables) {
      const cols = await getColumns(schema, table)
      md += `### \\\`${table}\\\`\n\n`
      md += `| # | Columna | Tipo | Nulable | Default |\n`
      md += `|---|---------|------|---------|--------|\n`
      cols.forEach((c, i) => {
        md += `| ${i + 1} | \`${c.column_name}\` | \`${typeToReadable(c.data_type)}\` | ${c.is_nullable === 'YES' ? 'SÍ' : 'NO'} | ${c.column_default ? `\`${c.column_default.replace(/\|/g, '\\|')}\`` : '—'} |\n`
      })
      md += '\n'
    }
  }

  writeFileSync(join(ROOT, 'boveda/📦 Datos/Esquema BD.md'), md)
  console.log('✅ Esquema actualizado en boveda/📦 Datos/Esquema BD.md')
  await pool.end()
}

main().catch(err => {
  console.error('Error exporting schema:', err)
  process.exit(1)
})
