// context-loader OpenCode plugin — v1.6.0 Context Armor
// Features:
//   A) Auto checkpoint: registra tareas, build, typecheck, file_reads
//   B) Graphify-first: ejecuta graphify query automáticamente
//   C) Rules re-injection: recordatorio cada 12 tool calls
//  F1) Verification reminder: sugiere build/typecheck cuando detecta edits sin verificación
//  F2) Compaction recovery: re-inyecta reglas de oro si se pierde contexto
//  F3) Token budget: monitorea uso estimado de tokens, advierte a >70%
//  F4) Subagent suggestion: sugiere graphify/subagentes para investigación
//  F5) Decision detection: detecta decisiones en output y sugiere loguearlas
//  F6) Scope creep: advierte cuando tarea corta toca muchos archivos
//  F7) Graphify stale guard: advierte cuando grafo no se ha actualizado tras 10+ edits
//  D1) Pre-load enhanced: carga decisions pendientes + session summary al iniciar
//
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const GRAPH_PATH = join(ROOT, ".graphify", "graph.json");
const CHECKPOINT_SCRIPT = join(ROOT, "scripts", "session-checkpoint.mjs");
const REINJECT_INTERVAL = 12;
const BUDGET_CHECK_INTERVAL = 10;
const VERIFY_WARN_AFTER = 5;
const GRAPHIFY_STALE_AFTER = 10;
const SCOPE_CREEP_THRESHOLD = 5;
const GRAPHIFY_DEBOUNCE_MS = 30000;
const GRAPHIFY_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60000;

const graphifyCache = new Map()

