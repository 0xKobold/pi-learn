/**
 * Tools Registry - Centralized tool definitions
 * Following DRY: Single source of truth for tool configs
 */
import { Type } from "@sinclair/typebox";
// ============================================================================
// TOOL DEFINITIONS (DRY - single source of truth)
// ============================================================================
export const TOOL_DEFINITIONS = {
    // Memory management
    learn_add_message: {
        label: "Add Message",
        description: "Store a message in memory for future reasoning.",
        params: Type.Object({
            content: Type.String({ description: "The message content to store" }),
            role: Type.String({ description: "Role of the message sender (user, assistant)" }),
        }),
    },
    learn_get_context: {
        label: "Get Peer Context",
        description: "Retrieve the assembled context for a peer from memory.",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
        }),
    },
    learn_query: {
        label: "Query Memory",
        description: "Search memory for conclusions similar to a query.",
        params: Type.Object({
            query: Type.String({ description: "Search query" }),
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
            topK: Type.Optional(Type.Integer({ description: "Number of results (default 5)" })),
        }),
    },
    learn_reason_now: {
        label: "Trigger Reasoning",
        description: "Immediately process pending messages through the reasoning engine.",
        params: Type.Object({}),
    },
    learn_trigger_dream: {
        label: "Trigger Dream",
        description: "Manually trigger a dream cycle for deeper reasoning.",
        params: Type.Object({}),
    },
    learn_prune: {
        label: "Prune Old Data",
        description: "Manually trigger retention pruning to delete old data.",
        params: Type.Object({}),
    },
    // Peer management
    learn_get_peer_card: {
        label: "Get Peer Card",
        description: "Get the biographical information card for a peer.",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
        }),
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
    learn_list_peers: {
        label: "List Peers",
        description: "List all peers in the current workspace.",
        params: Type.Object({}),
    },
    learn_get_stats: {
        label: "Get Memory Stats",
        description: "Get statistics about memory for a peer.",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
        }),
    },
    // Summaries
    learn_get_summaries: {
        label: "Get Summaries",
        description: "Get all summaries for a peer.",
        params: Type.Object({
            peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
            limit: Type.Optional(Type.Integer({ description: "Max summaries to return (default 10)" })),
        }),
    },
    // Session management
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
        params: Type.Object({
            limit: Type.Optional(Type.Integer({ description: "Max sessions (default 20)" })),
        }),
    },
    // Export/Import
    learn_export: {
        label: "Export Memory",
        description: "Export all memory data as JSON for backup.",
        params: Type.Object({}),
    },
    learn_import: {
        label: "Import Memory",
        description: "Import memory data from a JSON export.",
        params: Type.Object({
            data: Type.String({ description: "JSON export data" }),
            merge: Type.Optional(Type.Boolean({ description: "Merge with existing data (default: true)" })),
        }),
    },
};
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get all tool names */
export const getToolNames = () => Object.keys(TOOL_DEFINITIONS);
/** Get tool definition by name */
export const getToolDef = (name) => TOOL_DEFINITIONS[name];
/** Check if tool exists */
export const hasTool = (name) => name in TOOL_DEFINITIONS;
//# sourceMappingURL=definitions.js.map