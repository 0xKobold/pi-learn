/**
 * Pi-Learn: Open-Source Memory Infrastructure for pi Agents
 * 
 * Modular Architecture (DRY/KISS/Functional):
 * - core/store.ts: SQLite operations
 * - core/reasoning.ts: LLM reasoning engine
 * - core/context.ts: Context assembly
 * - tools/index.ts: Tool definitions and executors
 * - renderers.ts: TUI components
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Core modules
import { createStore, SQLiteStore } from "./core/store.js";
import { createReasoningEngine, DEFAULT_RETRY_CONFIG } from "./core/reasoning.js";
import { createContextAssembler } from "./core/context.js";

// Tools
import { TOOLS, createToolExecutors, type ToolsConfig } from "./tools/index.js";

// Shared
import {
  DEFAULT_RETENTION,
  DEFAULT_DREAM,
  DEFAULT_TOKEN_BATCH_SIZE,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_REASONING_MODEL,
} from "./shared.js";

// ============================================================================
// MAIN EXTENSION
// ============================================================================

// UI notification callback type
type NotifyCallback = (message: string, type?: "info" | "warning" | "error") => void;

// UI notification callback - captured when commands are first executed
let notifyCallback: NotifyCallback | null = null;

export default async (pi: ExtensionAPI): Promise<void> => {
  // Load configuration
  const config = loadConfig();

  // Initialize database (async for sql.js)
  const dbPath = path.join(os.homedir(), ".pi", "memory", "pi-learn.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const store = await createStore(dbPath);
  await store.init();

  // Initialize core components
  const reasoningEngine = createReasoningEngine({
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaApiKey: config.ollamaApiKey,
    reasoningModel: config.reasoningModel,
    embeddingModel: config.embeddingModel,
    tokenBatchSize: config.tokenBatchSize,
    retry: config.retry,
  });

  const contextAssembler = createContextAssembler(store);

  // Ensure default workspace and peers exist
  store.getOrCreateWorkspace(config.workspaceId, "Default Workspace");
  store.getOrCreatePeer(config.workspaceId, "user", "User", "user");
  store.getOrCreatePeer(config.workspaceId, "agent", "Agent", "agent");

  // Ensure global workspace and peer for cross-project memory
  store.ensureGlobalWorkspace();
  store.ensureGlobalPeer("user", "User");
  store.ensureGlobalPeer("agent", "Agent");

  // Run dream function - with scope-aware reasoning
  const runDream = async (scope: "user" | "project" = "project"): Promise<void> => {
    if (!config.dream.enabled) return;
    
    const workspaceId = scope === "user" ? "__global__" : config.workspaceId;
    const messages = store.getRecentMessages(config.workspaceId, "user", config.dream.batchSize);
    if (messages.length < config.dream.minMessagesSinceLastDream) return;
    
    // Get context for informed reasoning (blended global + local)
    const blended = contextAssembler.getBlendedContext(config.workspaceId, "user");
    const reasoningContext = {
      globalConclusions: blended.global.conclusions,
      localConclusions: blended.project.conclusions,
      globalPeerCard: blended.global.peerCard || undefined,
    };
    
    // Run dream with context and let the model decide scope
    const result = await reasoningEngine.dream(
      messages.map((m: any) => ({ role: m.role, content: m.content })),
      blended.blendedConclusions,
      reasoningContext
    );
    
    // Save conclusions with the scope the model assigned
    let userScopeCount = 0;
    let projectScopeCount = 0;
    
    for (const c of result.newConclusions) {
      // Use the scope assigned by the reasoning model
      const conclusionScope = c.scope || scope;
      
      // Determine which workspace to save to based on scope
      const conclusionWorkspaceId = conclusionScope === "user" 
        ? "__global__" 
        : config.workspaceId;
      
      store.saveConclusion(conclusionWorkspaceId, {
        id: crypto.randomUUID(),
        peerId: "user",
        type: c.type,
        content: c.content,
        premises: c.premises,
        confidence: c.confidence,
        createdAt: Date.now(),
        sourceSessionId: messages[0]?.session_id || "dream",
        scope: conclusionScope,
      });
      
      if (conclusionScope === "user") {
        userScopeCount++;
      } else {
        projectScopeCount++;
      }
    }
    
    // Track dream metadata
    store.updateDreamMetadata(workspaceId, messages.length, result.newConclusions.length);
    
    // Notify about dream completion with scope distribution
    if (result.newConclusions.length > 0) {
      notify(
        `Dream complete: ${userScopeCount} user-scope, ${projectScopeCount} project-scope conclusions`,
        "info"
      );
    }
  };

  // UI notification helper - captures ctx.ui when available
  const notify = (message: string, type: "info" | "warning" | "error" = "info") => {
    if (notifyCallback) {
      notifyCallback(message, type);
    }
  };

  // Tools config
  const toolsConfig: ToolsConfig = {
    workspaceId: config.workspaceId,
    retention: config.retention,
    dream: config.dream,
  };

  // Create and register tools
  const executors = createToolExecutors({ store, contextAssembler, reasoningEngine, config: toolsConfig, runDream });

  for (const [name, def] of Object.entries(TOOLS)) {
    const executor = executors[name as keyof typeof executors];
    if (!executor) continue;

    const toolDef: any = {
      name,
      label: def.label,
      description: def.description,
      parameters: def.params,
      execute: executor.execute,
    };

    // Add renderResult if the executor has one
    if ('renderResult' in executor) {
      toolDef.renderResult = executor.renderResult;
    }

    pi.registerTool(toolDef);
  }

  // ========================================================================
  // COMMANDS
  // ========================================================================

  pi.registerCommand("learn", {
    description: "Pi-learn memory management",
    handler: async (args: string, ctx: ExtensionContext) => {
      // Capture UI notify callback for background tasks
      notifyCallback = ctx.ui.notify.bind(ctx.ui);

      const [sub, ...rest] = args.trim().split(/\s+/);
      const subArgs = rest.join(" ");

      switch (sub) {
        case "status": {
          const stats = contextAssembler.getMemoryStats(config.workspaceId, "user");
          ctx.ui.notify(`Memory Status: ${stats.conclusionCount} conclusions, ${stats.summaryCount} summaries`, "info");
          return;
        }
        case "context": {
          const assembledCtx = contextAssembler.assembleContext(config.workspaceId, "user");
          ctx.ui.notify(assembledCtx || "No context available", "info");
          return;
        }
        case "dream":
          ctx.ui.setStatus("learn", "Dreaming...");
          await runDream();
          ctx.ui.notify("Dream cycle complete", "info");
          return;
        case "dream-status": {
          const dreamMeta = store.getDreamMetadata(config.workspaceId);
          const messages = store.getRecentMessages(config.workspaceId, "user", 1000);
          const messagesSinceLastDream = messages.filter((m: any) => m.created_at > dreamMeta.lastDreamedAt).length;
          const lastDreamFormatted = dreamMeta.lastDreamedAt > 0
            ? new Date(dreamMeta.lastDreamedAt).toLocaleString()
            : "Never";
          const nextDreamMs = dreamMeta.lastDreamedAt > 0
            ? Math.max(0, (dreamMeta.lastDreamedAt + config.dream.intervalMs) - Date.now())
            : 0;
          ctx.ui.notify(
            `Dream Status\nEnabled: ${config.dream.enabled}\nLast Dream: ${lastDreamFormatted}\nTotal Dreams: ${dreamMeta.dreamCount}\nMessages Since: ${messagesSinceLastDream}\nNext In: ${nextDreamMs > 0 ? Math.ceil(nextDreamMs / 60000) + " min" : "Ready now"}`,
            "info"
          );
          return;
        }
        case "prune": {
          const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
          ctx.ui.notify(`Pruned ${result.deleted} records`, "info");
          return;
        }
        case "search":
          if (!subArgs) {
            ctx.ui.notify("Usage: /learn search <query>", "info");
            return;
          }
          const results = store.searchSessions(config.workspaceId, subArgs, 5);
          ctx.ui.notify(results.length ? results.map((r, i) => `${i + 1}. ${r.snippet}`).join("\n") : "No results found", "info");
          return;
        case "sessions": {
          const sessions = store.getAllSessions(config.workspaceId);
          ctx.ui.notify(sessions.length ? sessions.slice(0, 10).map((s, i) => `${i + 1}. ${s.id}`).join("\n") : "No sessions", "info");
          return;
        }
        default:
          ctx.ui.notify("Commands: status, context, dream, dream-status, prune, search <query>, sessions", "info");
          return;
      }
    },
  });

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  pi.on("session_start", async (_event, ctx) => {
    store.getOrCreateWorkspace(config.workspaceId);
    ctx.ui.notify("Pi-learn memory extension loaded", "info");
  });

  pi.on("tool_result", async (event, ctx) => {
    // After tool execution, optionally update memory with tool results
    if (!config.reasoningEnabled) return;
    
    // Log tool activity for learning purposes
    const toolName = event.toolName;
    if (toolName && toolName.startsWith("learn_")) {
      // Skip - these are our own tools
      return;
    }
    
    // Could queue tool results for reasoning here if desired
  });

  // ========================================================================
  // BACKGROUND SERVICES
  // ========================================================================

  // Dream scheduler
  if (config.dream.enabled) {
    setTimeout(() => runDream().catch(console.error), 30000);
    setInterval(() => runDream().catch(console.error), config.dream.intervalMs);
  }

  // Retention (runs silently in background - use /learn prune command to see results)
  if (config.retention.pruneOnStartup) {
    setTimeout(() => {
      const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
      if (result.deleted > 0) {
        notify(`Pruned ${result.deleted} old records`, "info");
      }
    }, 5000);
  }
  setInterval(() => {
    const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
    if (result.deleted > 0) {
      notify(`Pruned ${result.deleted} old records`, "info");
    }
  }, config.retention.pruneIntervalHours * 60 * 60 * 1000);
};

// ============================================================================
// CONFIGURATION
// ============================================================================

interface Config {
  workspaceId: string;
  reasoningEnabled: boolean;
  reasoningModel: string;
  embeddingModel: string;
  tokenBatchSize: number;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  retention: { retentionDays: number; summaryRetentionDays: number; conclusionRetentionDays: number; pruneOnStartup: boolean; pruneIntervalHours: number };
  dream: { enabled: boolean; intervalMs: number; minMessagesSinceLastDream: number; batchSize: number };
  retry: { maxRetries: number; retryDelayMs: number; timeoutMs: number };
}

function loadConfig(): Config {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  let settings: Record<string, any> = {};
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch (e) {
    console.warn("[pi-learn] Failed to load settings:", e);
  }

  const learnSettings = settings.learn || {};

  return {
    workspaceId: learnSettings.workspaceId || "default",
    reasoningEnabled: learnSettings.reasoningEnabled ?? true,
    reasoningModel: learnSettings.reasoningModel || DEFAULT_REASONING_MODEL,
    embeddingModel: learnSettings.embeddingModel || DEFAULT_EMBEDDING_MODEL,
    tokenBatchSize: learnSettings.tokenBatchSize || DEFAULT_TOKEN_BATCH_SIZE,
    ollamaBaseUrl: settings.ollama?.baseUrl || "http://localhost:11434",
    ollamaApiKey: settings.ollama?.apiKey || "",
    retention: { ...DEFAULT_RETENTION, ...learnSettings.retention },
    dream: { ...DEFAULT_DREAM, ...learnSettings.dream },
    retry: { ...DEFAULT_RETRY_CONFIG, ...learnSettings.retry },
  };
}
