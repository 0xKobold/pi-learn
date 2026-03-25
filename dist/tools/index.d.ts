/**
 * Tools Module - Tool definitions and implementations
 */
import type { Component } from "@mariozechner/pi-tui";
import type { SQLiteStore } from "../core/store.js";
import type { ContextAssembler } from "../core/context.js";
import type { ReasoningEngine } from "../core/reasoning.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-coding-agent";
export interface ToolsConfig {
    workspaceId: string;
    retention: {
        retentionDays: number;
        summaryRetentionDays: number;
        conclusionRetentionDays: number;
    };
    dream: {
        enabled: boolean;
        intervalMs: number;
        batchSize: number;
        minMessagesSinceLastDream: number;
    };
}
export declare const TOOLS: {
    readonly learn_add_message: {
        readonly label: "Add Message";
        readonly description: "Store a message in memory for future reasoning.";
        readonly params: import("@sinclair/typebox").TObject<{
            content: import("@sinclair/typebox").TString;
            role: import("@sinclair/typebox").TString;
        }>;
    };
    readonly learn_add_messages_batch: {
        readonly label: "Add Messages Batch";
        readonly description: "Store multiple messages in a single batch operation. Efficient for bulk ingestion.";
        readonly params: import("@sinclair/typebox").TObject<{
            messages: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
                content: import("@sinclair/typebox").TString;
                role: import("@sinclair/typebox").TString;
                sessionId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
                metadata: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TAny>>;
            }>>;
        }>;
    };
    readonly learn_add_observation: {
        readonly label: "Add Observation";
        readonly description: "Store a raw observation/message for later processing. Observations are stored before reasoning extracts insights.";
        readonly params: import("@sinclair/typebox").TObject<{
            content: import("@sinclair/typebox").TString;
            role: import("@sinclair/typebox").TString;
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            sessionId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_get_context: {
        readonly label: "Get Peer Context";
        readonly description: "Retrieve the blended context for a peer (global user profile + project memories).";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            scope: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_get_global_context: {
        readonly label: "Get Global Context";
        readonly description: "Retrieve cross-project context (user traits, interests, goals) shared across all projects.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_get_project_context: {
        readonly label: "Get Project Context";
        readonly description: "Retrieve project-specific context (local to current workspace).";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            workspaceId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_query: {
        readonly label: "Query Memory";
        readonly description: "Search memory for conclusions similar to a query.";
        readonly params: import("@sinclair/typebox").TObject<{
            query: import("@sinclair/typebox").TString;
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            topK: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
            minSimilarity: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
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
        readonly params: import("@sinclair/typebox").TObject<{
            scope: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
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
    readonly learn_get_insights: {
        readonly label: "Get Memory Insights";
        readonly description: "Get comprehensive insights about learning patterns, topic distribution, and engagement metrics.";
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
    readonly learn_tag_session: {
        readonly label: "Tag Session";
        readonly description: "Add or remove tags from a session for categorization.";
        readonly params: import("@sinclair/typebox").TObject<{
            sessionId: import("@sinclair/typebox").TString;
            addTags: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
            removeTags: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
        }>;
    };
    readonly learn_get_sessions_by_tag: {
        readonly label: "Get Sessions By Tag";
        readonly description: "Get all sessions with a specific tag.";
        readonly params: import("@sinclair/typebox").TObject<{
            tag: import("@sinclair/typebox").TString;
            limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        }>;
    };
    readonly learn_list_tags: {
        readonly label: "List All Tags";
        readonly description: "List all unique tags across sessions with their counts.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
    };
    readonly learn_get_dream_status: {
        readonly label: "Get Dream Status";
        readonly description: "Get information about the dreaming system - when it last ran, next scheduled dream, and statistics.";
        readonly params: import("@sinclair/typebox").TObject<{}>;
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
    readonly learn_observe_peer: {
        readonly label: "Observe Peer";
        readonly description: "Record an observation about another peer (cross-peer). Used for perspective-taking.";
        readonly params: import("@sinclair/typebox").TObject<{
            aboutPeerId: import("@sinclair/typebox").TString;
            content: import("@sinclair/typebox").TString;
            sessionId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_get_perspective: {
        readonly label: "Get Perspective";
        readonly description: "Get context from a specific peer's perspective - what they know about another peer.";
        readonly params: import("@sinclair/typebox").TObject<{
            observerPeerId: import("@sinclair/typebox").TString;
            targetPeerId: import("@sinclair/typebox").TString;
        }>;
    };
    readonly learn_test_hybrid: {
        readonly label: "Test Hybrid Memory";
        readonly description: "Debug tool that outputs structured info about both global and project scopes. Useful for testing the hybrid architecture.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
    readonly learn_count_by_scope: {
        readonly label: "Count Conclusions By Scope";
        readonly description: "Show conclusion counts broken down by scope (user/project) for both global and project workspaces.";
        readonly params: import("@sinclair/typebox").TObject<{
            peerId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        }>;
    };
};
export declare function createToolExecutors(deps: {
    store: SQLiteStore;
    contextAssembler: ContextAssembler;
    reasoningEngine: ReasoningEngine;
    config: ToolsConfig;
    runDream: (scope?: 'user' | 'project') => Promise<void>;
}): {
    learn_add_message: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_add_messages_batch: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_add_observation: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_context: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_global_context: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_project_context: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_query: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_reason_now: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_trigger_dream: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_prune: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_peer_card: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
        renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any) => Component;
    };
    learn_update_peer_card: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_list_peers: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_stats: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
        renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any) => Component;
    };
    learn_get_insights: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_summaries: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_search_sessions: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
        renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any) => Component;
    };
    learn_get_session: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_list_sessions: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
        renderResult: (result: AgentToolResult<unknown>, _options: any, theme: any) => Component;
    };
    learn_tag_session: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_sessions_by_tag: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_list_tags: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_dream_status: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_export: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_import: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_observe_peer: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_get_perspective: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_test_hybrid: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
    learn_count_by_scope: {
        execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    };
};
//# sourceMappingURL=index.d.ts.map