/**
 * Reasoning Engine Module - LLM-based reasoning for pi-learn
 *
 * Supports hybrid scope:
 * - 'user' scope: Cross-project insights (traits, interests, goals)
 * - 'project' scope: Project-specific insights (code patterns, decisions)
 */
import type { Conclusion, ReasoningOutput, DreamOutput } from "../shared.js";
export interface ReasoningEngineConfig {
    ollamaBaseUrl: string;
    ollamaApiKey: string;
    reasoningModel: string;
    embeddingModel: string;
    tokenBatchSize: number;
    retry?: Partial<RetryConfig>;
}
export interface RetryConfig {
    maxRetries: number;
    retryDelayMs: number;
    timeoutMs: number;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare function createReasoningEngine(config: ReasoningEngineConfig): ReasoningEngine;
export interface ReasoningContext {
    globalConclusions?: Conclusion[];
    localConclusions?: Conclusion[];
    globalPeerCard?: {
        name?: string;
        occupation?: string;
        interests: string[];
        traits: string[];
        goals: string[];
    };
}
export declare class ReasoningEngine {
    private config;
    private messageQueue;
    private isProcessing;
    private maxRetries;
    private retryDelayMs;
    private timeoutMs;
    private lastProcessedAt;
    constructor(config: ReasoningEngineConfig);
    queue(item: {
        sessionFile: string;
        peerId: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
        queuedAt: number;
    }): void;
    getQueueSize(): number;
    isReasoning(): boolean;
    generateEmbedding(text: string): Promise<number[]>;
    /**
     * Reason about messages with optional context
     * @param messages Messages to reason about
     * @param _peerId Peer ID (unused, context determines scope)
     * @param context Optional context for informed reasoning
     */
    reason(messages: Array<{
        role: string;
        content: string;
    }>, _peerId: string, context?: ReasoningContext): Promise<ReasoningOutput>;
    /**
     * Dream - consolidate memories with scope classification
     * @param messages Recent messages
     * @param existingConclusions Existing conclusions (can be mixed scope)
     * @param context Optional context for informed dreaming
     */
    dream(messages: Array<{
        role: string;
        content: string;
    }>, existingConclusions: Conclusion[], context?: ReasoningContext): Promise<DreamOutput>;
    /**
     * Call Ollama chat endpoint with proper format for Ollama API
     */
    private callOllamaChat;
    private processQueue;
    private callOllama;
    private sleep;
    /**
     * Build reasoning prompt with scope classification guidance
     */
    private buildReasoningPrompt;
    /**
     * Parse reasoning output with scope classification
     */
    private parseReasoningOutput;
    /**
     * Build dream prompt with scope classification
     */
    private buildDreamPrompt;
    /**
     * Parse dream output with scope classification
     */
    private parseDreamOutput;
}
//# sourceMappingURL=reasoning.d.ts.map