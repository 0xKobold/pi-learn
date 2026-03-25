/**
 * Context Assembler Module - Memory retrieval and context building
 *
 * Supports hybrid architecture:
 * - Local (project) context: workspace-specific memories
 * - Global (user) context: cross-project traits, interests, goals
 */
import type { SQLiteStore } from "./store.js";
import type { Conclusion, Summary, MemoryInsights, PeerCard } from "../shared.js";
export declare function createContextAssembler(store: SQLiteStore): ContextAssembler;
export interface MemoryStats {
    conclusionCount: number;
    summaryCount: number;
    globalConclusionCount: number;
    hasPeerCard: boolean;
    hasGlobalPeerCard: boolean;
    lastReasonedAt: number | null;
    topInterests: string[];
    topTraits: string[];
}
export interface BlendedContext {
    global: {
        peerCard: PeerCard | null;
        conclusions: Conclusion[];
    };
    project: {
        peerCard: PeerCard | null;
        conclusions: Conclusion[];
        summaries: Summary[];
        observations: Array<{
            role: string;
            content: string;
            processed: boolean;
        }>;
    };
    blendedConclusions: Conclusion[];
    assembledString: string;
}
export declare class ContextAssembler {
    private store;
    constructor(store: SQLiteStore);
    /**
     * Get blended context: global (user-scope) + local (project-scope)
     * This is the main method for context assembly
     */
    assembleContext(workspaceId: string, peerId: string): string | null;
    /**
     * Get full blended context with structure
     */
    getBlendedContext(workspaceId: string, peerId: string): BlendedContext;
    /**
     * Get global context only (user-scope from __global__ workspace)
     */
    getGlobalContext(peerId: string): string | null;
    /**
     * Get project-only context (local workspace, project scope)
     */
    getProjectContext(workspaceId: string, peerId: string): string | null;
    /**
     * Search across both local and global contexts
     */
    searchSimilar(workspaceId: string, peerId: string, query: string, topK?: number, minSimilarity?: number, searchGlobal?: boolean): Promise<Array<Conclusion & {
        confidence: number;
        scope: 'user' | 'project';
    }>>;
    getConclusionsByType(workspaceId: string, peerId: string, type: Conclusion["type"], scope?: 'user' | 'project'): Conclusion[];
    getSummaries(workspaceId: string, peerId: string, limit?: number): Summary[];
    getMemoryStats(workspaceId: string, peerId: string): MemoryStats;
    /**
     * Get comprehensive memory insights about a peer's learning patterns
     * Includes both local and global data
     */
    getInsights(workspaceId: string, peerId: string): MemoryInsights;
    /**
     * Get perspective-based context: what peer A knows/thinks about peer B
     */
    getPerspective(workspaceId: string, observerPeerId: string, targetPeerId: string): string | null;
    /**
     * Merge two peer cards, preferring non-null values from the first
     */
    private mergePeerCards;
    /**
     * Build blended context string: global first, then project
     */
    private buildBlendedContextString;
    /**
     * Build global context string only
     */
    private buildGlobalContextString;
    /**
     * Build project-only context string
     */
    private buildProjectContextString;
}
//# sourceMappingURL=context.d.ts.map