/**
 * Tools Module - Tool definitions and implementations
 */
import { Type } from "@sinclair/typebox";
import { createPeerCardRenderer, createStatsRenderer, createSearchResultsRenderer, createSessionListRenderer } from "../renderers.js";
import { generateId } from "../shared.js";
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
        description: "Retrieve the blended context for a peer (global user profile + project memories).",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
            scope: Type.Optional(Type.String({ description: "Scope filter: 'blended' (default), 'global', or 'project'" })),
        }),
    },
    learn_get_global_context: {
        label: "Get Global Context",
        description: "Retrieve cross-project context (user traits, interests, goals) shared across all projects.",
        params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) }),
    },
    learn_get_project_context: {
        label: "Get Project Context",
        description: "Retrieve project-specific context (local to current workspace).",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
            workspaceId: Type.Optional(Type.String({ description: "Workspace ID (defaults to current)" })),
        }),
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
    learn_trigger_dream: {
        label: "Trigger Dream",
        description: "Manually trigger a dream cycle for deeper reasoning.",
        params: Type.Object({
            scope: Type.Optional(Type.String({ description: "Scope: 'project' (default) or 'user' (global)" })),
        }),
    },
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
    learn_get_dream_status: {
        label: "Get Dream Status",
        description: "Get information about the dreaming system - when it last ran, next scheduled dream, and statistics.",
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
};
// Create tool executors with proper typing
export function createToolExecutors(deps) {
    const { store, contextAssembler, reasoningEngine, config, runDream } = deps;
    return {
        learn_add_message: {
            execute: (async (_, params, _signal, _onUpdate, ctx) => {
                const sessionFile = ctx.sessionManager.getSessionFile();
                if (!sessionFile)
                    return { content: [{ type: "text", text: "No active session" }], details: { error: "No active session" } };
                reasoningEngine.queue({ sessionFile, peerId: params.role === "assistant" ? "agent" : params.role, messages: [{ role: params.role, content: params.content }], queuedAt: Date.now() });
                return { content: [{ type: "text", text: "Message queued for reasoning" }], details: { queued: true } };
            }),
        },
        learn_add_messages_batch: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
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
                return { content: [{ type: "text", text: `Batch inserted ${count} messages` }], details: { count, success: true } };
            }),
        },
        learn_add_observation: {
            execute: (async (_, params, _signal, _onUpdate, ctx) => {
                const peerId = params.peerId || "user";
                const sessionId = params.sessionId || ctx.sessionManager.getSessionFile() || "default";
                const observation = {
                    id: generateId("obs_"),
                    workspaceId: config.workspaceId,
                    peerId,
                    sessionId,
                    role: params.role,
                    content: params.content,
                    createdAt: Date.now(),
                    processed: false,
                };
                store.saveObservation(observation);
                return {
                    content: [{ type: "text", text: `Observation saved: ${params.content.slice(0, 100)}${params.content.length > 100 ? '...' : ''}` }],
                    details: { success: true, observationId: observation.id }
                };
            }),
        },
        learn_get_context: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const peerId = params.peerId || "user";
                const scope = params.scope || "blended";
                let assembledCtx = null;
                let contextType = "blended";
                if (scope === "global") {
                    assembledCtx = contextAssembler.getGlobalContext(peerId);
                    contextType = "global";
                }
                else if (scope === "project") {
                    assembledCtx = contextAssembler.getProjectContext(config.workspaceId, peerId);
                    contextType = "project";
                }
                else {
                    assembledCtx = contextAssembler.assembleContext(config.workspaceId, peerId);
                }
                if (!assembledCtx)
                    return { content: [{ type: "text", text: "No context found" }], details: { found: false, scope: contextType } };
                return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: contextType } };
            }),
        },
        learn_get_global_context: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const peerId = params.peerId || "user";
                const assembledCtx = contextAssembler.getGlobalContext(peerId);
                if (!assembledCtx)
                    return { content: [{ type: "text", text: "No global context found" }], details: { found: false, scope: "global" } };
                return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: "global" } };
            }),
        },
        learn_get_project_context: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const peerId = params.peerId || "user";
                const workspaceId = params.workspaceId || config.workspaceId;
                const assembledCtx = contextAssembler.getProjectContext(workspaceId, peerId);
                if (!assembledCtx)
                    return { content: [{ type: "text", text: "No project context found" }], details: { found: false, scope: "project" } };
                return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: "project", workspaceId } };
            }),
        },
        learn_query: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const results = await contextAssembler.searchSimilar(config.workspaceId, params.peerId || "user", params.query, params.topK || 5, params.minSimilarity ?? 0);
                if (!results.length)
                    return { content: [{ type: "text", text: `No results found for: ${params.query}` }], details: { found: false } };
                return { content: [{ type: "text", text: results.map((r, i) => `${i + 1}. [${r.type}] ${r.content}`).join("\n") }], details: { found: true, count: results.length } };
            }),
        },
        learn_reason_now: {
            execute: (async (_, __, _signal, _onUpdate, ctx) => {
                ctx.ui.setStatus("learn", "Reasoning...");
                const stats = contextAssembler.getMemoryStats(config.workspaceId, "user");
                return { content: [{ type: "text", text: `Reasoning complete. ${stats.conclusionCount} conclusions.` }], details: stats };
            }),
        },
        learn_trigger_dream: {
            execute: (async (_, params, _signal, _onUpdate, ctx) => {
                ctx.ui.setStatus("learn", "Dreaming...");
                // runDream accepts scope parameter: 'project' or 'user'
                const scope = params.scope || 'project';
                await runDream(scope);
                const dreamMeta = store.getDreamMetadata(scope === 'user' ? "__global__" : config.workspaceId);
                return { content: [{ type: "text", text: `Dream cycle complete (${scope} scope). ${dreamMeta.lastDreamConclusions} conclusions generated.` }], details: { success: true, scope, dreamMeta } };
            }),
        },
        learn_prune: {
            execute: (async (_, __, _signal, _onUpdate, _ctx) => {
                const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
                return { content: [{ type: "text", text: `Pruned ${result.deleted} old records` }], details: result };
            }),
        },
        learn_get_peer_card: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const card = store.getPeerCard(config.workspaceId, params.peerId || "user");
                if (!card)
                    return { content: [{ type: "text", text: "No peer card found" }], details: { found: false, peerId: params.peerId } };
                return { content: [{ type: "text", text: `## Peer Card\n\nName: ${card.name || 'N/A'}` }], details: { found: true, peerId: params.peerId, card } };
            }),
            renderResult: (result, _options, theme) => {
                const details = result.details;
                if (!details?.card)
                    return { render: () => ["No peer card found"] };
                return createPeerCardRenderer(details.card, theme);
            },
        },
        learn_update_peer_card: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const peerId = params.peerId || "user";
                const existing = store.getPeerCard(config.workspaceId, peerId);
                const updated = {
                    peerId,
                    name: params.name ?? existing?.name,
                    occupation: params.occupation ?? existing?.occupation,
                    interests: params.interests ?? existing?.interests ?? [],
                    traits: params.traits ?? existing?.traits ?? [],
                    goals: params.goals ?? existing?.goals ?? [],
                    updatedAt: Date.now()
                };
                store.savePeerCard(config.workspaceId, updated);
                return { content: [{ type: "text", text: `Peer card updated for: ${peerId}` }], details: { success: true } };
            }),
        },
        learn_list_peers: {
            execute: (async (_, __, _signal, _onUpdate, _ctx) => {
                const peers = store.getAllPeers(config.workspaceId);
                return { content: [{ type: "text", text: peers.map((p, i) => `${i + 1}. ${p.name} (${p.type})`).join("\n") || "No peers" }], details: { count: peers.length } };
            }),
        },
        learn_get_stats: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const stats = contextAssembler.getMemoryStats(config.workspaceId, params.peerId || "user");
                return { content: [{ type: "text", text: `Stats: ${stats.conclusionCount} conclusions` }], details: stats };
            }),
            renderResult: (result, _options, theme) => {
                const details = result.details;
                if (!details)
                    return { render: () => ["No stats"] };
                return createStatsRenderer(details, theme);
            },
        },
        learn_get_insights: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
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
                return { content: [{ type: "text", text: lines.join("\n") }], details: insights };
            }),
        },
        learn_get_summaries: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const summaries = store.getSummaries(config.workspaceId, params.peerId || "user", params.limit || 10);
                if (!summaries.length)
                    return { content: [{ type: "text", text: "No summaries found" }], details: { count: 0 } };
                return { content: [{ type: "text", text: summaries.map((s, i) => `${i + 1}. [${s.type}] ${s.content}`).join("\n") }], details: { count: summaries.length } };
            }),
        },
        learn_search_sessions: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const results = store.searchSessions(config.workspaceId, params.query, params.limit || 10);
                if (!results.length)
                    return { content: [{ type: "text", text: "No results" }], details: { found: false, query: params.query, results: [] } };
                return { content: [{ type: "text", text: results.map((r, i) => `${i + 1}. ${r.snippet}`).join("\n") }], details: { found: true, query: params.query, count: results.length, results } };
            }),
            renderResult: (result, _options, theme) => {
                const details = result.details;
                if (!details?.results?.length)
                    return { render: () => ["No results"] };
                return createSearchResultsRenderer(details.results, details.query || "", theme);
            },
        },
        learn_get_session: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const messages = store.getMessages(config.workspaceId, params.sessionId, params.limit || 50);
                const session = store.getSession(config.workspaceId, params.sessionId);
                return {
                    content: [{ type: "text", text: messages.map((m) => `[${m.role}] ${m.content}`).join("\n") }],
                    details: { found: true, sessionId: params.sessionId, messageCount: messages.length, tags: session?.tags || [] }
                };
            }),
        },
        learn_list_sessions: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const sessions = store.getAllSessions(config.workspaceId).slice(0, params.limit || 20);
                if (!sessions.length)
                    return { content: [{ type: "text", text: "No sessions" }], details: { count: 0, sessions: [] } };
                return { content: [{ type: "text", text: sessions.map((s, i) => `${i + 1}. ${s.id}${s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : ''}`).join("\n") }], details: { count: sessions.length, sessions } };
            }),
            renderResult: (result, _options, theme) => {
                const details = result.details;
                if (!details?.sessions?.length)
                    return { render: () => ["No sessions"] };
                return createSessionListRenderer(details.sessions, theme);
            },
        },
        learn_tag_session: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                if (params.addTags?.length) {
                    store.tagSession(config.workspaceId, params.sessionId, params.addTags);
                }
                if (params.removeTags?.length) {
                    store.untagSession(config.workspaceId, params.sessionId, params.removeTags);
                }
                const session = store.getSession(config.workspaceId, params.sessionId);
                return {
                    content: [{ type: "text", text: `Session ${params.sessionId} updated. Tags: ${session?.tags?.join(', ') || 'none'}` }],
                    details: { success: true, sessionId: params.sessionId, tags: session?.tags || [] }
                };
            }),
        },
        learn_get_sessions_by_tag: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const sessions = store.getSessionsByTag(config.workspaceId, params.tag, params.limit || 20);
                if (!sessions.length)
                    return { content: [{ type: "text", text: `No sessions with tag: ${params.tag}` }], details: { found: false, tag: params.tag, count: 0 } };
                return { content: [{ type: "text", text: sessions.map((s, i) => `${i + 1}. ${s.id}`).join("\n") }], details: { found: true, tag: params.tag, count: sessions.length, sessions } };
            }),
        },
        learn_list_tags: {
            execute: (async (_, __, _signal, _onUpdate, _ctx) => {
                const tags = store.getAllTags(config.workspaceId);
                if (!tags.length)
                    return { content: [{ type: "text", text: "No tags found" }], details: { count: 0, tags: [] } };
                return { content: [{ type: "text", text: tags.map((t, i) => `${i + 1}. ${t.tag} (${t.count})`).join("\n") }], details: { count: tags.length, tags } };
            }),
        },
        learn_get_dream_status: {
            execute: (async (_, __, _signal, _onUpdate, _ctx) => {
                const dreamMeta = store.getDreamMetadata(config.workspaceId);
                const messages = store.getRecentMessages(config.workspaceId, "user", 1000);
                const messagesSinceLastDream = messages.filter((m) => m.created_at > dreamMeta.lastDreamedAt).length;
                // Calculate next dream time
                const nextDreamMs = dreamMeta.lastDreamedAt > 0
                    ? Math.max(0, (dreamMeta.lastDreamedAt + config.dream.intervalMs) - Date.now())
                    : 0;
                const nextDreamMinutes = Math.ceil(nextDreamMs / 60000);
                // Format last dream time
                const lastDreamFormatted = dreamMeta.lastDreamedAt > 0
                    ? new Date(dreamMeta.lastDreamedAt).toLocaleString()
                    : "Never";
                const lines = [
                    "## Dream Status",
                    "",
                    `**Enabled**: ${config.dream.enabled ? "Yes" : "No"}`,
                    `**Last Dream**: ${lastDreamFormatted}`,
                    `**Total Dreams**: ${dreamMeta.dreamCount}`,
                    `**Messages Since Last Dream**: ${messagesSinceLastDream}`,
                    "",
                    "### Configuration",
                    `**Interval**: ${(config.dream.intervalMs / 60000).toFixed(0)} minutes`,
                    `**Batch Size**: ${config.dream.batchSize} messages`,
                    `**Min Messages**: ${config.dream.minMessagesSinceLastDream}`,
                    "",
                    "### Last Dream Results",
                    `**Messages Processed**: ${dreamMeta.lastDreamMessages}`,
                    `**Conclusions Generated**: ${dreamMeta.lastDreamConclusions}`,
                    "",
                    nextDreamMs > 0
                        ? `**Next Dream In**: ~${nextDreamMinutes} minutes`
                        : `**Next Dream**: Ready now (${messagesSinceLastDream} messages pending)`,
                ];
                return {
                    content: [{ type: "text", text: lines.join("\n") }],
                    details: {
                        enabled: config.dream.enabled,
                        lastDreamedAt: dreamMeta.lastDreamedAt,
                        dreamCount: dreamMeta.dreamCount,
                        messagesSinceLastDream,
                        nextDreamMs,
                        intervalMs: config.dream.intervalMs,
                        lastDreamMessages: dreamMeta.lastDreamMessages,
                        lastDreamConclusions: dreamMeta.lastDreamConclusions,
                    }
                };
            }),
        },
        learn_export: {
            execute: (async (_, __, _signal, _onUpdate, _ctx) => {
                const data = store.exportAll(config.workspaceId);
                return { content: [{ type: "text", text: `Exported ${data.conclusions.length} conclusions` }], details: data };
            }),
        },
        learn_import: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                try {
                    const data = JSON.parse(params.data);
                    store.importAll(config.workspaceId, data, params.merge ?? true);
                    return { content: [{ type: "text", text: `Imported ${data.conclusions?.length || 0} conclusions` }], details: { success: true } };
                }
                catch (e) {
                    return { content: [{ type: "text", text: `Import failed: ${e}` }], details: { success: false, error: String(e) } };
                }
            }),
        },
        learn_observe_peer: {
            execute: (async (_, params, _signal, _onUpdate, ctx) => {
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
                return { content: [{ type: "text", text: `Observation recorded about ${params.aboutPeerId}` }], details: { success: true, aboutPeerId: params.aboutPeerId } };
            }),
        },
        learn_get_perspective: {
            execute: (async (_, params, _signal, _onUpdate, _ctx) => {
                const perspective = contextAssembler.getPerspective(config.workspaceId, params.observerPeerId, params.targetPeerId);
                if (!perspective) {
                    return { content: [{ type: "text", text: `No perspective data found for ${params.observerPeerId} on ${params.targetPeerId}` }], details: { found: false } };
                }
                return { content: [{ type: "text", text: perspective }], details: { found: true, observerPeerId: params.observerPeerId, targetPeerId: params.targetPeerId } };
            }),
        },
    };
}
//# sourceMappingURL=index.js.map