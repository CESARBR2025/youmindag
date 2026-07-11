// context-loader OpenCode plugin — v1.5.0 Self-Aware
// Features:
//   A) Auto checkpoint: registra tareas, build, typecheck, file_reads
//   B) Graphify-first: ejecuta graphify query automáticamente
//   C) Rules re-injection: recordatorio cada 12 tool calls
//   F1) Verification reminder: sugiere build/typecheck cuando detecta edits sin verificación
//   F2) Compaction recovery: re-inyecta reglas de oro si se pierde contexto
//   F3) Token budget: monitorea uso estimado de tokens, advierte a >70%
//   F4) Subagent suggestion: sugiere graphify/subagentes para investigación
//
import { existsSync } from "fs";
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
const GRAPHIFY_DEBOUNCE_MS = 30000;
const GRAPHIFY_TIMEOUT_MS = 10000;

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

const RESEARCH_PATTERNS = /\b(investigate|research|explore the codebase|find all|search entire|scan all|audit the codebase|review entire)\b/i;

const EDIT_COMMANDS = /(edit|write|patch|replace)\b/i;
const VERIFY_COMMANDS = /\b(tsc|typecheck|npm run build|next build|lint|eslint|npx graphify)\b/i;

function graphifyQuery(task, directory) {
  if (!existsSync(GRAPH_PATH)) return null;
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
    return lines.length > 12 ? lines.slice(0, 12).join("\n") + "\n  ... (truncated)" : trimmed;
  } catch {
    return null;
  }
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

function shouldShowGraphifyResult(text) {
  if (!text) return false;
  const noisePatterns = /^(git |npm |ls |cd |echo |node |npx |cat |mkdir |rm |cp |mv |chmod )/;
  return text.length > 15 && !noisePatterns.test(text.trim());
}

export const ContextLoaderPlugin = async ({ directory }) => {
  let toolCallCount = 0;
  let lastTask = "";
  let lastGraphifyAt = 0;
  let pendingContext = "";
  let pendingSession = "";
  let pendingWarnings = "";
  let lastCheckpointKey = "";
  let editsSinceLastCheck = 0;
  let wasCompacted = false;

  return {
    "plugin.tool-execute.before": async (input, output) => {
      const task = input?.text || "";
      const cmd = (input?.args?.command || "").toLowerCase();
      const isNewTask = task && task !== lastTask && task.length > 15;
      const now = Date.now();
      toolCallCount++;

      // F2: Compaction recovery — detect context reset (tool call count reset to 1)
      if (toolCallCount === 1 && lastTask) {
        wasCompacted = true;
      }

      // F2: If compacted, re-inject golden rules
      if (wasCompacted) {
        wasCompacted = false;
        output.args.command = `echo ${GOLDEN_RULES} && ` + (output.args.command || "");
      }

      // C: Regular rules re-injection every ~12 tool calls
      const reinjectMsg = toolCallCount > 2 && toolCallCount % REINJECT_INTERVAL === 0;
      if (reinjectMsg) {
        output.args.command = `echo ${GOLDEN_RULES} && ` + (output.args.command || "");
      }

      // F3: Token budget check every BUDGET_CHECK_INTERVAL
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

        // B: Graphify-first (debounced)
        if (shouldShowGraphifyResult(task) && (now - lastGraphifyAt) > GRAPHIFY_DEBOUNCE_MS) {
          lastGraphifyAt = now;
          const gfResult = graphifyQuery(task, directory);
          if (gfResult) {
            pendingContext = `\n[graphify] Resultados para: "${task.slice(0, 60)}${task.length > 60 ? "..." : ""}"\n${gfResult}`;
          }
        }

        // F4: Subagent suggestion for research-heavy tasks
        if (RESEARCH_PATTERNS.test(task)) {
          pendingWarnings = pendingWarnings
            ? pendingWarnings + "\n" + SUBAGENT_MSG
            : SUBAGENT_MSG;
        }
      }

      // F1: Track edits vs verifications
      if (VERIFY_COMMANDS.test(cmd)) {
        editsSinceLastCheck = 0;
      }

      // F1: Count tool use (proxied by any non-trivial command) as potential edit
      if (cmd && cmd.length > 5 && !cmd.startsWith("echo ")) {
        editsSinceLastCheck++;
        if (EDIT_COMMANDS.test(cmd)) {
          checkpoint("file_read", cmd.slice(0, 200), directory);
        }
      }

      // F1: Verification warning after too many actions without verify
      if (editsSinceLastCheck >= VERIFY_WARN_AFTER) {
        output.args.command = `echo ${VERIFY_MSG} && ` + (output.args.command || "");
        editsSinceLastCheck = 0;
      }

      // Prepend pending messages to the first command after a task
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
          }
        }
        if (cmd.includes("npx tsc") || cmd.includes("tsc ")) {
          if (lastCheckpointKey !== "typecheck") {
            lastCheckpointKey = "typecheck";
            checkpoint("typecheck", "OK", directory);
            editsSinceLastCheck = 0;
          }
        }
        if (cmd.includes("npx graphify") && (cmd.includes("update") || cmd.includes("hook-rebuild"))) {
          checkpoint("build", "graphify updated", directory);
          editsSinceLastCheck = 0;
        }
      }

      // F1: Verification warning after many edits without verification
      if (editsSinceLastCheck >= VERIFY_WARN_AFTER && exitOk) {
        // Inject warning on next command
        // We can't modify subsequent commands from after-hook,
        // so we set a flag that before-hook reads next time
        // For simplicity: register it as a task checkpoint
        checkpoint("file_read", "VERIFY_NEEDED", directory);
      }
    },
  };
};