function cacheKey(task) {
  let hash = 0
  for (let i = 0; i < task.length; i++) {
    hash = ((hash << 5) - hash) + task.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function cacheGet(task) {
  const key = cacheKey(task)
  const entry = graphifyCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    graphifyCache.delete(key)
    return null
  }
  return entry.result
}

function cacheSet(task, result) {
  const key = cacheKey(task)
  graphifyCache.set(key, { result, ts: Date.now() })
}

function cacheClear() {
  graphifyCache.clear()
}

const STATE_FILE = join(ROOT, '.youmindag', 'plugin-state.json')
const STATE_SAVE_INTERVAL = 5

function loadPluginState() {
  if (!existsSync(STATE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function savePluginState(state) {
  try {
    mkdirSync(join(ROOT, '.youmindag'), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch {}
}

const GOLDEN_RULES = JSON.stringify(
  "[YouMindAG §1-4] Leer AGENTS.md + Home + session.jsonl | Graphify > grep | BD real > bóveda | Verificar cambios"
);

const VERIFY_MSG = JSON.stringify(
  "[YouMindAG] ✅ Cambios acumulados sin verificar. Ejecuta comandos de boveda/🛠 Stack/Comandos.md (build/lint/typecheck)"
);

const SUBAGENT_MSG = JSON.stringify(
  "[YouMindAG] 💡 Tarea de investigación detectada. Usa graphify query o subagente para no llenar tu contexto."
);

const BUDGET_WARN_MSG = (pct) =>
  JSON.stringify(`[YouMindAG] ⚠️ Token budget: ~${pct}% usado. Sugerencia: /compact o subagentes.`);

const SCOPE_CREEP_MSG = (task, count) =>
  JSON.stringify(`[YouMindAG] ⚠️ Scope creep detectado. Tarea original "${task.slice(0, 50)}${task.length > 50 ? "..." : ""}" → ${count} archivos modificados. ¿Documentar en boveda/🗺 Roadmap/?`);

const DECISION_MSG = JSON.stringify(
  "[YouMindAG] 💡 Decisión detectada en tu respuesta. ¿Registrarla? node scripts/session-checkpoint.mjs --decision \"...\""
);

const GRAPHIFY_STALE_MSG = JSON.stringify(
  "[YouMindAG] 🌐 Graphify desactualizado (10+ edits sin update). Ejecuta: npx graphify update"
);

const RESEARCH_PATTERNS = /\b(investigate|research|explore the codebase|find all|search entire|scan all|audit the codebase|review entire)\b/i;

const EDIT_COMMANDS = /(edit|write|patch|replace)\b/i;
const VERIFY_COMMANDS = /\b(tsc|typecheck|npm run build|next build|lint|eslint|npx graphify)\b/i;

const DECISION_PATTERNS = /\b(decid[ií]|opt[aá]mos por|en vez de|la raz[oó]n es|porque|la causa es|el motivo|prefer[ií]|eleg[ií])\b/i;

function graphifyQuery(task, directory) {
  if (!existsSync(GRAPH_PATH)) return null;
  const cached = cacheGet(task)
  if (cached) return cached
  try {
    const escaped = task.replace(/"/g, '\\"').slice(0, 200);
    const result = execSync(`npx graphify query "${escaped}" 2>/dev/null`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: GRAPHIFY_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const trimmed = result.trim();
    if (!trimmed) return null;
    const lines = trimmed.split("\n");
    const output = lines.length > 12 ? lines.slice(0, 12).join("\n") + "\n  ... (truncated)" : trimmed;
    cacheSet(task, output)
    return output;
  } catch {
    return null;
  }
}

function graphifySummary(directory) {
  if (!existsSync(GRAPH_PATH)) return null;
  const SUMMARY_KEY = "summary:__graphify_summary__"
  const cached = cacheGet(SUMMARY_KEY)
  if (cached) return cached
  try {
    const result = execSync(`npx graphify summary --graph "${GRAPH_PATH}" 2>/dev/null`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: GRAPHIFY_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const trimmed = result.trim();
    if (!trimmed) return null;
    const lines = trimmed.split("\n");
    const output = lines.length > 15 ? lines.slice(0, 15).join("\n") + "\n  ... (truncated)" : trimmed;
    cacheSet(SUMMARY_KEY, output)
    return output;
  } catch {
    return null;
  }
}

function isGenericTask(text) {
  if (!text) return false;
  // Short tasks or tasks with only generic action words → use summary
  if (text.length < 30) return true;
  const genericPatterns = /\b(implement|create|add|build|make|fix|update)\b/i;
  const specificPatterns = /\b(auth|api|database|schema|endpoint|route|migration|component|modal|page)\b/i;
  return genericPatterns.test(text) && !specificPatterns.test(text);
}

function checkpoint(key, text, directory) {
  if (!existsSync(CHECKPOINT_SCRIPT)) return;
  try {
    const escaped = (text || "").replace(/"/g, '\\"').slice(0, 500);
    execSync(`node "${CHECKPOINT_SCRIPT}" --append "${key}" "${escaped}"`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: 5000,
      stdio: "ignore",
    });
  } catch { /* silent */ }
}

function sessionSummary(directory) {
  if (!existsSync(CHECKPOINT_SCRIPT)) return null;
  try {
    const result = execSync(`node "${CHECKPOINT_SCRIPT}" --summary`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

function pendingDecisions(directory) {
  if (!existsSync(CHECKPOINT_SCRIPT)) return null;
  try {
    const result = execSync(`node "${CHECKPOINT_SCRIPT}" --pending-decisions`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const trimmed = result.trim();
    if (!trimmed || trimmed.includes("(sin decisiones")) return null;
    return trimmed;
  } catch {
    return null;
  }
}

function checkBudget(directory) {
  if (!existsSync(CHECKPOINT_SCRIPT)) return null;
  try {
    const result = execSync(`node "${CHECKPOINT_SCRIPT}" --budget 200000`, {
      cwd: directory || ROOT,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

function getFilesTouched(directory) {
  if (!existsSync(CHECKPOINT_SCRIPT)) return 0;
  try {
    const jsonlPath = join(directory || ROOT, ".youmindag", "session.jsonl");
    if (!existsSync(jsonlPath)) return 0;
    const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
    const files = new Set();
    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        if (evt.key === "file_read" && evt.text) {
          files.add(evt.text);
        }
      } catch {}
    }
    return files.size;
  } catch {
    return 0;
  }
}

function shouldShowGraphifyResult(text) {
  if (!text) return false;
  const noisePatterns = /^(git |npm |ls |cd |echo |node |npx |cat |mkdir |rm |cp |mv |chmod )/;
  return text.length > 15 && !noisePatterns.test(text.trim());
}

export const ContextLoaderPlugin = async ({ directory }) => {
  const saved = loadPluginState();
  let toolCallCount = saved.toolCallCount || 0;
  let lastTask = saved.lastTask || "";
  let lastGraphifyAt = 0;
  let pendingContext = "";
  let pendingSession = "";
  let pendingWarnings = "";
  let lastCheckpointKey = saved.lastCheckpointKey || "";
  let editsSinceLastCheck = saved.editsSinceLastCheck || 0;
  let editsSinceGraphifyUpdate = saved.editsSinceGraphifyUpdate || 0;
  let wasCompacted = false;
  let preLoaded = false;

  return {
    "plugin.tool-execute.before": async (input, output) => {
      const task = input?.text || "";
      const cmd = (input?.args?.command || "").toLowerCase();
      const isNewTask = task && task !== lastTask && task.length > 15;
      const now = Date.now();
      toolCallCount++;

      if (toolCallCount % STATE_SAVE_INTERVAL === 0) {
        savePluginState({ toolCallCount, lastTask, lastCheckpointKey, editsSinceLastCheck, editsSinceGraphifyUpdate });
      }

      // D1: Pre-load session summary + pending decisions on first call
      if (!preLoaded) {
        preLoaded = true;

        // Auto-init session file if it doesn't exist
        const sessionDir = join(directory || ROOT, ".youmindag");
        const sessionJson = join(sessionDir, "session.jsonl");
        mkdirSync(sessionDir, { recursive: true });
        if (!existsSync(sessionJson)) {
          writeFileSync(sessionJson, "");
        }
        let preload = "";

        const summary = sessionSummary(directory);
        if (summary) {
          preload += `echo "[session] Sesión anterior:" && echo ${JSON.stringify(summary)}`;
        }

        const pd = pendingDecisions(directory);
        if (pd) {
          preload += (preload ? " && " : "") + `echo "[decisions] Decisiones pendientes:" && echo ${JSON.stringify("\\n" + pd)}`;
        }

        if (preload) {
          output.args.command = preload + " && " + (output.args.command || "true");
        }
      }

      // F2: Compaction recovery — detect context reset
      if (toolCallCount === 1 && lastTask) {
        wasCompacted = true;
      }

      if (wasCompacted) {
        wasCompacted = false;
        output.args.command = `echo ${GOLDEN_RULES} && ` + (output.args.command || "");
      }

      // C: Regular rules re-injection
      const reinjectMsg = toolCallCount > 2 && toolCallCount % REINJECT_INTERVAL === 0;
      if (reinjectMsg) {
        output.args.command = `echo ${GOLDEN_RULES} && ` + (output.args.command || "");
      }

      // F3: Token budget check
      if (toolCallCount % BUDGET_CHECK_INTERVAL === 0) {
        const budget = checkBudget(directory);
        if (budget) {
          const pctMatch = budget.match(/(\d+)%/);
          if (pctMatch) {
            const pct = parseInt(pctMatch[1], 10);
            if (pct > 70) {
              pendingWarnings = BUDGET_WARN_MSG(pct);
            }
          }
        }
      }

      if (isNewTask) {
        lastTask = task;
        savePluginState({ toolCallCount, lastTask, lastCheckpointKey, editsSinceLastCheck, editsSinceGraphifyUpdate });
        pendingContext = "";
        pendingSession = "";
        pendingWarnings = "";
        lastCheckpointKey = "";

        // A: Checkpoint the new task
        checkpoint("task", task, directory);

        // A: Fetch session summary
        const summary = sessionSummary(directory);
        if (summary) {
          pendingSession = summary;
        }

        // B: Graphify-first (debounced) — use summary for generic tasks
        if (shouldShowGraphifyResult(task) && (now - lastGraphifyAt) > GRAPHIFY_DEBOUNCE_MS) {
          lastGraphifyAt = now;
          if (isGenericTask(task)) {
            const gfSummary = graphifySummary(directory);
            if (gfSummary) {
              pendingContext = `\n[graphify summary] Orientación del proyecto:\n${gfSummary}`;
            }
          } else {
            const gfResult = graphifyQuery(task, directory);
            if (gfResult) {
              pendingContext = `\n[graphify] Resultados para: "${task.slice(0, 60)}${task.length > 60 ? "..." : ""}"\n${gfResult}`;
            }
          }
        }

        // F4: Subagent suggestion for research-heavy tasks
        if (RESEARCH_PATTERNS.test(task)) {
          pendingWarnings = pendingWarnings
            ? pendingWarnings + "\n" + SUBAGENT_MSG
            : SUBAGENT_MSG;
        }

        // F6: Scope creep detection — check from previous task
        if (lastTask && lastTask.length < 80) {
          const filesTouched = getFilesTouched(directory);
          if (filesTouched > SCOPE_CREEP_THRESHOLD) {
            const scopeWarn = SCOPE_CREEP_MSG(lastTask, filesTouched);
            pendingWarnings = pendingWarnings
              ? pendingWarnings + "\n" + scopeWarn
              : scopeWarn;
          }
        }

        // F7: Graphify stale check on each new task
        if (editsSinceGraphifyUpdate > GRAPHIFY_STALE_AFTER) {
          const staleWarn = GRAPHIFY_STALE_MSG;
          pendingWarnings = pendingWarnings
            ? pendingWarnings + "\n" + staleWarn
            : staleWarn;
          editsSinceGraphifyUpdate = 0; // reset to avoid spamming per task
        }
      }

      // F1: Track edits vs verifications
      if (VERIFY_COMMANDS.test(cmd)) {
        editsSinceLastCheck = 0;
      }

      // F1: Count tool use as potential edit
      if (cmd && cmd.length > 5 && !cmd.startsWith("echo ")) {
        editsSinceLastCheck++;
        if (EDIT_COMMANDS.test(cmd)) {
          editsSinceGraphifyUpdate++;
          checkpoint("file_read", cmd.slice(0, 200), directory);
        }
      }

      // F1: Verification warning
      if (editsSinceLastCheck >= VERIFY_WARN_AFTER) {
        output.args.command = `echo ${VERIFY_MSG} && ` + (output.args.command || "");
        editsSinceLastCheck = 0;
      }

      // Prepend pending messages
      if (pendingSession || pendingContext || pendingWarnings) {
        let prefix = "";
        if (pendingSession) {
          prefix += `echo "[session] Sesión anterior:" && echo ${JSON.stringify(pendingSession)}`;
          pendingSession = "";
        }
        if (pendingContext) {
          prefix += (prefix ? " && " : "") + `echo ${JSON.stringify(pendingContext)}`;
          pendingContext = "";
        }
        if (pendingWarnings) {
          prefix += (prefix ? " && " : "") + `echo ${JSON.stringify(pendingWarnings)}`;
          pendingWarnings = "";
        }
        if (prefix) {
          output.args.command = prefix + " && " + (output.args.command || "true");
        }
      }
    },

    "plugin.tool-execute.after": async (input, output) => {
      const cmd = (input?.args?.command || "").toLowerCase();
      const exitOk = output?.result?.exitCode === 0;

      // A: Auto checkpoint for build/typecheck/graphify
      if (exitOk) {
        if (cmd.includes("npm run build") || cmd.includes("next build")) {
          if (lastCheckpointKey !== "build") {
            lastCheckpointKey = "build";
            checkpoint("build", "OK", directory);
            editsSinceLastCheck = 0;
            editsSinceGraphifyUpdate = 0;
          }
        }
        if (cmd.includes("npx tsc") || cmd.includes("tsc ")) {
          if (lastCheckpointKey !== "typecheck") {
            lastCheckpointKey = "typecheck";
            checkpoint("typecheck", "OK", directory);
            editsSinceLastCheck = 0;
            editsSinceGraphifyUpdate = 0;
          }
        }
        if (cmd.includes("npx graphify") && (cmd.includes("update") || cmd.includes("hook-rebuild"))) {
          checkpoint("build", "graphify updated", directory);
          editsSinceLastCheck = 0;
          editsSinceGraphifyUpdate = 0;
          cacheClear();
        }
      }

      // F5: Decision detection in AI output
      const responseText = output?.result?.output || "";
      if (responseText && DECISION_PATTERNS.test(responseText) && exitOk) {
        // Register as pending — will be shown on next task
        checkpoint("decision", "Decision detected in output (auto-flagged)", directory);
      }
    },
  };
};
