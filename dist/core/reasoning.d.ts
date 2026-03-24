/**
 * Reasoning Engine Module - LLM-based reasoning for pi-learn
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
    reason(messages: Array<{
        role: string;
        content: string;
    }>, _peerId: string): Promise<ReasoningOutput>;
    dream(messages: Array<{
        role: string;
        content: string;
    }>, existingConclusions: Conclusion[]): Promise<DreamOutput>;
    /**
     * Call Ollama chat endpoint with proper format for Ollama API
     */
    private callOllamaChat;
    private processQueue;
    private callOllama;
    private sleep;
    private buildReasoningPrompt;
    private parseReasoningOutput;
    private buildDreamPrompt;
    private parseDreamOutput;
}
//# sourceMappingURL=reasoning.d.ts.map