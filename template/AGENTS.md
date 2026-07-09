<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bóveda de Conocimiento

**Antes de cualquier cambio, leer `boveda/Home.md` para contexto completo del proyecto.**
La bóveda en `boveda/` es la única fuente de documentación. No crear documentación suelta fuera de ella.

El archivo `.opencode/context-map.yaml` mapea cada dominio del proyecto a sus archivos relevantes, documentación y query de Graphify. Usarlo para cargar contexto en una tarea nueva.

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
