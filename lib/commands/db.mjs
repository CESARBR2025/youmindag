// YouMindAG — CLI commands
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { createInterface } from 'readline'
import { parseEnvFile } from '../fs-helpers.mjs'
import { hasPostgres } from '../detect.mjs'


export function formatAsciiTable(rows) {
  if (!rows || rows.length === 0) return '(sin resultados)\n'
  const cols = Object.keys(rows[0])
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? 'NULL').length)))
  const pad = (s, w) => ' ' + String(s).padEnd(w) + ' '

  let result = ''
  result += '┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐\n'
  result += '│' + cols.map((c, i) => pad(c, widths[i])).join('│') + '│\n'
  result += '├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤\n'
  for (const row of rows) {
    result += '│' + cols.map((c, i) => pad(row[c] ?? 'NULL', widths[i])).join('│') + '│\n'
  }
  result += '└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘\n'
  result += `\n${rows.length} ${rows.length === 1 ? 'fila' : 'filas'}\n`
  return result
}

export function replDb(pool) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${CYAN}db> ${RESET}`,
  })

  console.log(`${CYAN}Modo interactivo. Escribe una query SQL y presiona Enter.${RESET}`)
  console.log(`${CYAN}Escribe \\q o presiona Ctrl+C para salir.${RESET}\n`)

  readline.prompt()

  readline.on('line', async (line) => {
    const trimmed = line.trim()
    if (trimmed === '\\q' || trimmed === 'exit' || trimmed === 'quit') {
      readline.close()
      return
    }
    if (!trimmed) {
      readline.prompt()
      return
    }
    try {
      const result = await pool.query(trimmed)
      if (result.rows && result.rows.length > 0) {
        process.stdout.write(formatAsciiTable(result.rows))
      } else {
        console.log(`${GREEN}✅ Query ejecutada (${result.command}${result.rowCount !== null ? ', ' + result.rowCount + ' filas' : ''})${RESET}\n`)
      }
    } catch (e) {
      console.log(`${YELLOW}Error: ${e.message}${RESET}\n`)
    }
    readline.prompt()
  })

  readline.on('close', async () => {
    console.log(`\n${CYAN}👋 Saliendo...${RESET}`)
    await pool.end()
    process.exit(0)
  })
}

export async function cmdDb(cwd, query) {
  const vars = parseEnvFile(cwd)
  const dbUrl = vars.DATABASE_URL

  if (!dbUrl) {
    console.error(`${YELLOW}Error: DATABASE_URL no encontrada en .env${RESET}`)
    console.error(`${YELLOW}   Asegúrate de tener un archivo .env con DATABASE_URL=postgres://...${RESET}`)
    process.exit(1)
  }

  if (!hasPostgres(cwd)) {
    console.error(`${YELLOW}Error: pg no encontrado en package.json${RESET}`)
    console.error(`${YELLOW}   Instálalo con: npm install pg${RESET}`)
    process.exit(1)
  }

  let pg
  try {
    pg = await import('pg')
  } catch {
    console.error(`${YELLOW}Error: No se pudo importar pg desde node_modules${RESET}`)
    console.error(`${YELLOW}   Asegúrate de que pg esté instalado: npm install pg${RESET}`)
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: dbUrl })

  if (!query) {
    return replDb(pool)
  }

  try {
    const result = await pool.query(query)
    if (result.rows && result.rows.length > 0) {
      process.stdout.write(formatAsciiTable(result.rows))
    } else {
      console.log(`${GREEN}✅ Query ejecutada (${result.command}${result.rowCount !== null ? ', ' + result.rowCount + ' filas' : ''})${RESET}`)
    }
  } catch (e) {
    console.error(`${YELLOW}Error en la query: ${e.message}${RESET}`)
    process.exit(1)
  } finally {
    await pool.end()
  }
}
