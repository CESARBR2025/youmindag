<p align="center">
  <img src="https://img.shields.io/npm/v/youmindag?color=blue&label=npm" alt="npm version" />
  <img src="https://img.shields.io/npm/l/youmindag" alt="license" />
  <img src="https://img.shields.io/github/stars/CESARBR2025/youmindag?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node version" />
</p>

# 🧠 YouMindAG

> **Tu agente entiende tu proyecto.** Una línea y tu AI coding tool tiene contexto completo de arquitectura, dependencias y reglas.

```bash
cd mi-proyecto
npx youmindag
```

---

## 📊 El problema

Cuando trabajas con AI coding tools (opencode, Claude Code, Cursor, etc.) en proyectos reales, el agente:

- ❌ **No sabe** la estructura del proyecto
- ❌ **Gasta tokens** buscando archivos que debería conocer
- ❌ **No conoce** las reglas de arquitectura
- ❌ **Ignora** dependencias entre módulos

**Resultado:** ~8,000-10,000 tokens perdidos por tarea solo en descubrimiento.

## ✅ La solución

YouMindAG inyecta un **sistema de contexto completo** en tu proyecto en 30 segundos:

| Componente | Qué resuelve |
|-----------|-------------|
| `boveda/` | Documentación estructurada (Obsidian-ready) |
| `.opencode/` | Plugin que auto-carga contexto según la tarea |
| `scripts/` | Analizador de tareas, extractor de BD |
| `AGENTS.md` | Reglas + prohibiciones + checklist |
| Graphify | Grafo de 3,000+ nodos de dependencias |

## 🚀 Instalación

```bash
# 1. Ir a tu proyecto
cd /ruta/a/mi-proyecto

# 2. Ejecutar YouMindAG
npx youmindag

# 3. Listo. Abre un chat y escribe cualquier tarea.
```

### Lo que NO modifica

- ❌ No toca tu código fuente
- ❌ No modifica archivos existentes (solo agrega nuevos)
- ❌ No instala dependencias adicionales (excepto `@sentropic/graphify`)
- ❌ No rompe el build

## 🔧 Comandos CLI

Una vez instalado, `youmindag` ofrece estos subcomandos:

| Comando | Propósito |
|---------|-----------|
| `youmindag` | Instalar o actualizar el proyecto |
| `youmindag db "SELECT ..."` | Ejecutar query SQL contra la BD (tabla ASCII) |
| `youmindag db` | Modo interactivo REPL de BD |
| `youmindag dev --status` | Ver estado del servidor de desarrollo |
| `youmindag dev --restart` | Reiniciar el servidor de desarrollo |
| `youmindag dev --logs` | Ver logs del servidor de desarrollo |
| `youmindag dev --wrap` | Envolver dev script para capturar logs automáticos |
| `youmindag dev --unwrap` | Restaurar dev script original |
| `youmindag trace --client "Comp"` | Rastrear hooks (useEffect/useState) en componente cliente |
| `youmindag trace --components "A,B"` | Inyectar lifecycle tracker en componentes React |
| `youmindag trace --server "fn1,fn2"` | Inyectar tracer en funciones server-side |
| `youmindag trace --undo` | Restaurar todos los archivos originales |
| `youmindag trace --force` | Ignorar advertencia de cambios sin commit |
| `youmindag references <simbolo>` | Buscar referencias de un símbolo en el código |
| `youmindag context --load <modulo>` | Cargar contexto de un módulo |
| `youmindag status` | Verificar estado de la bóveda |
| `youmindag help` | Mostrar esta ayuda |

## 🔄 Cómo funciona

```
Tú escribes: "agrega campo teléfono al módulo X"
  ↓
Plugin detecta "módulo X" → ejecuta load-context.mjs
  ↓
Se muestra: docs + source + graph deps + troubleshooting
  ↓
El agente ya sabe qué archivos leer
  ↓
Implementa siguiendo las reglas de arquitectura
  ↓
npx tsc --noEmit + npm run build + npx graphify update
```

## 🏛️ Estructura inyectada

```
mi-proyecto/
├── boveda/                     ← Bóveda de conocimiento (auto-poblada)
│   ├── Home.md
│   ├── 🏗 Arquitectura/
│   ├── 🧩 Features/
│   ├── 🛠 Stack/
│   ├── 📦 Datos/
│   ├── 🗺 Roadmap/
│   ├── 📡 API/
│   └── 📚 Referencias/
├── .opencode/                  ← Contexto para AI tools
│   ├── plugins/context-loader.js
│   ├── skills/context-loader.yaml
│   └── context-map.yaml
├── scripts/
│   ├── load-context.mjs
│   ├── extract-domain.mjs
│   ├── export-schema.mjs
│   ├── populate-vault.mjs        ← Repoblar bóveda manualmente
│   ├── ym-dev.mjs                ← Wrapper del dev server (logs automáticos)
│   ├── trace-utils.mjs           ← Utilidades compartidas de trace
│   ├── trace-components.mjs      ← Lifecycle tracker para componentes React
│   ├── trace-server.mjs          ← Tracer para server actions
│   ├── trace-client.mjs          ← Hook shadowing para componentes cliente
│   └── session-checkpoint.mjs    ← Recuperación de sesión
├── AGENTS.md                   ← Reglas + checklist
└── .graphify/                  ← Grafo de conocimiento
```

