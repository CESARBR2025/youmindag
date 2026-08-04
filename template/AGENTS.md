<!-- BEGIN:youmindag -->
# ⚡ Reglas de oro — proporcionales al tamaño de la tarea

Antes de actuar, clasifica la instrucción. Si dudas entre dos tiers, usa el más alto — el objetivo es no repetir trabajo que un hook ya hizo, no bajar la guardia.

**T0 — Pregunta / diagnóstico sin edición de código** ("¿por qué...", "explica", "dónde está X", "revisa Y y dime qué ves")
- No es obligatorio releer AGENTS.md + Home.md + `.youmindag/session.jsonl` completos. El hook de inicio de sesión ya inyecta módulos documentados, features posiblemente desactualizados, edad del grafo y últimas decisiones — es tu punto de partida.
- Si necesitas más contexto de un tema puntual, abre solo la doc de bóveda relevante, no todo `Home.md`.

**T1 — Micro-cambio** (1-2 archivos, sin archivos nuevos, sin cambio de contrato público/esquema — typo, ajuste de string, log, fix de una línea)
- Verificación puntual: typecheck del módulo tocado. Build completo solo si el cambio toca algo compartido/exportado.
- NO ejecutes `npx graphify update` a mano — el hook post-edición ya sincroniza grafo + bóveda estructural cada 10 ediciones en background. Solo corre el comando si necesitas el grafo al día *ahora mismo* (vas a hacer una query justo después).
- NO toques la bóveda salvo que el hook te avise que el archivo está documentado, o el fix amerite una línea en `Troubleshooting.md`.

**T2 — Feature / refactor real / cambio de esquema** (3+ archivos, módulo nuevo, contrato público nuevo, migración de BD, o el usuario pide explícitamente "feature"/"refactor"/"migra")
- Lee `Home.md` + el `Feature.md` relevante antes de empezar.
- Corre el Checklist post-cambio completo (sección más abajo).

Si un T1 crece a 3+ archivos o toca algo compartido a mitad de tarea, trátalo como T2 desde ese punto — nunca al revés.

1. 🔎 **Graphify primero, grep después.** Si `.graphify/graph.json` existe:
   - Para orientación rápida: `graphify summary --graph .graphify/graph.json`
   - Para buscar archivos: `graphify query "..."`
   - Para flujos entre módulos: `graphify path "A" "B"`
   - Si graphify no está disponible → `Estructura.md` en la bóveda como fallback
2. 🗄 **BD real sobre documentación.** Si el proyecto tiene BD:
   - Consultar la BD real (credenciales en `Variables de Entorno.md` de la bóveda)
   - No adivinar esquemas ni confiar solo en la bóveda
3. 📁 **Ubicación de la bóveda.** Nombres como `boveda-seguridad-publica` o `boveda`. Todas las referencias a `boveda/` en este documento significan "buscar el directorio real de la bóveda en la raíz del proyecto".

---

# 🔧 Verificación y subagentes

- Verificación proporcional al tier (ver arriba): T0 ninguna, T1 typecheck puntual, T2 build+lint+typecheck completos. No esperar a que el usuario lo pida.
- Para investigación del código base, usar `graphify query` o subagentes. **No leer archivos masivamente.**
- Si el contexto se compacta, ejecutar `node scripts/session-checkpoint.mjs --summary` para recuperar el hilo.
- Monitorear presupuesto de tokens: `node scripts/session-checkpoint.mjs --budget`.
- Si el scope de la tarea crece más de lo previsto, **pausar y consultar al usuario** antes de seguir — esto también es la señal de subir de T1 a T2.
- El grafo se sincroniza solo cada 10 ediciones vía hook — no lo dupliques a mano; usa `npx graphify update` solo si necesitas el grafo al día de inmediato.
- Registrar decisiones técnicas importantes: `node scripts/session-checkpoint.mjs --decision "..."`

---

## Cambio automático a build mode

Si el usuario usa frases imperativas de acción, **cambia automáticamente a build mode y comienza a implementar sin pedir confirmación**:

Frases que activan build mode:
- "implementa", "implementalo", "implementar", "codifícalo"
- "hazlo", "haz los cambios", "haz el cambio", "ejecuta los cambios"
- "dale", "aplica", "aplica los cambios", "aplica el plan"
- "ejecuta", "construye", "genera el código", "escribe el código"

Si la instrucción es clara y contiene una de estas frases, **no preguntes** "¿quieres que lo implemente?" o "¿procedo?". Simplemente haz el cambio.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bóveda de Conocimiento

**Antes de un cambio T2 (feature/refactor real), leer `Home.md` en la bóveda para contexto completo del proyecto.** Para T0/T1, el resumen del hook de inicio de sesión es suficiente.
La bóveda (directorio `boveda-*` o `boveda`) es la única fuente de documentación. No crear documentación suelta fuera de ella.

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

**T1 — micro-fix (1-2 archivos, sin contrato/esquema nuevo):**
1. Typecheck del módulo tocado (o build si el cambio es compartido/exportado).
2. Nada más es obligatorio — el hook post-edición ya cubre el nudge de doc y el sync de grafo/bóveda.

**T2 — feature nueva / refactor real / cambio de esquema:**
1. **TypeCheck**: `npx tsc --noEmit` (o equivalente del lenguaje)
2. **Build**: `npm run build` (o equivalente)
3. **Bóveda**:
   - Feature nueva → crear `boveda/🧩 Features/[nombre].md` + actualizar `Index.md`
   - Bug fix no trivial → agregar entrada en `boveda/🗺 Roadmap/Troubleshooting.md`
   - Cambio en BD → actualizar `boveda/📦 Datos/Esquema BD.md` + `npm run db:schema`
   - Decisión técnica → ADR en `boveda/🏗 Arquitectura/Decisiones.md`
4. **Verificar nomenclatura**: consistencia con el resto del proyecto
5. **Graphify**: `npx graphify update` — fuerza el grafo al día ahora (el hook lo haría en background de todas formas, pero conviene tenerlo inmediato al cerrar una feature)

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run the graphify skill with --update when appropriate
- If the user asks to build, update, query, path, or explain the graph, use the installed `graphify` skill instead of ad-hoc file traversal
- Before proposing or committing .graphify changes, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths. `.graphify/` is fully gitignored by YouMindAG — each developer generates their own local graph. Run `youmindag sync` after `git pull` to rebuild your graph with merged changes.
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
- Shortcuts: `graphify q "<query>"` = `npx graphify query "<query>"`, `graphify s` = `npx graphify summary --graph .graphify/graph.json`
- When spawning a subagent for codebase exploration: graphify context is injected automatically. The subagent MUST use graphify query instead of grep/glob. grep/glob are blocked for explore and general subagents.
- Subagents: grep and glob are denied by permission. Use graphify query for all codebase exploration. If graphify context was provided in your task prompt, use it — do NOT re-search with grep.
<!-- END:youmindag -->
