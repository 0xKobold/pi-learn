/**
 * Pi-Learn Shared Utilities
 *
 * Common types and utilities for the pi-learn memory system.
 * Uses Ollama for embeddings and reasoning.
 */
export interface Peer {
    id: string;
    name: string;
    type: "user" | "agent" | "entity";
    createdAt: number;
    metadata: Record<string, unknown>;
}
export interface Conclusion {
    id: string;
    peerId: string;
    type: "deductive" | "inductive" | "abductive";
    content: string;
    premises: string[];
    confidence: number;
    createdAt: number;
    sourceSessionId: string;
    embedding?: number[];
}
export interface Summary {
    id: string;
    sessionId: string;
    peerId: string;
    type: "short" | "long";
    content: string;
    messageCount: number;
    createdAt: number;
    embedding?: number[];
}
/**
 * Observation - raw messages stored before reasoning
 * Similar to Honcho's observation system
 */
export interface Observation {
    id: string;
    workspaceId: string;
    peerId: string;
    aboutPeerId?: string;
    sessionId: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
    embedding?: number[];
    processed: boolean;
}
/**
 * Export format for backup/restore
 */
export interface ExportData {
    version: string;
    exportedAt: number;
    workspace: Workspace;
    peers: Peer[];
    conclusions: Conclusion[];
    summaries: Summary[];
    observations: Observation[];
    peerCards: PeerCard[];
}
export interface PeerCard {
    peerId: string;
    name?: string;
    occupation?: string;
    interests: string[];
    traits: string[];
    goals: string[];
    updatedAt: number;
}
export interface Session {
    id: string;
    workspaceId: string;
    peerIds: string[];
    messageCount: number;
    createdAt: number;
    updatedAt: number;
    config: SessionConfig;
    tags: string[];
}
export interface SessionConfig {
    observeMe: boolean;
    observeOthers: boolean;
}
export interface Workspace {
    id: string;
    name: string;
    createdAt: number;
    config: WorkspaceConfig;
}
export interface WorkspaceConfig {
    reasoningEnabled: boolean;
    reasoningModel?: string;
    embeddingModel?: string;
    tokenBatchSize: number;
    retentionDays?: number;
    summaryRetentionDays?: number;
    conclusionRetentionDays?: number;
    dreamingEnabled?: boolean;
    dreamIntervalMs?: number;
}
export interface PeerRepresentation {
    peerId: string;
    conclusions: Conclusion[];
    summaries: Summary[];
    peerCard: PeerCard | null;
    observations: Observation[];
    lastReasonedAt: number;
}
export interface MemoryInsights {
    learningVelocity: number;
    topicDistribution: {
        deductive: number;
        inductive: number;
        abductive: number;
    };
    interestEvolution: Array<{
        interest: string;
        frequency: number;
        trend: "up" | "stable" | "down";
    }>;
    engagementMetrics: {
        totalSessions: number;
        totalMessages: number;
        avgMessagesPerSession: number;
        sessionFrequencyPerWeek: number;
        activeDaysLastWeek: number;
    };
    recentActivity: {
        conclusionsLastWeek: number;
        conclusionsLastMonth: number;
        sessionsLastWeek: number;
    };
}
export interface RetentionConfig {
    retentionDays: number;
    summaryRetentionDays: number;
    conclusionRetentionDays: number;
    pruneOnStartup: boolean;
    pruneIntervalHours: number;
}
export declare const DEFAULT_RETENTION: RetentionConfig;
export interface DreamConfig {
    enabled: boolean;
    intervalMs: number;
    minMessagesSinceLastDream: number;
    batchSize: number;
}
export declare const DEFAULT_DREAM: DreamConfig;
export declare const DEFAULT_TOKEN_BATCH_SIZE = 1000;
export declare const SHORT_SUMMARY_INTERVAL = 20;
export declare const LONG_SUMMARY_INTERVAL = 60;
export declare const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v2-moe:latest";
export declare const DEFAULT_REASONING_MODEL = "qwen3.5:latest";
export interface EmbeddingResult {
    embedding: number[];
    model: string;
}
/**
 * Generate embeddings using Ollama's embedding endpoint
 */
export declare function generateEmbedding(text: string, baseUrl?: string, model?: string): Promise<EmbeddingResult>;
/**
 * Generate embeddings for multiple texts
 */
export declare function generateEmbeddings(texts: string[], baseUrl?: string, model?: string): Promise<EmbeddingResult[]>;
/**
 * Cosine similarity between two vectors
 */