## 🏆 Calidad de la bóveda

La bóveda se puebla en **dos capas** que garantizan calidad 10/10:

### Capa 1 — Poblado factual durante install (10/10 siempre)

Al ejecutar `npx youmindag`, se detectan datos duros del proyecto:

| Sección | Fuente | Calidad |
|---------|--------|---------|
| `🛠 Stack/Comandos.md` | `package.json` scripts | ✅ 10/10 |
| `🛠 Stack/Librerias.md` | `package.json` dependencias | ✅ 10/10 |
| `🛠 Stack/Variables de Entorno.md` | `.env` / `.env.example` | ✅ 10/10 |
| `🏗 Arquitectura/Estructura.md` | Árbol de directorios | ✅ 10/10 |
| `📡 API/API Routes.md` | Route files + métodos HTTP | ✅ 10/10 |
| `📡 API/Server Actions.md` | Archivos con `"use server"` | ✅ 10/10 |
| `🏗 Arquitectura/Middleware y Auth.md` | middleware.ts + librerías | ✅ 10/10 |
| `🧩 Features/Index.md` | Módulos detectados | ✅ 10/10 |

### Capa 2 — Poblado por AI al primer chat (10/10 con modelos recomendados)

Cuando abres un chat, el agente lee `AGENTS.md` y completa automáticamente:

| Sección | Lo que hace el agente |
|---------|----------------------|
| `🏗 Arquitectura/Decisiones.md` | Crea ADRs basados en stack detectado |
| `🏗 Arquitectura/Middleware y Auth.md` | Analiza flujo de autenticación |
| `🧩 Features/Index.md` | Describe cada módulo |
| `🧩 Features/[nombre].md` | Crea docs individuales |
| `🛠 Stack/Convenciones.md` | Infiere patrones del código |
| `📦 Datos/Esquema BD.md` | Ejecuta `npm run db:schema` |
| `📡 API/API Routes.md` | Describe cada endpoint |
| `📡 API/Server Actions.md` | Describe cada acción |
| `🗺 Roadmap/Changelog.md` | Genera desde `git log` |
| `🗺 Roadmap/Pendientes.md` | Escanea TODO/FIXME |
| `🗺 Roadmap/Troubleshooting.md` | Documenta errores conocidos |
| `📚 Referencias/Glosario.md` | Extrae vocabulario del dominio |

### Re-poblado manual

En cualquier momento:

```bash
node scripts/populate-vault.mjs
```

## 🤖 Modelos recomendados

YouMindAG está optimizado para los siguientes modelos AI. La calidad del poblado de la Capa 2 depende del modelo usado:

| Modelo | Calidad | Notas |
|--------|---------|-------|
| **Claude Sonnet 4** | ⭐ 10/10 | Mejor seguimiento de instrucciones AGENTS.md |
| **DeepSeek V4** | ⭐ 10/10 | Razonamiento profundo para análisis de arquitectura |
| **GPT-4o / GPT-4.1** | ⭐ 9/10 | Excelente para detección de patrones |
| **Gemini 2.5 Pro** | ⭐ 9/10 | Muy bueno para extracción de vocabulario |
| Otros (Llama 4, Mistral, etc.) | ⭐ 7-8/10 | Funcional, menos preciso |

> **Nota:** La Capa 1 (poblado factual) es 10/10 con cualquier modelo o incluso sin AI.

## 🛠️ Comandos útiles post-instalación

| Comando | Propósito |
|---------|-----------|
| `npx graphify query "pregunta"` | Consultar el grafo de dependencias |
| `npx graphify update` | Reconstruir el grafo después de cambios |
| `npm run db:schema` | Actualizar esquema BD desde information_schema |
| `node scripts/populate-vault.mjs` | Repoblar la bóveda manualmente |
| `skill context-loader` | Cargar instrucciones detalladas de contexto |

## 🤖 Compatibilidad

| Herramienta | Soporte |
|-------------|---------|
| Opencode | ✅ Plugin native |
| Claude Code | ✅ Lee AGENTS.md + bóveda |
| Cursor | ✅ Vía rules |
| GitHub Copilot | ✅ Vía AGENTS.md |

## 📝 Licencia

MIT — Haz lo que quieras.

---

<p align="center">
  <strong>Una línea. Tu AI entiende tu proyecto.</strong><br>
  <code>npx youmindag</code>
</p>
