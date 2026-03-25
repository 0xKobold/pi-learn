/**
 * Reasoning Engine Module - LLM-based reasoning for pi-learn
 *
 * Supports hybrid scope:
 * - 'user' scope: Cross-project insights (traits, interests, goals)
 * - 'project' scope: Project-specific insights (code patterns, decisions)
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
    /**
     * Reason about messages with optional context
     * @param messages Messages to reason about
     * @param _peerId Peer ID (unused, context determines scope)
     * @param context Optional context for informed reasoning
     */
    async reason(messages, _peerId, context) {
        const prompt = this.buildReasoningPrompt(messages, context);
        const content = await this.callOllamaChat(prompt);
        return this.parseReasoningOutput(content);
    }
    /**
     * Dream - consolidate memories with scope classification
     * @param messages Recent messages
     * @param existingConclusions Existing conclusions (can be mixed scope)
     * @param context Optional context for informed dreaming
     */
    async dream(messages, existingConclusions, context) {
        const prompt = this.buildDreamPrompt(messages, existingConclusions, context);
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
    /**
     * Build reasoning prompt with scope classification guidance
     */
    buildReasoningPrompt(messages, context) {
        const formatted = messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n");
        // Build context string
        let contextStr = "";
        if (context) {
            if (context.globalPeerCard) {
                const card = context.globalPeerCard;
                contextStr += "\n\n## Known User Profile (Global)\n";
                if (card.name)
                    contextStr += `- Name: ${card.name}\n`;
                if (card.occupation)
                    contextStr += `- Occupation: ${card.occupation}\n`;
                if (card.interests.length)
                    contextStr += `- Interests: ${card.interests.join(", ")}\n`;
                if (card.traits.length)
                    contextStr += `- Traits: ${card.traits.join(", ")}\n`;
                if (card.goals.length)
                    contextStr += `- Goals: ${card.goals.join(", ")}\n`;
            }
            if (context.globalConclusions?.length) {
                contextStr += "\n\n## Cross-Project Insights\n";
                context.globalConclusions.slice(0, 5).forEach((c) => {
                    contextStr += `- [${c.type}] ${c.content}\n`;
                });
            }
        }
        return `You are analyzing conversation messages to extract key conclusions about the user.

Messages to analyze:
${formatted}
${contextStr}

For each conclusion, classify its SCOPE:
- "user": Cross-project insights about the peer's traits, interests, goals, preferences, or personality. These apply across ALL projects.
  Examples: "Perfectionist", "Prefers TypeScript over JavaScript", "Interested in AI", "Values code quality"
  
- "project": Project-specific insights about code, architecture, or decisions unique to THIS project.
  Examples: "Used SQLite for local storage", "Implemented React hooks for state", "Chose this API design"

Format each conclusion as:
SCOPE: <user|project>
CONCLUSION: <type>
Type: deductive, inductive, or abductive
Content: <what you concluded>
Premises: <what led to this conclusion>
Confidence: <0.0-1.0>

RULES:
- If in doubt, prefer "project" scope (keeps user profile focused)
- "user" scope: personality, preferences, stated interests, goals
- "project" scope: technical decisions, code patterns, implementation details

Conclusion types:
- deductive: Logical certainty
- inductive: Probable inference
- abductive: Best explanation

Respond with 1-5 conclusions, focusing on the most important insights.`;
    }
    /**
     * Parse reasoning output with scope classification
     */
    parseReasoningOutput(text) {
        const conclusions = [];
        // Match blocks that start with SCOPE and CONCLUSION
        const blocks = text.split(/(?=SCOPE:)/i).filter(Boolean);
        for (const block of blocks) {
            const scopeMatch = block.match(/SCOPE:\s*(\w+)/i);
            const typeMatch = block.match(/Type:\s*(\w+)/i);
            const contentMatch = block.match(/Content:\s*(.+?)(?=Premises:|Confidence:|$)/s);
            const premisesMatch = block.match(/Premises:\s*(.+?)(?=Confidence:|Type:|SCOPE:|$)/s);
            const confidenceMatch = block.match(/Confidence:\s*([\d.]+)/);
            if (scopeMatch && contentMatch) {
                const scope = scopeMatch[1].toLowerCase() || 'project';
                const type = typeMatch?.[1] || 'inductive';
                const content = contentMatch[1].trim();
                const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
                let premises = [];
                if (premisesMatch) {
                    premises = premisesMatch[1].split(/[,;]/).map((p) => p.trim()).filter(Boolean);
                }
                conclusions.push({ content, type, premises, scope, confidence });
            }
        }
        // Fallback: if no scoped conclusions found, try original parsing with default scope
        if (conclusions.length === 0) {
            const legacyBlocks = text.split(/CONCLUSION:/i).filter(Boolean);
            for (const block of legacyBlocks) {
                const typeMatch = block.match(/Type:\s*(\w+)/i);
                const contentMatch = block.match(/Content:\s*(.+?)(?=Premises:|$)/s);
                if (contentMatch) {
                    conclusions.push({
                        content: contentMatch[1].trim(),
                        type: typeMatch?.[1] || 'inductive',
                        premises: [],
                        scope: 'project', // Default to project scope
                        confidence: 0.5,
                    });
                }
            }
        }
        // Convert to ReasoningOutput format
        const explicit = conclusions.map((c) => ({ content: c.content, scope: c.scope }));
        const deductive = conclusions
            .filter((c) => c.type === "deductive")
            .map((c) => ({ premises: c.premises, conclusion: c.content, scope: c.scope }));
        return { explicit, deductive, conclusions };
    }
    /**
     * Build dream prompt with scope classification
     */
    buildDreamPrompt(messages, existingConclusions, context) {
        const recent = messages.slice(-50).map((m) => `[${m.role}] ${m.content}`).join("\n");
        // Separate conclusions by scope
        const userConclusions = existingConclusions.filter((c) => c.scope === 'user');
        const projectConclusions = existingConclusions.filter((c) => c.scope === 'project');
        let contextStr = "";
        if (context?.globalPeerCard) {
            const card = context.globalPeerCard;
            contextStr += "\n\n## Known User Profile\n";
            if (card.name)
                contextStr += `- Name: ${card.name}\n`;
            if (card.interests.length)
                contextStr += `- Interests: ${card.interests.join(", ")}\n`;
            if (card.traits.length)
                contextStr += `- Traits: ${card.traits.join(", ")}\n`;
            if (card.goals.length)
                contextStr += `- Goals: ${card.goals.join(", ")}\n`;
        }
        return `You are dreaming - consolidating memories and generating new insights.

Recent messages:
${recent}
${contextStr}

Prior conclusions by scope:
## Cross-Project (user scope):
${userConclusions.slice(0, 10).map((c) => `- [${c.type}] ${c.content}`).join("\n") || "None"}

## Project-Specific (project scope):
${projectConclusions.slice(0, 10).map((c) => `- [${c.type}] ${c.content}`).join("\n") || "None"}

Generate NEW conclusions by analyzing patterns in the messages.
Classify each as SCOPE: user (cross-project) or project (local).

Respond with:
NEW_CONCLUSIONS:
- SCOPE: user
  Type: inductive
  Content: <insight about user traits/interests/goals>
- SCOPE: project  
  Type: abductive
  Content: <insight about this project's direction>

IMPORTANT: Use ONLY these types: inductive, abductive, deductive
Use EXACT scope values: "user" or "project"

UPDATED_PATTERNS:
- <existing pattern>: <updated understanding if needed, or "unchanged">`;
    }
    /**
     * Parse dream output with scope classification
     */
    parseDreamOutput(text) {
        const newConclusions = [];
        const updatedPatterns = [];
        // Parse new conclusions
        const newMatch = text.match(/NEW_CONCLUSIONS:(.+?)(?=UPDATED_PATTERNS:|$)/si);
        if (newMatch) {
            // Split by SCOPE: to get individual conclusions
            const conclusionBlocks = newMatch[1].split(/(?=^\s*SCOPE:)/m).filter(Boolean);
            for (const block of conclusionBlocks) {
                const scopeMatch = block.match(/SCOPE:\s*(\w+)/i);
                const typeMatch = block.match(/Type:\s*(\w+)/i);
                const contentMatch = block.match(/Content:\s*(.+?)(?=$)/s);
                if (scopeMatch && contentMatch) {
                    const scope = scopeMatch[1].toLowerCase() || 'project';
                    const type = typeMatch?.[1]?.toLowerCase() || 'inductive';
                    const content = contentMatch[1].trim();
                    if (content && content.length > 5) {
                        newConclusions.push({
                            type,
                            content,
                            premises: [],
                            confidence: 0.6,
                            scope,
                        });
                    }
                }
            }
        }
        // Fallback: try simpler format
        if (newConclusions.length === 0) {
            const lines = text.split("\n").filter((l) => l.trim().startsWith("-"));
            for (const line of lines) {
                const match = line.match(/-\s*(deductive|inductive|abductive)[\s:]+(.+)/i);
                if (match) {
                    newConclusions.push({
                        type: match[1].toLowerCase(),
                        content: match[2].trim(),
                        premises: [],
                        confidence: 0.6,
                        scope: 'project', // Default to project scope
                    });
                }
            }
        }
        // Parse updated patterns
        const updatedMatch = text.match(/UPDATED_PATTERNS:(.+?)$/si);
        if (updatedMatch) {
            const lines = updatedMatch[1].split("\n").filter((l) => l.includes(":"));
            for (const line of lines) {
                const [pattern, evidence] = line.split(":").map((s) => s.trim());
                if (pattern && evidence && evidence !== "unchanged") {
                    updatedPatterns.push({ pattern, evidence: [evidence] });
                }
            }
        }
        return { newConclusions, updatedPatterns };
    }
}
//# sourceMappingURL=reasoning.js.map