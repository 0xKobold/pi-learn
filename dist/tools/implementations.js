/**
 * Tool Implementations - Execute functions for pi-learn tools
 * Following KISS: Each tool is a pure function
 */
import { createPeerCardRenderer, createStatsRenderer, createSearchResultsRenderer, createSessionListRenderer } from "../renderers.js";
// ============================================================================
// TOOL FACTORY
// ============================================================================
export function createToolImplementations(deps) {
    const { store, contextAssembler, reasoningEngine, config, runRetention, queue, runDream } = deps;
    return {
        // ========================================================================
        // MEMORY OPERATIONS
        // ========================================================================
        learn_add_message: {
            async execute(_, params, ctx) {
                const sessionFile = ctx.sessionManager.getSessionFile();
                if (!sessionFile) {
                    return { content: [{ type: "text", text: "No active session" }], details: { error: "No active session" } };
                }
                queue({ sessionFile, peerId: params.role === "assistant" ? "agent" : params.role, messages: [{ role: params.role, content: params.content }], queuedAt: Date.now() });
                return { content: [{ type: "text", text: "Message queued for reasoning" }], details: { queued: true } };
            },
        },
        learn_get_context: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const context = contextAssembler.assembleContext(config.workspaceId, peerId);
                if (!context) {
                    return { content: [{ type: "text", text: `No context found for peer: ${peerId}` }], details: { found: false } };
                }
                return { content: [{ type: "text", text: context }], details: { found: true, peerId } };
            },
        },
        learn_query: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const topK = params.topK || 5;
                try {
                    const results = await contextAssembler.searchSimilar(config.workspaceId, peerId, params.query, topK);
                    if (results.length === 0) {
                        return { content: [{ type: "text", text: `No results found for: ${params.query}` }], details: { found: false } };
                    }
                    const text = results.map((r, i) => `${i + 1}. [${r.type}] ${r.content} (${(r.confidence * 100).toFixed(0)}% confidence)`).join("\n");
                    return { content: [{ type: "text", text }], details: { found: true, count: results.length } };
                }
                catch (error) {
                    return { content: [{ type: "text", text: `Query failed: ${error}` }], details: { error: String(error) } };
                }
            },
        },
        learn_reason_now: {
            async execute(_, __, ctx) {
                ctx.ui.setStatus("learn", "Reasoning...");
                const stats = contextAssembler.getMemoryStats(config.workspaceId, "user");
                return { content: [{ type: "text", text: `Reasoning complete. ${stats.conclusionCount} conclusions, ${stats.summaryCount} summaries.` }], details: stats };
            },
        },
        learn_trigger_dream: {
            async execute(_, __, ctx) {
                ctx.ui.setStatus("learn", "Dreaming...");
                await runDream();
                ctx.ui.setStatus("learn", `Dreamed: ${new Date().toLocaleTimeString()}`);
                return { content: [{ type: "text", text: "Dream cycle complete" }], details: { success: true } };
            },
        },
        learn_prune: {
            async execute(_) {
                const result = runRetention();
                return { content: [{ type: "text", text: `Pruned ${result.deleted} old records` }], details: result };
            },
        },
        // ========================================================================
        // PEER MANAGEMENT
        // ========================================================================
        learn_get_peer_card: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const card = store.getPeerCard(config.workspaceId, peerId);
                if (!card) {
                    return { content: [{ type: "text", text: `No peer card found for: ${peerId}` }], details: { found: false, peerId } };
                }
                return {
                    content: [{ type: "text", text: `## Peer Card\n\nName: ${card.name || 'N/A'}\nOccupation: ${card.occupation || 'N/A'}\nInterests: ${card.interests?.join(", ") || 'None'}` }],
                    details: { found: true, peerId, card: { name: card.name, occupation: card.occupation, interests: card.interests, traits: card.traits, goals: card.goals } },
                };
            },
            renderResult(result, _opts, theme) {
                if (!result.details?.card)
                    return { render: () => ["No peer card found"] };
                return createPeerCardRenderer(result.details.card, theme);
            },
        },
        learn_update_peer_card: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const existing = store.getPeerCard(config.workspaceId, peerId);
                const updated = {
                    peerId,
                    name: params.name ?? existing?.name,
                    occupation: params.occupation ?? existing?.occupation,
                    interests: params.interests ?? existing?.interests ?? [],
                    traits: params.traits ?? existing?.traits ?? [],
                    goals: params.goals ?? existing?.goals ?? [],
                    updatedAt: Date.now(),
                };
                store.savePeerCard(config.workspaceId, updated);
                return { content: [{ type: "text", text: `Peer card updated for: ${peerId}` }], details: { success: true } };
            },
        },
        learn_list_peers: {
            async execute(_) {
                const peers = store.getAllPeers(config.workspaceId);
                const text = peers.map((p, i) => `${i + 1}. ${p.name} (${p.type})`).join("\n") || "No peers found";
                return { content: [{ type: "text", text: `## Peers\n\n${text}` }], details: { count: peers.length } };
            },
        },
        learn_get_stats: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const stats = contextAssembler.getMemoryStats(config.workspaceId, peerId);
                return { content: [{ type: "text", text: `Stats for ${peerId}: ${stats.conclusionCount} conclusions` }], details: stats };
            },
            renderResult(result, _opts, theme) {
                if (!result.details)
                    return { render: () => ["No stats available"] };
                return createStatsRenderer(result.details, theme);
            },
        },
        // ========================================================================
        // SUMMARIES
        // ========================================================================
        learn_get_summaries: {
            async execute(_, params) {
                const peerId = params.peerId || "user";
                const summaries = store.getSummaries(config.workspaceId, peerId, params.limit || 10);
                if (summaries.length === 0) {
                    return { content: [{ type: "text", text: `No summaries found for: ${peerId}` }], details: { count: 0 } };
                }
                const text = summaries.map((s, i) => `### ${i + 1}. [${s.type}] ${s.content}`).join("\n\n");
                return { content: [{ type: "text", text: `## Summaries for ${peerId}\n\n${text}` }], details: { count: summaries.length } };
            },
        },
        // ========================================================================
        // SESSION MANAGEMENT
        // ========================================================================
        learn_search_sessions: {
            async execute(_, params) {
                const limit = params.limit || 10;
                const results = store.searchSessions(config.workspaceId, params.query, limit);
                if (results.length === 0) {
                    return { content: [{ type: "text", text: `No sessions found matching: ${params.query}` }], details: { found: false, query: params.query, results: [] } };
                }
                const text = results.map((r, i) => `${i + 1}. [${new Date(r.createdAt).toLocaleDateString()}] ${r.sessionId}\n   "${r.snippet}"`).join("\n\n");
                return { content: [{ type: "text", text: `## Search Results\n\n${text}` }], details: { found: true, query: params.query, count: results.length, results } };
            },
            renderResult(result, _opts, theme) {
                if (!result.details?.results?.length)
                    return { render: () => ["No results found"] };
                return createSearchResultsRenderer(result.details.results, result.details.query || "", theme);
            },
        },
        learn_get_session: {
            async execute(_, params) {
                const session = store.getSession(config.workspaceId, params.sessionId);
                if (!session) {
                    return { content: [{ type: "text", text: `Session not found: ${params.sessionId}` }], details: { found: false } };
                }
                const messages = store.getMessages(config.workspaceId, params.sessionId, params.limit || 50);
                const text = messages.map((m) => `[${m.role}] ${m.content}`).join("\n");
                return { content: [{ type: "text", text: `## Session: ${session.id}\n\n${text}` }], details: { found: true, sessionId: session.id, messageCount: messages.length } };
            },
        },
        learn_list_sessions: {
            async execute(_, params) {
                const sessions = store.getAllSessions(config.workspaceId);
                const limited = sessions.slice(0, params.limit || 20);
                if (limited.length === 0) {
                    return { content: [{ type: "text", text: "No sessions found" }], details: { count: 0, sessions: [] } };
                }
                const text = limited.map((s, i) => `${i + 1}. ${s.id}\n   Created: ${new Date(s.createdAt).toLocaleDateString()}`).join("\n");
                return { content: [{ type: "text", text: `## Sessions (${sessions.length} total)\n\n${text}` }], details: { count: sessions.length, sessions: limited } };
            },
            renderResult(result, _opts, theme) {
                if (!result.details?.sessions?.length)
                    return { render: () => ["No sessions found"] };
                return createSessionListRenderer(result.details.sessions, theme);
            },
        },
        // ========================================================================
        // EXPORT / IMPORT
        // ========================================================================
        learn_export: {
            async execute(_) {
                const exportData = store.exportAll(config.workspaceId);
                return {
                    content: [{ type: "text", text: `Exported ${exportData.conclusions.length} conclusions, ${exportData.summaries.length} summaries` }],
                    details: exportData,
                };
            },
        },
        learn_import: {
            async execute(_, params) {
                try {
                    const data = JSON.parse(params.data);
                    store.importAll(config.workspaceId, data, params.merge ?? true);
                    return {
                        content: [{ type: "text", text: `Imported ${data.conclusions?.length || 0} conclusions` }],
                        details: { success: true },
                    };
                }
                catch (error) {
                    return { content: [{ type: "text", text: `Import failed: ${error}` }], details: { success: false, error: String(error) } };
                }
            },
        },
    };
}
//# sourceMappingURL=implementations.js.map