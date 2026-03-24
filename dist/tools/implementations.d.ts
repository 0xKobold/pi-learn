/**
 * Tool Implementations - Execute functions for pi-learn tools
 * Following KISS: Each tool is a pure function
 */
import type { SQLiteStore } from "../core/store.js";
import type { ContextAssembler } from "../core/context.js";
import type { ReasoningEngine } from "../core/reasoning.js";
import type { Component } from "@mariozechner/pi-tui";
import type { LearnConfig } from "../shared.js";
export declare function createToolImplementations(deps: {
    store: SQLiteStore;
    contextAssembler: ContextAssembler;
    reasoningEngine: ReasoningEngine;
    config: LearnConfig;
    runRetention: () => {
        deleted: number;
    };
    queue: (item: any) => void;
    runDream: () => Promise<void>;
}): {
    learn_add_message: {
        execute(_: any, params: {
            content: string;
            role: string;
        }, ctx: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                error: string;
                queued?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                queued: boolean;
                error?: undefined;
            };
        }>;
    };
    learn_get_context: {
        execute(_: any, params: {
            peerId?: string;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                peerId?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                peerId: string;
            };
        }>;
    };
    learn_query: {
        execute(_: any, params: {
            query: string;
            peerId?: string;
            topK?: number;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                count?: undefined;
                error?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                count: number;
                error?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                error: string;
                found?: undefined;
                count?: undefined;
            };
        }>;
    };
    learn_reason_now: {
        execute(_: any, __: any, ctx: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                conclusionCount: number;
                summaryCount: number;
                hasPeerCard: boolean;
                lastReasonedAt: number | null;
                topInterests: string[];
                topTraits: string[];
            };
        }>;
    };
    learn_trigger_dream: {
        execute(_: any, __: any, ctx: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                success: boolean;
            };
        }>;
    };
    learn_prune: {
        execute(_: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                deleted: number;
            };
        }>;
    };
    learn_get_peer_card: {
        execute(_: any, params: {
            peerId?: string;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                peerId: string;
                card?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                peerId: string;
                card: {
                    name: string | undefined;
                    occupation: string | undefined;
                    interests: string[];
                    traits: string[];
                    goals: string[];
                };
            };
        }>;
        renderResult(result: any, _opts: any, theme: any): Component;
    };
    learn_update_peer_card: {
        execute(_: any, params: {
            peerId?: string;
            name?: string;
            occupation?: string;
            interests?: string[];
            traits?: string[];
            goals?: string[];
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                success: boolean;
            };
        }>;
    };
    learn_list_peers: {
        execute(_: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                count: number;
            };
        }>;
    };
    learn_get_stats: {
        execute(_: any, params: {
            peerId?: string;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                conclusionCount: number;
                summaryCount: number;
                hasPeerCard: boolean;
                lastReasonedAt: number | null;
                topInterests: string[];
                topTraits: string[];
            };
        }>;
        renderResult(result: any, _opts: any, theme: any): Component;
    };
    learn_get_summaries: {
        execute(_: any, params: {
            peerId?: string;
            limit?: number;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                count: number;
            };
        }>;
    };
    learn_search_sessions: {
        execute(_: any, params: {
            query: string;
            limit?: number;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                query: string;
                results: never[];
                count?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                query: string;
                count: number;
                results: {
                    sessionId: string;
                    createdAt: number;
                    snippet: string;
                    relevance: number;
                }[];
            };
        }>;
        renderResult(result: any, _opts: any, theme: any): Component;
    };
    learn_get_session: {
        execute(_: any, params: {
            sessionId: string;
            limit?: number;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                sessionId?: undefined;
                messageCount?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                found: boolean;
                sessionId: string;
                messageCount: number;
            };
        }>;
    };
    learn_list_sessions: {
        execute(_: any, params: {
            limit?: number;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                count: number;
                sessions: import("../shared.js").Session[];
            };
        }>;
        renderResult(result: any, _opts: any, theme: any): Component;
    };
    learn_export: {
        execute(_: any): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: import("../shared.js").ExportData;
        }>;
    };
    learn_import: {
        execute(_: any, params: {
            data: string;
            merge?: boolean;
        }): Promise<{
            content: {
                type: string;
                text: string;
            }[];
            details: {
                success: boolean;
                error?: undefined;
            };
        } | {
            content: {
                type: string;
                text: string;
            }[];
            details: {
                success: boolean;
                error: string;
            };
        }>;
    };
};
//# sourceMappingURL=implementations.d.ts.map