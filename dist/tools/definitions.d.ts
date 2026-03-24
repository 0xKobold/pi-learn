/**
 * Tools Registry - Centralized tool definitions
 * Following DRY: Single source of truth for tool configs
 */
export declare const TOOL_DEFINITIONS: {
    readonly learn_add_message: {
        readonly label: "Add Message";
        readonly description: "Store a message in memory for future reasoning.";
        readonly params: import("@sinclair/typebox").TObject<{
            content: import("@sinclair/typebox").TString;
            role: import("@sinclair/typebox").TString;
        }>;
    };
    readonly learn_get_context: {
        readonly label: "Get Peer Context";
        readonly description: "Retrieve the assembled context for a peer from memory.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_query: {
        readonly label: "Query Memory";
        readonly description: "Search memory for conclusions similar to a query.";
        readonly params: import("@sinclair/typebox").TObject<{
            query: import("@sinclair/typebox").TString;
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            topK: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_reason_now: {
        readonly label: "Trigger Reasoning";
        readonly description: "Immediately process pending messages through the reasoning engine.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_trigger_dream: {
        readonly label: "Trigger Dream";
        readonly description: "Manually trigger a dream cycle for deeper reasoning.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_prune: {
        readonly label: "Prune Old Data";
        readonly description: "Manually trigger retention pruning to delete old data.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_get_peer_card: {
        readonly label: "Get Peer Card";
        readonly description: "Get the biographical information card for a peer.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_update_peer_card: {
        readonly label: "Update Peer Card";
        readonly description: "Manually update the peer card with biographical information.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            name: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            occupation: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            interests: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
            traits: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
            goals: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
        }>;
    };
    readonly learn_list_peers: {
        readonly label: "List Peers";
        readonly description: "List all peers in the current workspace.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_get_stats: {
        readonly label: "Get Memory Stats";
        readonly description: "Get statistics about memory for a peer.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_get_summaries: {
        readonly label: "Get Summaries";
        readonly description: "Get all summaries for a peer.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_search_sessions: {
        readonly label: "Search Sessions";
        readonly description: "Search through session history by keyword.";
        readonly params: import("@sinclair/typebox").TObject<{
            query: import("@sinclair/typebox").TString;
            limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_get_session: {
        readonly label: "Get Session";
        readonly description: "Get details and messages from a specific session.";
        readonly params: import("@sinclair/typebox").TObject<{
            sessionId: import("@sinclair/typebox").TString;
            limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_list_sessions: {
        readonly label: "List Sessions";
        readonly description: "List all sessions in the current workspace.";
        readonly params: import("@sinclair/typebox").TObject<{
            limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_export: {
        readonly label: "Export Memory";
        readonly description: "Export all memory data as JSON for backup.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_import: {
        readonly label: "Import Memory";
        readonly description: "Import memory data from a JSON export.";
        readonly params: import("@sinclair/typebox").TObject<{
            data: import("@sinclair/typebox").TString;
            merge: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        }>;
    };
};
/** Get all tool names */
export declare const getToolNames: () => string[];
/** Get tool definition by name */
export declare const getToolDef: (name: string) => {
    readonly label: "Add Message";
    readonly description: "Store a message in memory for future reasoning.";
    readonly params: import("@sinclair/typebox").TObject<{
        content: import("@sinclair/typebox").TString;
        role: import("@sinclair/typebox").TString;
    }>;
} | {
    readonly label: "Get Peer Context";
    readonly description: "Retrieve the assembled context for a peer from memory.";
    readonly params: import("@sinclair/typebox").TObject<{
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>;
} | {
    readonly label: "Query Memory";
    readonly description: "Search memory for conclusions similar to a query.";
    readonly params: import("@sinclair/typebox").TObject<{
        query: import("@sinclair/typebox").TString;
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        topK: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    }>;
} | {
    readonly label: "Trigger Reasoning";
    readonly description: "Immediately process pending messages through the reasoning engine.";
    readonly params: import("@sinclair/typebox").TObject<{}>;
} | {
    readonly label: "Trigger Dream";
    readonly description: "Manually trigger a dream cycle for deeper reasoning.";
    readonly params: import("@sinclair/typebox").TObject<{}>;
} | {
    readonly label: "Prune Old Data";
    readonly description: "Manually trigger retention pruning to delete old data.";
    readonly params: import("@sinclair/typebox").TObject<{}>;
} | {
    readonly label: "Get Peer Card";
    readonly description: "Get the biographical information card for a peer.";
    readonly params: import("@sinclair/typebox").TObject<{
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>;
} | {
    readonly label: "Update Peer Card";
    readonly description: "Manually update the peer card with biographical information.";
    readonly params: import("@sinclair/typebox").TObject<{
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        name: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        occupation: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        interests: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
        traits: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
        goals: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    }>;
} | {
    readonly label: "List Peers";
    readonly description: "List all peers in the current workspace.";
    readonly params: import("@sinclair/typebox").TObject<{}>;
} | {
    readonly label: "Get Memory Stats";
    readonly description: "Get statistics about memory for a peer.";
    readonly params: import("@sinclair/typebox").TObject<{
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>;
} | {
    readonly label: "Get Summaries";
    readonly description: "Get all summaries for a peer.";
    readonly params: import("@sinclair/typebox").TObject<{
        peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    }>;
} | {
    readonly label: "Search Sessions";
    readonly description: "Search through session history by keyword.";
    readonly params: import("@sinclair/typebox").TObject<{
        query: import("@sinclair/typebox").TString;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    }>;
} | {
    readonly label: "Get Session";
    readonly description: "Get details and messages from a specific session.";
    readonly params: import("@sinclair/typebox").TObject<{
        sessionId: import("@sinclair/typebox").TString;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    }>;
} | {
    readonly label: "List Sessions";
    readonly description: "List all sessions in the current workspace.";
    readonly params: import("@sinclair/typebox").TObject<{
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    }>;
} | {
    readonly label: "Export Memory";
    readonly description: "Export all memory data as JSON for backup.";
    readonly params: import("@sinclair/typebox").TObject<{}>;
} | {
    readonly label: "Import Memory";
    readonly description: "Import memory data from a JSON export.";
    readonly params: import("@sinclair/typebox").TObject<{
        data: import("@sinclair/typebox").TString;
        merge: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    }>;
};
/** Check if tool exists */
export declare const hasTool: (name: string) => boolean;
//# sourceMappingURL=definitions.d.ts.map