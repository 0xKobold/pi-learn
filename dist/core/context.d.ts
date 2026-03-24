/**
 * Context Assembler Module - Memory retrieval and context building
 */
import type { SQLiteStore } from "./store.js";
import type { Conclusion, Summary, MemoryInsights } from "../shared.js";
export declare function createContextAssembler(store: SQLiteStore): ContextAssembler;
export interface MemoryStats {
    conclusionCount: number;
    summaryCount: number;
    hasPeerCard: boolean;
    lastReasonedAt: number | null;
    topInterests: string[];
    topTraits: string[];
}
export declare class ContextAssembler {
    private store;
    constructor(store: SQLiteStore);
    assembleContext(workspaceId: string, peerId: string): string | null;
    searchSimilar(workspaceId: string, peerId: string, query: string, topK?: number, minSimilarity?: number): Promise<Array<Conclusion & {
        confidence: number;
    }>>;
    getConclusionsByType(workspaceId: string, peerId: string, type: Conclusion["type"]): Conclusion[];
    getSummaries(workspaceId: string, peerId: string, limit?: number): Summary[];
    getMemoryStats(workspaceId: string, peerId: string): MemoryStats;
    /**
     * Get comprehensive memory insights about a peer's learning patterns
     */
    getInsights(workspaceId: string, peerId: string): MemoryInsights;
    /**
     * Get perspective-based context: what peer A knows/thinks about peer B
     */
    getPerspective(workspaceId: string, observerPeerId: string, targetPeerId: string): string | null;
    private buildContextString;
}
//# sourceMappingURL=context.d.ts.map