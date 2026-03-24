/**
 * Tools Module - Tool definitions and implementations
 */

import { Type, Static } from "@sinclair/typebox";
import type { Component } from "@mariozechner/pi-tui";
import type { SQLiteStore } from "../core/store.js";
import type { ContextAssembler } from "../core/context.js";
import type { ReasoningEngine } from "../core/reasoning.js";
import type { PeerCard, Observation } from "../shared.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-coding-agent";
import { createPeerCardRenderer, createStatsRenderer, createSearchResultsRenderer, createSessionListRenderer } from "../renderers.js";
import { generateId } from "../shared.js";

// Config type matching shared.ts
export interface ToolsConfig {
  workspaceId: string;
  retention: { retentionDays: number; summaryRetentionDays: number; conclusionRetentionDays: number };
  dream: { enabled: boolean };
}

// Tool definitions - single source of truth
export const TOOLS = {
  learn_add_message: {
    label: "Add Message",
    description: "Store a message in memory for future reasoning.",
    params: Type.Object({
      content: Type.String({ description: "The message content to store" }),
      role: Type.String({ description: "Role of the message sender (user, assistant)" }),
    }),
  },
  learn_add_messages_batch: {
    label: "Add Messages Batch",
    description: "Store multiple messages in a single batch operation. Efficient for bulk ingestion.",
    params: Type.Object({
      messages: Type.Array(Type.Object({
        content: Type.String({ description: "Message content" }),
        role: Type.String({ description: "Role (user, assistant)" }),
        sessionId: Type.Optional(Type.String({ description: "Session ID" })),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Message metadata" })),
      }), { description: "Array of messages to store" }),
    }),
  },
  learn_add_observation: {
    label: "Add Observation",
    description: "Store a raw observation/message for later processing. Observations are stored before reasoning extracts insights.",
    params: Type.Object({
      content: Type.String({ description: "The observation content to store" }),
      role: Type.String({ description: "Role of the message sender (user, assistant)" }),
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      sessionId: Type.Optional(Type.String({ description: "Session ID (defaults to current session)" })),
    }),
  },
  learn_get_context: {
    label: "Get Peer Context",
    description: "Retrieve the assembled context for a peer from memory.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) }),
  },
  learn_query: {
    label: "Query Memory",
    description: "Search memory for conclusions similar to a query.",
    params: Type.Object({
      query: Type.String({ description: "Search query" }),
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      topK: Type.Optional(Type.Integer({ description: "Number of results (default 5)" })),
      minSimilarity: Type.Optional(Type.Number({ description: "Minimum similarity threshold 0-1 (default 0)" })),
    }),
  },
  learn_reason_now: { label: "Trigger Reasoning", description: "Immediately process pending messages through the reasoning engine.", params: Type.Object({}) },
  learn_trigger_dream: { label: "Trigger Dream", description: "Manually trigger a dream cycle for deeper reasoning.", params: Type.Object({}) },
  learn_prune: { label: "Prune Old Data", description: "Manually trigger retention pruning to delete old data.", params: Type.Object({}) },
  learn_get_peer_card: {
    label: "Get Peer Card",
    description: "Get the biographical information card for a peer.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) }),
  },
  learn_update_peer_card: {
    label: "Update Peer Card",
    description: "Manually update the peer card with biographical information.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      name: Type.Optional(Type.String({ description: "Peer's name" })),
      occupation: Type.Optional(Type.String({ description: "Peer's occupation" })),
      interests: Type.Optional(Type.Array(Type.String(), { description: "List of interests" })),
      traits: Type.Optional(Type.Array(Type.String(), { description: "List of traits" })),
      goals: Type.Optional(Type.Array(Type.String(), { description: "List of goals" })),
    }),
  },
  learn_list_peers: { label: "List Peers", description: "List all peers in the current workspace.", params: Type.Object({}) },
  learn_get_stats: {
    label: "Get Memory Stats",
    description: "Get statistics about memory for a peer.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) }),
  },
  learn_get_insights: {
    label: "Get Memory Insights",
    description: "Get comprehensive insights about learning patterns, topic distribution, and engagement metrics.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) }),
  },
  learn_get_summaries: {
    label: "Get Summaries",
    description: "Get all summaries for a peer.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      limit: Type.Optional(Type.Integer({ description: "Max summaries to return (default 10)" })),
    }),
  },
  learn_search_sessions: {
    label: "Search Sessions",
    description: "Search through session history by keyword.",
    params: Type.Object({
      query: Type.String({ description: "Search query to match in messages" }),
      limit: Type.Optional(Type.Integer({ description: "Max results (default 10)" })),
    }),
  },
  learn_get_session: {
    label: "Get Session",
    description: "Get details and messages from a specific session.",
    params: Type.Object({
      sessionId: Type.String({ description: "Session ID to retrieve" }),
      limit: Type.Optional(Type.Integer({ description: "Max messages (default 50)" })),
    }),
  },
  learn_list_sessions: {
    label: "List Sessions",
    description: "List all sessions in the current workspace.",
    params: Type.Object({ limit: Type.Optional(Type.Integer({ description: "Max sessions (default 20)" })) }),
  },
  learn_tag_session: {
    label: "Tag Session",
    description: "Add or remove tags from a session for categorization.",
    params: Type.Object({
      sessionId: Type.String({ description: "Session ID to tag" }),
      addTags: Type.Optional(Type.Array(Type.String(), { description: "Tags to add" })),
      removeTags: Type.Optional(Type.Array(Type.String(), { description: "Tags to remove" })),
    }),
  },
  learn_get_sessions_by_tag: {
    label: "Get Sessions By Tag",
    description: "Get all sessions with a specific tag.",
    params: Type.Object({
      tag: Type.String({ description: "Tag to search for" }),
      limit: Type.Optional(Type.Integer({ description: "Max sessions (default 20)" })),
    }),
  },
  learn_list_tags: {
    label: "List All Tags",
    description: "List all unique tags across sessions with their counts.",
    params: Type.Object({}),
  },
  learn_export: { label: "Export Memory", description: "Export all memory data as JSON for backup.", params: Type.Object({}) },
  learn_import: {
    label: "Import Memory",
    description: "Import memory data from a JSON export.",
    params: Type.Object({
      data: Type.String({ description: "JSON export data" }),
      merge: Type.Optional(Type.Boolean({ description: "Merge with existing data (default: true)" })),
    }),
  },
  learn_observe_peer: {
    label: "Observe Peer",
    description: "Record an observation about another peer (cross-peer). Used for perspective-taking.",
    params: Type.Object({
      aboutPeerId: Type.String({ description: "The peer ID being observed" }),
      content: Type.String({ description: "The observation content" }),
      sessionId: Type.Optional(Type.String({ description: "Session ID (defaults to current)" })),
    }),
  },
  learn_get_perspective: {
    label: "Get Perspective",
    description: "Get context from a specific peer's perspective - what they know about another peer.",
    params: Type.Object({
      observerPeerId: Type.String({ description: "The peer whose perspective to view" }),
      targetPeerId: Type.String({ description: "The peer being observed" }),
    }),
  },
} as const;

