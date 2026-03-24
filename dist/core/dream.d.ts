/**
 * Dream Scheduler - Background memory consolidation
 */
import type { SQLiteStore } from "./store.js";
import type { ReasoningEngine } from "./reasoning.js";
export declare function createDreamScheduler(store: SQLiteStore, reasoningEngine: ReasoningEngine, config: DreamSchedulerConfig): DreamScheduler;
export interface DreamSchedulerConfig {
    enabled: boolean;
    intervalMs: number;
    minMessagesSinceLastDream: number;
    batchSize: number;
}
export declare class DreamScheduler {
    private store;
    private reasoningEngine;
    private config;
    private intervalHandle?;
    private lastDreamAt;
    constructor(store: SQLiteStore, reasoningEngine: ReasoningEngine, config: DreamSchedulerConfig);
    /** Start the dream scheduler */
    start(workspaceId: string): void;
    /** Stop the dream scheduler */
    stop(): void;
    /** Run a dream cycle */
    runDream(workspaceId: string): Promise<void>;
}
//# sourceMappingURL=dream.d.ts.map