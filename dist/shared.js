/**
 * Pi-Learn Shared Utilities
 *
 * Common types and utilities for the pi-learn memory system.
 * Uses Ollama for embeddings and reasoning.
 */
export const DEFAULT_RETENTION = {
    retentionDays: 0, // Forever by default
    summaryRetentionDays: 30,
    conclusionRetentionDays: 90,
    pruneOnStartup: true,
    pruneIntervalHours: 24,
};
export const DEFAULT_DREAM = {
    enabled: true,
    intervalMs: 60 * 60 * 1000, // 1 hour
    minMessagesSinceLastDream: 5,
    batchSize: 50,
};
// ============================================================================
// CONSTANTS
// ============================================================================
export const DEFAULT_TOKEN_BATCH_SIZE = 1000;
export const SHORT_SUMMARY_INTERVAL = 20;
export const LONG_SUMMARY_INTERVAL = 60;
export const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v2-moe:latest";
export const DEFAULT_REASONING_MODEL = "qwen3.5:latest";
/**
 * Global workspace ID for cross-project (user-scope) data
 */
export const GLOBAL_WORKSPACE_ID = "__global__";
/**
 * Generate embeddings using Ollama's embedding endpoint
 */
export async function generateEmbedding(text, baseUrl = "http://localhost:11434", model = DEFAULT_EMBEDDING_MODEL) {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
    });
    if (!response.ok) {
        throw new Error(`Embedding failed: ${response.statusText}`);
    }
    const data = await response.json();
    return {
        embedding: data.embedding || [],
        model,
    };
}
/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts, baseUrl = "http://localhost:11434", model = DEFAULT_EMBEDDING_MODEL) {
    return Promise.all(texts.map((text) => generateEmbedding(text, baseUrl, model)));
}
/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error("Vectors must have same dimension");
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
// ============================================================================
// REASONING PROMPTS
// ============================================================================
export const REASONING_PROMPT = `You are a memory analysis system. Analyze messages and extract insights about the peer.

Messages to analyze:
{messages}

{existing_context}

Provide your analysis as a JSON object with this structure:
{
  "explicit": [{"content": "explicit fact stated by peer"}],
  "deductive": [{"premises": ["premise1", "premise2"], "conclusion": "certain conclusion"}],
  "inductive": [{"pattern": "pattern observed", "evidence": ["evidence1", "evidence2"]}],
  "abductive": [{"observation": "what was observed", "inference": "simplest explanation", "simplest": true}],
  "peerCard": {"name": "name if mentioned", "occupation": "job if mentioned", "interests": ["interest1"], "traits": ["trait1"], "goals": ["goal1"]},
  "summary": {"type": "short|long", "content": "summary of key points"}
}

Focus on:
- Stated facts, preferences, and goals
- Behavioral patterns
- Contextual clues about who this person is
- Inconsistencies or contradictions
- Topics they care about

Respond ONLY with valid JSON, no additional text.`;
/**
 * Dream prompt - for background/creative reasoning
 */
export const DREAM_PROMPT = `You are a memory synthesis system. The peer has been conversing with an AI. 

Recent messages:
{messages}

Previous conclusions:
{conclusions}

Your task is to "dream" - synthesize deeper insights, find connections, and generate new hypotheses about the peer.

Provide your analysis as a JSON object:
{
  "newConclusions": [{"type": "deductive|inductive|abductive", "content": "insight", "premises": ["source1"], "confidence": 0.8}],
  "updatedPatterns": [{"pattern": "observed pattern", "evidence": ["evidence1"]}],
  "peerCardUpdates": {"name": "if changed", "occupation": "if changed", "interests": [], "traits": [], "goals": []},
  "dreamNarrative": "Optional: A creative synthesis narrative about who this person might be"
}

Be creative and insightful. Look for subtle patterns. Respond ONLY with valid JSON.`;
/**
 * Build reasoning prompt with context
 */
export function buildReasoningPrompt(messages, existingContext) {
    const messageList = messages
        .map((m) => `<${m.role}>\n${m.content}`)
        .join("\n\n");
    let existingCtx = "";
    if (existingContext?.conclusions?.length) {
        existingCtx += "\n\nExisting conclusions about this peer:\n";
        for (const c of existingContext.conclusions.slice(-10)) {
            existingCtx += `- [${c.type}] ${c.content}\n`;
        }
    }
    if (existingContext?.summary) {
        existingCtx += `\n\nPrevious summary:\n${existingContext.summary}`;
    }
    if (existingContext?.peerCard) {
        existingCtx += "\n\nKnown peer info:\n";
        if (existingContext.peerCard.name)
            existingCtx += `- Name: ${existingContext.peerCard.name}\n`;
        if (existingContext.peerCard.occupation)
            existingCtx += `- Occupation: ${existingContext.peerCard.occupation}\n`;
        if (existingContext.peerCard.interests?.length)
            existingCtx += `- Interests: ${existingContext.peerCard.interests.join(", ")}\n`;
        if (existingContext.peerCard.traits?.length)
            existingCtx += `- Traits: ${existingContext.peerCard.traits.join(", ")}\n`;
        if (existingContext.peerCard.goals?.length)
            existingCtx += `- Goals: ${existingContext.peerCard.goals.join(", ")}\n`;
    }
    return REASONING_PROMPT.replace("{messages}", messageList).replace("{existing_context}", existingCtx || "\n\nNo existing context - this is a new peer.");
}
/**
 * Build dream prompt with context
 */
export function buildDreamPrompt(messages, conclusions) {
    const messageList = messages
        .map((m) => `<${m.role}>\n${m.content}`)
        .join("\n\n");
    const conclusionList = conclusions
        .slice(-20)
        .map((c) => `- [${c.type}] ${c.content}`)
        .join("\n");
    return DREAM_PROMPT.replace("{messages}", messageList).replace("{conclusions}", conclusionList || "No previous conclusions");
}
/**
 * Parse reasoning output from JSON
 */
export function parseReasoningOutput(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(output);
    }
    catch {
        return {
            explicit: [],
            deductive: [],
        };
    }
}
/**
 * Parse dream output from JSON
 */
export function parseDreamOutput(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(output);
    }
    catch {
        return {
            newConclusions: [],
        };
    }
}
// ============================================================================
// TOKEN UTILITIES
// ============================================================================
/**
 * Estimate token count (rough: ~4 chars per token)
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Estimate tokens for messages
 */
export function estimateMessagesTokens(messages) {
    return messages.reduce((sum, m) => sum + estimateTokens(`${m.role}: ${m.content}`), 0);
}
/**
 * Split messages into batches by token count
 */
export function batchByTokens(messages, maxTokens = DEFAULT_TOKEN_BATCH_SIZE) {
    const batches = [];
    let currentBatch = [];
    let currentTokens = 0;
    for (const msg of messages) {
        const msgTokens = estimateTokens(`${msg.role}: ${msg.content}`);
        if (currentTokens + msgTokens > maxTokens && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [msg];
            currentTokens = msgTokens;
        }
        else {
            currentBatch.push(msg);
            currentTokens += msgTokens;
        }
    }
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    return batches;
}
// ============================================================================
// ID GENERATION
// ============================================================================
/**
 * Generate a unique ID
 */
export function generateId(prefix = "") {
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
//# sourceMappingURL=shared.js.map