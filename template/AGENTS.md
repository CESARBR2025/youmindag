<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bóveda de Conocimiento

**Antes de cualquier cambio, leer `boveda/Home.md` para contexto completo del proyecto.**
La bóveda en `boveda/` es la única fuente de documentación. No crear documentación suelta fuera de ella.

El archivo `.opencode/context-map.yaml` mapea cada dominio del proyecto a sus archivos relevantes, documentación y query de Graphify. Usarlo para cargar contexto en una tarea nueva.

# Modelos recomendados

La calidad del poblado automático de la bóveda (ver sección siguiente) depende del modelo AI. YouMindAG está optimizado para estos modelos (ordenados por calidad de resultado):

| Modelo | Calidad esperada | Notas |
|--------|-----------------|-------|
| **Claude Sonnet 4** (Anthropic) | ⭐ 10/10 | Mejor seguimiento de instrucciones AGENTS.md |
| **DeepSeek V4** | ⭐ 10/10 | Razonamiento profundo para análisis de arquitectura |
| **GPT-4o / GPT-4.1** (OpenAI) | ⭐ 9/10 | Excelente para detección de patrones |
| **Gemini 2.5 Pro** (Google) | ⭐ 9/10 | Muy bueno para extracción de vocabulario y glosarios |
| Otros modelos (Llama 4, Mistral, etc.) | ⭐ 7-8/10 | Resultados funcionales pero menos precisos |

El poblado factual durante install (Comandos, Librerías, Env Vars, Estructura, API Routes, Server Actions, Middleware) es 10/10 independientemente del modelo porque se genera con datos duros del proyecto.

# Auto-poblado de bóveda

Si al leer `boveda/` encuentras archivos con "Pendiente de documentar" o contenido placeholder, debes analizar el proyecto y llenarlos automáticamente antes de comenzar a trabajar. El objetivo es que la bóveda refleje el estado real del proyecto.

Para cada sección pendiente:

1. **`🏗 Arquitectura/Estructura.md`** — ✅ Ya poblado durante install con el árbol de directorios.
2. **`🏗 Arquitectura/Middleware y Auth.md`** — ⚠️ Parcialmente poblado (archivo + librerías detectadas). Completar con análisis del flujo de autenticación, rutas protegidas, roles.
3. **`🏗 Arquitectura/Decisiones.md`** — Crear ADRs iniciales para decisiones obvias del stack detectado (ej: "Por qué framework X", "Por qué BD Y", etc.). Si no hay decisiones claras, dejarlo como template.
4. **`🧩 Features/Index.md`** — ✅ Ya poblado durante install con módulos detectados. Completar la descripción de cada módulo analizando su estructura y propósito.
5. **`🧩 Features/[nombre].md`** — Para cada módulo/feature detectado, crear su archivo de documentación individual usando `Feature Example.md` como template. Usar `graphify summary` para identificar módulos.
6. **`🛠 Stack/Comandos.md`** — ✅ Ya poblado desde package.json. Si faltan comandos, agregarlos.
7. **`🛠 Stack/Convenciones.md`** — Inferir patrones del código existente (naming, estructura de carpetas, imports, testing, etc.). Ejecutar `graphify query "conventions and patterns"` para apoyo.
8. **`🛠 Stack/Librerias.md`** — ✅ Ya poblado desde package.json.
9. **`🛠 Stack/Variables de Entorno.md`** — ✅ Ya poblado desde .env si existe.
10. **`📦 Datos/Esquema BD.md`** — Si hay base de datos, ejecutar `npm run db:schema`. Si no hay DB conectada, dejarlo como está.
11. **`📡 API/API Routes.md`** — ✅ Ya poblado con rutas y métodos HTTP detectados. Completar descripciones de cada endpoint.
12. **`📡 API/Server Actions.md`** — ✅ Ya poblado con archivos `"use server"` detectados. Completar descripción de cada acción.
13. **`🗺 Roadmap/Changelog.md`** — Si hay commits recientes en git, generar un changelog inicial con `git log --oneline --max-count=30`.
14. **`🗺 Roadmap/Pendientes.md`** — Revisar TODO/FIXME/HACK en el código, issues de git, y documentar.
15. **`🗺 Roadmap/Troubleshooting.md`** — Si hay errores conocidos en el código o configuraciones problemáticas, documentarlos.
16. **`📚 Referencias/Glosario.md`** — Extraer términos del dominio del código fuente. Ejecutar `graphify summary --graph .graphify/graph.json` para identificar naming consistente y extraer vocabulario del negocio.

Usar `graphify query` y `graphify summary --graph .graphify/graph.json` para entender la arquitectura antes de escribir documentación. Para cambios en la bóveda, seguir las mismas convenciones de markdown que los archivos existentes.

Después de poblar la bóveda, ejecutar el checklist post-cambio (sección siguiente).

# Architecture — Layered Domain Pattern (si aplica)

Every domain module follows a strict layered architecture in `lib/<module>/`:

```
lib/<module>/
├── types.ts      — TypeScript interfaces (camelCase properties)
├── mapper.ts     — rowTo* functions convert raw → typed objects
├── repository.ts — raw SQL queries, returns typed objects via mappers
├── service.ts    — business logic / orchestration (optional)
└── actions.ts    — server actions (mutations only)
```

Adaptar esta estructura al lenguaje/framework del proyecto.

# Error handling — centralized (si aplica)

Todas las server actions / handlers deben usar un sistema de errores centralizado:

```ts
import { AppError, NotFoundError, ValidationError } from '@/lib/error-handler'

export async function obtenerAlgo(id: string) {
  // ...
  if (!data) throw new NotFoundError('No encontrado')
  return data
}
```

# Page / Route file rules (adaptar al framework)
- **Nunca** importar la BD directamente en páginas/rutas
- **Nunca** usar el ORM directamente en código de aplicación
- **Siempre** pasar por una capa de repository/service
- **Siempre** usar el helper de autenticación centralizado para role checks

# Checklist post-cambio

Al completar cualquier cambio (nueva feature, bugfix, refactor):

1. **TypeCheck**: `npx tsc --noEmit` (o equivalente del lenguaje)
2. **Build**: `npm run build` (o equivalente)
3. **Si el módulo es nuevo**: crear `boveda/🧩 Features/[nombre].md` + actualizar `Index.md`
4. **Actualizar bóveda**:
   - Feature nueva → `boveda/🧩 Features/[nombre].md`
   - Bug fix → agregar entrada en `boveda/🗺 Roadmap/Troubleshooting.md`
   - Cambio en BD → actualizar `boveda/📦 Datos/Esquema BD.md`
   - Decisión técnica → ADR en `boveda/🏗 Arquitectura/Decisiones.md`
5. **Verificar nomenclatura**: consistencia con el resto del proyecto
6. **Graphify**: `npx graphify update` para mantener el grafo sincronizado
7. **Si hay cambios en BD**: `npm run db:schema` para refrescar esquema

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run the graphify skill with --update when appropriate
- If the user asks to build, update, query, path, or explain the graph, use the installed `graphify` skill instead of ad-hoc file traversal
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
