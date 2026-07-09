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
├── boveda/                     ← Documentación (rellenar con el tiempo)
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
│   └── export-schema.mjs
├── AGENTS.md                   ← Reglas + checklist
└── .graphify/                  ← Grafo de conocimiento
```

## 🛠️ Comandos útiles post-instalación

| Comando | Propósito |
|---------|-----------|
| `npx graphify query "pregunta"` | Consultar el grafo de dependencias |
| `npx graphify update` | Reconstruir el grafo después de cambios |
| `npm run db:schema` | Actualizar esquema BD desde information_schema |
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
