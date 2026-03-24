/**
 * Reasoning Engine Module - LLM-based reasoning for pi-learn
 */
export const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 2000,
    timeoutMs: 120000,
};
export function createReasoningEngine(config) {
    return new ReasoningEngine(config);
}
export class ReasoningEngine {
    config;
    messageQueue = [];
    isProcessing = false;
    maxRetries;
    retryDelayMs;
    timeoutMs;
    lastProcessedAt = 0;
    constructor(config) {
        this.config = config;
        const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
        this.maxRetries = retryConfig.maxRetries;
        this.retryDelayMs = retryConfig.retryDelayMs;
        this.timeoutMs = retryConfig.timeoutMs;
    }
    queue(item) {
        this.messageQueue.push(item);
        // Process if we have enough items OR if items have been waiting too long (30 seconds)
        const oldestWaitMs = Date.now() - this.messageQueue[0]?.queuedAt;
        const shouldProcess = this.messageQueue.length >= 3 || // Batch when we have 3+ items
            oldestWaitMs > 30000 || // Or if oldest item waiting > 30s
            !this.isProcessing; // Or if not currently processing
        if (shouldProcess && !this.isProcessing) {
            // Use setImmediate to avoid blocking
            setImmediate(() => this.processQueue());
        }
    }
    getQueueSize() { return this.messageQueue.length; }
    isReasoning() { return this.isProcessing; }
    async generateEmbedding(text) {
        const response = await this.callOllama("/api/embeddings", { model: this.config.embeddingModel, prompt: text });
        return response.embedding;
    }
    async reason(messages, _peerId) {
        const prompt = this.buildReasoningPrompt(messages);
        const content = await this.callOllamaChat(prompt);
        return this.parseReasoningOutput(content);
    }
    async dream(messages, existingConclusions) {
        const prompt = this.buildDreamPrompt(messages, existingConclusions);
        const content = await this.callOllamaChat(prompt);
        return this.parseDreamOutput(content);
    }
    /**
     * Call Ollama chat endpoint with proper format for Ollama API
     */
    async callOllamaChat(prompt) {
        const response = await this.callOllama("/api/chat", {
            model: this.config.reasoningModel,
            messages: [{ role: "user", content: prompt }],
            stream: false, // Disable streaming to get complete response
        });
        // Support both Ollama format (message.content) and OpenAI format (choices[0].message.content)
        return response.message?.content ?? response.choices?.[0]?.message?.content ?? "";
    }
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0)
            return;
        this.isProcessing = true;
        try {
            // Process all items in the queue continuously
            while (this.messageQueue.length > 0) {
                const item = this.messageQueue.shift();
                try {
                    await this.reason(item.messages, item.peerId);
                }
                catch (error) {
                    console.error(`[ReasoningEngine] Failed to process queued item: ${error}`);
                    // Continue with next item rather than stopping the entire queue
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    async callOllama(endpoint, body) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
                try {
                    const response = await fetch(`${this.config.ollamaBaseUrl}${endpoint}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...(this.config.ollamaApiKey && { Authorization: `Bearer ${this.config.ollamaApiKey}` }) },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });
                    if (!response.ok) {
                        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                }
                finally {
                    clearTimeout(timeoutId);
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.maxRetries) {
                    console.warn(`[ReasoningEngine] Attempt ${attempt} failed: ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`);
                    await this.sleep(this.retryDelayMs);
                }
            }
        }
        throw new Error(`[ReasoningEngine] All ${this.maxRetries} attempts failed. Last error: ${lastError?.message}`);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    buildReasoningPrompt(messages) {
        const formatted = messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n");
        return `You are analyzing conversation messages to extract key conclusions about the user.\n\nMessages:\n${formatted}\n\nBased on these messages, extract 1-3 key conclusions about the user. Format your response as:\n\nCONCLUSION: <type>\nType: deductive, inductive, or abductive\nContent: <what you concluded>\nPremises: <what led to this conclusion>\nConfidence: <0.0-1.0>\n\nConclusion types:\n- deductive: Logical certainty\n- inductive: Probable inference\n- abductive: Best explanation`;
    }
    parseReasoningOutput(text) {
        const explicit = [];
        const deductive = [];
        const blocks = text.split(/CONCLUSION:/).filter(Boolean);
        for (const block of blocks) {
            const typeMatch = block.match(/Type:\s*(\w+)/);
            const contentMatch = block.match(/Content:\s*(.+?)(?=Premises:|$)/s);
            const premisesMatch = block.match(/Premises:\s*(.+?)(?=Confidence:|$)/s);
            const type = typeMatch?.[1];
            if (contentMatch) {
                const content = contentMatch[1].trim();
                explicit.push({ content });
                if (type === "deductive" && premisesMatch) {
                    deductive.push({ premises: premisesMatch[1].split(",").map((p) => p.trim()), conclusion: content });
                }
            }
        }
        return { explicit, deductive };
    }
    buildDreamPrompt(messages, existingConclusions) {
        const recent = messages.slice(-50).map((m) => `[${m.role}] ${m.content}`).join("\n");
        const prior = existingConclusions.slice(-10).map((c) => `- [${c.type}] ${c.content}`).join("\n");
        return `You are dreaming - consolidating memories.

Recent messages:
${recent}

Prior conclusions:
${prior || "None"}

Respond with:
NEW_CONCLUSIONS:
- inductive: <observation about user patterns>
- abductive: <inference about user goals>
- deductive: <certain fact about user>

IMPORTANT: Use ONLY these types: inductive, abductive, deductive (no underscores, no custom names)

UPDATED_CONCLUSIONS:
- <original conclusion>: <updated understanding if needed, or "unchanged">`;
    }
    parseDreamOutput(text) {
        const newConclusions = [];
        const updatedPatterns = [];
        const newMatch = text.match(/NEW_CONCLUSIONS:(.+?)(?=UPDATED_CONCLUSIONS:|$)/s);
        if (newMatch) {
            const lines = newMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
            for (const line of lines) {
                // Match format: - type: content  or  - type (no content yet)
                const match = line.match(/-\s*(deductive|inductive|abductive)[\s:]+(.+)?/i);
                if (match) {
                    const type = match[1].toLowerCase();
                    const content = match[2]?.trim() || "";
                    if (content) {
                        newConclusions.push({ type, content, premises: [], confidence: 0.6 });
                    }
                }
            }
        }
        return { newConclusions, updatedPatterns };
    }
}
//# sourceMappingURL=reasoning.js.map