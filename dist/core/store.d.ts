/**
 * SQLite Store Module - Database operations for pi-learn
 * Uses sql.js (WebAssembly SQLite) for cross-runtime compatibility
 */
import type { Workspace, Peer, Session, Conclusion, Summary, PeerCard, Observation, PeerRepresentation, ExportData } from "../shared.js";
export declare function createStore(dbPath: string): Promise<SQLiteStore>;
export declare class SQLiteStore {
    private db;
    private dbPath;
    private saveTimer;
    constructor(dbPath: string);
    init(): Promise<void>;
    private scheduleSave;
    private saveToDisk;
    private run;
    private exec;
    private prepare;
    private getOne;
    private getAll;
    private initTables;
    private migrate;
    /**
     * Verify database schema integrity and fix any issues.
     * This ensures all required columns and indexes exist even if migrations
     * were skipped or failed in previous runs.
     */
    private verifyAndFixSchema;
    getWorkspace(id: string): Workspace | null;
    saveWorkspace(workspace: Workspace): void;
    getPeer(workspaceId: string, peerId: string): Peer | null;
    savePeer(workspaceId: string, peer: Peer): void;
    getAllPeers(workspaceId: string): Peer[];
    getSession(workspaceId: string, sessionId: string): Session | null;
    saveSession(workspaceId: string, session: Session): void;
    getAllSessions(workspaceId: string): Session[];
    tagSession(workspaceId: string, sessionId: string, tags: string[]): void;
    untagSession(workspaceId: string, sessionId: string, tags: string[]): void;
    getSessionsByTag(workspaceId: string, tag: string, limit?: number): Session[];
    getAllTags(workspaceId: string): Array<{
        tag: string;
        count: number;
    }>;
    saveMessage(workspaceId: string, message: {
        id: string;
        sessionId: string;
        peerId: string;
        role: string;
        content: string;
        createdAt: number;
        metadata?: Record<string, unknown>;
    }): void;
    saveMessagesBatch(workspaceId: string, messages: Array<{
        id: string;
        sessionId: string;
        peerId: string;
        role: string;
        content: string;
        createdAt: number;
        metadata?: Record<string, unknown>;
    }>): number;
    getMessages(workspaceId: string, sessionId: string, limit?: number): any[];
    getRecentMessages(workspaceId: string, peerId: string, limit?: number): any[];
    saveConclusion(workspaceId: string, conclusion: Conclusion): void;
    getConclusions(workspaceId: string, peerId: string, limit?: number): Conclusion[];
    getAllConclusions(workspaceId: string, peerId?: string): Conclusion[];
    saveSummary(workspaceId: string, summary: Summary): void;
    getSummaries(workspaceId: string, peerId: string, limit?: number): Summary[];
    getPeerCard(workspaceId: string, peerId: string): PeerCard | null;
    savePeerCard(workspaceId: string, card: PeerCard): void;
    saveObservation(observation: Observation): void;
    addObservation: (observation: Observation) => void;
    getObservations(workspaceId: string, peerId: string, limit?: number): Observation[];
    getObservationsForPeer(workspaceId: string, observerPeerId: string, limit?: number): Observation[];
    getObservationsAboutPeer(workspaceId: string, targetPeerId: string, limit?: number): Observation[];
    getUnprocessedObservations(workspaceId: string, peerId: string, limit?: number): Observation[];
    markObservationsProcessed(observationIds: string[]): void;
    searchObservations(workspaceId: string, peerId: string, query: string, limit?: number): Array<Observation & {
        relevance: number;
    }>;
    searchObservationsByEmbedding(workspaceId: string, peerId: string, queryEmbedding: number[], limit?: number): Array<Observation & {
        relevance: number;
    }>;
    getRepresentation(workspaceId: string, peerId: string): PeerRepresentation | null;
    searchSessions(workspaceId: string, query: string, limit?: number): Array<{
        sessionId: string;
        createdAt: number;
        snippet: string;
        relevance: number;
    }>;
    prune(retentionDays: number, summaryRetentionDays: number, conclusionRetentionDays: number): {
        deleted: number;
    };
    exportAll(workspaceId: string): ExportData;
    importAll(workspaceId: string, data: ExportData, merge?: boolean): void;
    getOrCreateWorkspace(id: string, name?: string): Workspace;
    getOrCreatePeer(workspaceId: string, id: string, name: string, type?: Peer["type"]): Peer;
    getOrCreateSession(workspaceId: string, id: string, peerIds?: string[]): Session;
    close(): void;
}
//# sourceMappingURL=store.d.ts.map