export declare function cosineSimilarity(a: number[], b: number[]): number;
export declare const REASONING_PROMPT = "You are a memory analysis system. Analyze messages and extract insights about the peer.\n\nMessages to analyze:\n{messages}\n\n{existing_context}\n\nProvide your analysis as a JSON object with this structure:\n{\n  \"explicit\": [{\"content\": \"explicit fact stated by peer\"}],\n  \"deductive\": [{\"premises\": [\"premise1\", \"premise2\"], \"conclusion\": \"certain conclusion\"}],\n  \"inductive\": [{\"pattern\": \"pattern observed\", \"evidence\": [\"evidence1\", \"evidence2\"]}],\n  \"abductive\": [{\"observation\": \"what was observed\", \"inference\": \"simplest explanation\", \"simplest\": true}],\n  \"peerCard\": {\"name\": \"name if mentioned\", \"occupation\": \"job if mentioned\", \"interests\": [\"interest1\"], \"traits\": [\"trait1\"], \"goals\": [\"goal1\"]},\n  \"summary\": {\"type\": \"short|long\", \"content\": \"summary of key points\"}\n}\n\nFocus on:\n- Stated facts, preferences, and goals\n- Behavioral patterns\n- Contextual clues about who this person is\n- Inconsistencies or contradictions\n- Topics they care about\n\nRespond ONLY with valid JSON, no additional text.";
/**
 * Dream prompt - for background/creative reasoning
 */
export declare const DREAM_PROMPT = "You are a memory synthesis system. The peer has been conversing with an AI. \n\nRecent messages:\n{messages}\n\nPrevious conclusions:\n{conclusions}\n\nYour task is to \"dream\" - synthesize deeper insights, find connections, and generate new hypotheses about the peer.\n\nProvide your analysis as a JSON object:\n{\n  \"newConclusions\": [{\"type\": \"deductive|inductive|abductive\", \"content\": \"insight\", \"premises\": [\"source1\"], \"confidence\": 0.8}],\n  \"updatedPatterns\": [{\"pattern\": \"observed pattern\", \"evidence\": [\"evidence1\"]}],\n  \"peerCardUpdates\": {\"name\": \"if changed\", \"occupation\": \"if changed\", \"interests\": [], \"traits\": [], \"goals\": []},\n  \"dreamNarrative\": \"Optional: A creative synthesis narrative about who this person might be\"\n}\n\nBe creative and insightful. Look for subtle patterns. Respond ONLY with valid JSON.";
/**
 * Build reasoning prompt with context
 */
export declare function buildReasoningPrompt(messages: Array<{
    role: string;
    content: string;
}>, existingContext?: {
    conclusions?: Conclusion[];
    summary?: string;
    peerCard?: PeerCard;
}): string;
/**
 * Build dream prompt with context
 */
export declare function buildDreamPrompt(messages: Array<{
    role: string;
    content: string;
}>, conclusions: Conclusion[]): string;
export interface ReasoningOutput {
    explicit: Array<{
        content: string;
    }>;
    deductive: Array<{
        premises: string[];
        conclusion: string;
    }>;
    inductive?: Array<{
        pattern: string;
        evidence: string[];
    }>;
    abductive?: Array<{
        observation: string;
        inference: string;
        simplest: boolean;
    }>;
    peerCard?: Partial<PeerCard>;
    summary?: {
        type: "short" | "long";
        content: string;
    };
}
export interface DreamOutput {
    newConclusions: Array<{
        type: "deductive" | "inductive" | "abductive";
        content: string;
        premises: string[];
        confidence: number;
    }>;
    updatedPatterns?: Array<{
        pattern: string;
        evidence: string[];
    }>;
    peerCardUpdates?: Partial<PeerCard>;
    dreamNarrative?: string;
}
/**
 * Parse reasoning output from JSON
 */
export declare function parseReasoningOutput(output: string): ReasoningOutput;
/**
 * Parse dream output from JSON
 */
export declare function parseDreamOutput(output: string): DreamOutput;
/**
 * Estimate token count (rough: ~4 chars per token)
 */
export declare function estimateTokens(text: string): number;
/**
 * Estimate tokens for messages
 */
export declare function estimateMessagesTokens(messages: Array<{
    role: string;
    content: string;
}>): number;
/**
 * Split messages into batches by token count
 */
export declare function batchByTokens(messages: Array<{
    role: string;
    content: string;
}>, maxTokens?: number): Array<Array<{
    role: string;
    content: string;
}>>;
/**
 * Generate a unique ID
 */
export declare function generateId(prefix?: string): string;
//# sourceMappingURL=shared.d.ts.map