// Create tool executors with proper typing
export function createToolExecutors(deps: {
  store: SQLiteStore;
  contextAssembler: ContextAssembler;
  reasoningEngine: ReasoningEngine;
  config: ToolsConfig;
  runDream: () => Promise<void>;
}) {
  const { store, contextAssembler, reasoningEngine, config, runDream } = deps;

  // Type for tool execute function
  type ToolExecute<TParams> = (
    toolCallId: string,
    params: TParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<unknown> | undefined,
    ctx: ExtensionContext
  ) => Promise<AgentToolResult<unknown>>;

  return {
    learn_add_message: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_add_message.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const sessionFile = ctx.sessionManager.getSessionFile();
        if (!sessionFile) return { content: [{ type: "text" as const, text: "No active session" }], details: { error: "No active session" } };
        reasoningEngine.queue({ sessionFile, peerId: params.role === "assistant" ? "agent" : params.role, messages: [{ role: params.role, content: params.content }], queuedAt: Date.now() });
        return { content: [{ type: "text" as const, text: "Message queued for reasoning" }], details: { queued: true } };
      }) as ToolExecute<any>,
    },
    learn_add_messages_batch: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_add_messages_batch.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const sessionFile = _ctx.sessionManager.getSessionFile() || "default";
        const messages = params.messages.map((m, i) => ({
          id: generateId(`msg_${i}_`),
          sessionId: m.sessionId || sessionFile,
          peerId: m.role === "assistant" ? "agent" : "user",
          role: m.role,
          content: m.content,
          createdAt: Date.now() + i,
          metadata: m.metadata,
        }));
        const count = store.saveMessagesBatch(config.workspaceId, messages);
        return { content: [{ type: "text" as const, text: `Batch inserted ${count} messages` }], details: { count, success: true } };
      }) as ToolExecute<any>,
    },
    learn_add_observation: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_add_observation.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const peerId = params.peerId || "user";
        const sessionId = params.sessionId || ctx.sessionManager.getSessionFile() || "default";
        const observation: Observation = {
          id: generateId("obs_"),
          workspaceId: config.workspaceId,
          peerId,
          sessionId,
          role: params.role as "user" | "assistant" | "system",
          content: params.content,
          createdAt: Date.now(),
          processed: false,
        };
        store.saveObservation(observation);
        return { 
          content: [{ type: "text" as const, text: `Observation saved: ${params.content.slice(0, 100)}${params.content.length > 100 ? '...' : ''}` }], 
          details: { success: true, observationId: observation.id } 
        };
      }) as ToolExecute<any>,
    },
    learn_get_context: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_context.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const assembledCtx = contextAssembler.assembleContext(config.workspaceId, params.peerId || "user");
        if (!assembledCtx) return { content: [{ type: "text" as const, text: "No context found" }], details: { found: false } };
        return { content: [{ type: "text" as const, text: assembledCtx }], details: { found: true, peerId: params.peerId } };
      }) as ToolExecute<any>,
    },
    learn_query: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_query.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const results = await contextAssembler.searchSimilar(
          config.workspaceId,
          params.peerId || "user",
          params.query,
          params.topK || 5,
          params.minSimilarity ?? 0
        );
        if (!results.length) return { content: [{ type: "text" as const, text: `No results found for: ${params.query}` }], details: { found: false } };
        return { content: [{ type: "text" as const, text: results.map((r, i) => `${i + 1}. [${r.type}] ${r.content}`).join("\n") }], details: { found: true, count: results.length } };
      }) as ToolExecute<any>,
    },
    learn_reason_now: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_reason_now.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        ctx.ui.setStatus("learn", "Reasoning...");
        const stats = contextAssembler.getMemoryStats(config.workspaceId, "user");
        return { content: [{ type: "text" as const, text: `Reasoning complete. ${stats.conclusionCount} conclusions.` }], details: stats };
      }) as ToolExecute<any>,
    },
    learn_trigger_dream: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_trigger_dream.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        ctx.ui.setStatus("learn", "Dreaming...");
        await runDream();
        return { content: [{ type: "text" as const, text: "Dream cycle complete" }], details: { success: true } };
      }) as ToolExecute<any>,
    },
    learn_prune: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_prune.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
        return { content: [{ type: "text" as const, text: `Pruned ${result.deleted} old records` }], details: result };
      }) as ToolExecute<any>,
    },
    learn_get_peer_card: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_peer_card.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const card = store.getPeerCard(config.workspaceId, params.peerId || "user");
        if (!card) return { content: [{ type: "text" as const, text: "No peer card found" }], details: { found: false, peerId: params.peerId } as any };
        return { content: [{ type: "text" as const, text: `## Peer Card\n\nName: ${card.name || 'N/A'}` }], details: { found: true, peerId: params.peerId, card } as any };
      }) as ToolExecute<any>,
      renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any): Component => {
        const details = result.details as { card?: any } | undefined;
        if (!details?.card) return { render: () => ["No peer card found"] } as unknown as Component;
        return createPeerCardRenderer(details.card, theme);
      },
    },
    learn_update_peer_card: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_update_peer_card.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const peerId = params.peerId || "user";
        const existing = store.getPeerCard(config.workspaceId, peerId);
        const updated: PeerCard = { 
          peerId, 
          name: params.name ?? existing?.name, 
          occupation: params.occupation ?? existing?.occupation, 
          interests: params.interests ?? existing?.interests ?? [], 
          traits: params.traits ?? existing?.traits ?? [], 
          goals: params.goals ?? existing?.goals ?? [], 
          updatedAt: Date.now() 
        };
        store.savePeerCard(config.workspaceId, updated);
        return { content: [{ type: "text" as const, text: `Peer card updated for: ${peerId}` }], details: { success: true } };
      }) as ToolExecute<any>,
    },
    learn_list_peers: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_list_peers.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const peers = store.getAllPeers(config.workspaceId);
        return { content: [{ type: "text" as const, text: peers.map((p, i) => `${i + 1}. ${p.name} (${p.type})`).join("\n") || "No peers" }], details: { count: peers.length } };
      }) as ToolExecute<any>,
    },
    learn_get_stats: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_stats.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const stats = contextAssembler.getMemoryStats(config.workspaceId, params.peerId || "user");
        return { content: [{ type: "text" as const, text: `Stats: ${stats.conclusionCount} conclusions` }], details: stats as any };
      }) as ToolExecute<any>,
      renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any): Component => {
        const details = result.details as any;
        if (!details) return { render: () => ["No stats"] } as unknown as Component;
        return createStatsRenderer(details, theme);
      },
    },
    learn_get_insights: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_insights.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const insights = contextAssembler.getInsights(config.workspaceId, params.peerId || "user");
        const lines = [
          "## Memory Insights",
          "",
          "### Learning Velocity",
          `${insights.learningVelocity.toFixed(2)} conclusions/day (7-day avg)`,
          "",
          "### Topic Distribution",
          `- Deductive: ${insights.topicDistribution.deductive}`,
          `- Inductive: ${insights.topicDistribution.inductive}`,
          `- Abductive: ${insights.topicDistribution.abductive}`,
          "",
          "### Engagement",
          `- Total Sessions: ${insights.engagementMetrics.totalSessions}`,
          `- Total Messages: ${insights.engagementMetrics.totalMessages}`,
          `- Sessions This Week: ${insights.engagementMetrics.sessionFrequencyPerWeek}`,
          `- Active Days Last Week: ${insights.engagementMetrics.activeDaysLastWeek}`,
          "",
          "### Recent Activity",
          `- Conclusions Last Week: ${insights.recentActivity.conclusionsLastWeek}`,
          `- Conclusions Last Month: ${insights.recentActivity.conclusionsLastMonth}`,
        ];
        
        if (insights.interestEvolution.length > 0) {
          lines.push("", "### Interest Trends");
          for (const item of insights.interestEvolution.slice(0, 5)) {
            const trendIcon = item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→';
            lines.push(`- ${item.interest}: ${trendIcon} (${item.frequency})`);
          }
        }
        
        return { content: [{ type: "text" as const, text: lines.join("\n") }], details: insights };
      }) as ToolExecute<any>,
    },
    learn_get_summaries: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_summaries.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const summaries = store.getSummaries(config.workspaceId, params.peerId || "user", params.limit || 10);
        if (!summaries.length) return { content: [{ type: "text" as const, text: "No summaries found" }], details: { count: 0 } };
        return { content: [{ type: "text" as const, text: summaries.map((s, i) => `${i + 1}. [${s.type}] ${s.content}`).join("\n") }], details: { count: summaries.length } };
      }) as ToolExecute<any>,
    },
    learn_search_sessions: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_search_sessions.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const results = store.searchSessions(config.workspaceId, params.query, params.limit || 10);
        if (!results.length) return { content: [{ type: "text" as const, text: "No results" }], details: { found: false, query: params.query, results: [] } as any };
        return { content: [{ type: "text" as const, text: results.map((r, i) => `${i + 1}. ${r.snippet}`).join("\n") }], details: { found: true, query: params.query, count: results.length, results } as any };
      }) as ToolExecute<any>,
      renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any): Component => {
        const details = result.details as { results?: any[]; query?: string } | undefined;
        if (!details?.results?.length) return { render: () => ["No results"] } as unknown as Component;
        return createSearchResultsRenderer(details.results, details.query || "", theme);
      },
    },
    learn_get_session: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_session.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const messages = store.getMessages(config.workspaceId, params.sessionId, params.limit || 50);
        const session = store.getSession(config.workspaceId, params.sessionId);
        return { 
          content: [{ type: "text" as const, text: messages.map((m: any) => `[${m.role}] ${m.content}`).join("\n") }], 
          details: { found: true, sessionId: params.sessionId, messageCount: messages.length, tags: session?.tags || [] } 
        };
      }) as ToolExecute<any>,
    },
    learn_list_sessions: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_list_sessions.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const sessions = store.getAllSessions(config.workspaceId).slice(0, params.limit || 20);
        if (!sessions.length) return { content: [{ type: "text" as const, text: "No sessions" }], details: { count: 0, sessions: [] } as any };
        return { content: [{ type: "text" as const, text: sessions.map((s, i) => `${i + 1}. ${s.id}${s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : ''}`).join("\n") }], details: { count: sessions.length, sessions } as any };
      }) as ToolExecute<any>,
      renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any): Component => {
        const details = result.details as { sessions?: any[] } | undefined;
        if (!details?.sessions?.length) return { render: () => ["No sessions"] } as unknown as Component;
        return createSessionListRenderer(details.sessions, theme);
      },
    },
    learn_tag_session: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_tag_session.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        if (params.addTags?.length) {
          store.tagSession(config.workspaceId, params.sessionId, params.addTags);
        }
        if (params.removeTags?.length) {
          store.untagSession(config.workspaceId, params.sessionId, params.removeTags);
        }
        const session = store.getSession(config.workspaceId, params.sessionId);
        return { 
          content: [{ type: "text" as const, text: `Session ${params.sessionId} updated. Tags: ${session?.tags?.join(', ') || 'none'}` }], 
          details: { success: true, sessionId: params.sessionId, tags: session?.tags || [] } 
        };
      }) as ToolExecute<any>,
    },
    learn_get_sessions_by_tag: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_sessions_by_tag.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const sessions = store.getSessionsByTag(config.workspaceId, params.tag, params.limit || 20);
        if (!sessions.length) return { content: [{ type: "text" as const, text: `No sessions with tag: ${params.tag}` }], details: { found: false, tag: params.tag, count: 0 } };
        return { content: [{ type: "text" as const, text: sessions.map((s, i) => `${i + 1}. ${s.id}`).join("\n") }], details: { found: true, tag: params.tag, count: sessions.length, sessions } };
      }) as ToolExecute<any>,
    },
    learn_list_tags: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_list_tags.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const tags = store.getAllTags(config.workspaceId);
        if (!tags.length) return { content: [{ type: "text" as const, text: "No tags found" }], details: { count: 0, tags: [] } };
        return { content: [{ type: "text" as const, text: tags.map((t, i) => `${i + 1}. ${t.tag} (${t.count})`).join("\n") }], details: { count: tags.length, tags } };
      }) as ToolExecute<any>,
    },
    learn_export: {
      execute: (async (
        _: string,
        __: Static<typeof TOOLS.learn_export.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const data = store.exportAll(config.workspaceId);
        return { content: [{ type: "text" as const, text: `Exported ${data.conclusions.length} conclusions` }], details: data };
      }) as ToolExecute<any>,
    },
    learn_import: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_import.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        try {
          const data = JSON.parse(params.data);
          store.importAll(config.workspaceId, data, params.merge ?? true);
          return { content: [{ type: "text" as const, text: `Imported ${data.conclusions?.length || 0} conclusions` }], details: { success: true } };
        } catch (e) {
          return { content: [{ type: "text" as const, text: `Import failed: ${e}` }], details: { success: false, error: String(e) } };
        }
      }) as ToolExecute<any>,
    },
    learn_observe_peer: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_observe_peer.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const sessionFile = ctx.sessionManager.getSessionFile();
        const observerPeerId = "user"; // The observer is the user
        
        store.saveObservation({
          id: crypto.randomUUID(),
          workspaceId: config.workspaceId,
          peerId: observerPeerId,
          aboutPeerId: params.aboutPeerId,
          sessionId: params.sessionId || sessionFile || "default",
          role: "user",
          content: params.content,
          createdAt: Date.now(),
          processed: false,
        });
        
        return { content: [{ type: "text" as const, text: `Observation recorded about ${params.aboutPeerId}` }], details: { success: true, aboutPeerId: params.aboutPeerId } };
      }) as ToolExecute<any>,
    },
    learn_get_perspective: {
      execute: (async (
        _: string,
        params: Static<typeof TOOLS.learn_get_perspective.params>,
        _signal: AbortSignal | undefined,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx: ExtensionContext
      ): Promise<AgentToolResult<unknown>> => {
        const perspective = contextAssembler.getPerspective(config.workspaceId, params.observerPeerId, params.targetPeerId);
        
        if (!perspective) {
          return { content: [{ type: "text" as const, text: `No perspective data found for ${params.observerPeerId} on ${params.targetPeerId}` }], details: { found: false } };
        }
        
        return { content: [{ type: "text" as const, text: perspective }], details: { found: true, observerPeerId: params.observerPeerId, targetPeerId: params.targetPeerId } };
      }) as ToolExecute<any>,
    },
  };
}
