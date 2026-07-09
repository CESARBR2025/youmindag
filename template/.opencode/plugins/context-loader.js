// context-loader OpenCode plugin
// Auto-loads project context when a domain is detected in the task.
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const CONTEXT_MAP_PATH = join(ROOT, ".opencode", "context-map.yaml");
const LOADER_SCRIPT = join(ROOT, "scripts", "load-context.mjs");
const SKILL_PATH = join(ROOT, ".opencode", "skills", "context-loader.yaml");

export const ContextLoaderPlugin = async ({ directory }) => {
  let reminded = false;
  let lastTask = "";

  return {
    "tool.execute.before": async (input, output) => {
      // Detect if this is a new user task (not a follow-up tool call)
      const task = input?.text || "";
      const isNewTask = task && task !== lastTask && task.length > 15;
      if (isNewTask) lastTask = task;

      // Auto-load context on new task
      if (isNewTask && existsSync(LOADER_SCRIPT)) {
        try {
          const ctx = execSync(`node "${LOADER_SCRIPT}" "${task}"`, {
            encoding: "utf-8",
            timeout: 20000,
            stdio: ["pipe", "pipe", "pipe"],
          });
          if (ctx.trim()) {
            output.args.command =
              `echo ${JSON.stringify(ctx.trim())} && ` +
              (output.args.command || "");
            reminded = true;
            return;
          }
        } catch {
          // Silently fail, fallback to normal behavior
        }
      }

      // Fallback: remind about context loading
      if (!reminded) {
        const cmdHint =
          existsSync(SKILL_PATH)
            ? `echo "[context] Cargar contexto automático con: skill context-loader"`
            : `echo "[context] Revisar .opencode/context-map.yaml para contexto del proyecto"`;
        output.args.command =
          `${cmdHint} && ` + (output.args.command || "");
        reminded = true;
      }
    },
    "tool.execute.after": async (_input, output) => {
      if (output?.result?.exitCode === 0) {
        reminded = false;
      }
    },
  };
};
