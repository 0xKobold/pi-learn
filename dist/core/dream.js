/**
 * Dream Scheduler - Background memory consolidation
 */
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
export function createDreamScheduler(store, reasoningEngine, config) {
    return new DreamScheduler(store, reasoningEngine, config);
}
// ============================================================================
// DREAM SCHEDULER CLASS
// ============================================================================
export class DreamScheduler {
    store;
    reasoningEngine;
    config;
    intervalHandle;
    lastDreamAt = 0;
    constructor(store, reasoningEngine, config) {
        this.store = store;
        this.reasoningEngine = reasoningEngine;
        this.config = config;
    }
    /** Start the dream scheduler */
    start(workspaceId) {
        if (!this.config.enabled)
            return;
        // Initial dream after 30 seconds
        setTimeout(() => {
            this.runDream(workspaceId).catch(console.error);
        }, 30000);
        // Periodic dreaming
        this.intervalHandle = setInterval(() => {
            this.runDream(workspaceId).catch(console.error);
        }, this.config.intervalMs);
    }
    /** Stop the dream scheduler */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = undefined;
        }
    }
    /** Run a dream cycle */
    async runDream(workspaceId) {
        // Check minimum messages threshold
        const messages = this.store.getRecentMessages(workspaceId, "user", this.config.batchSize);
        if (messages.length < this.config.minMessagesSinceLastDream) {
            return;
        }
        // Check time since last dream
        if (Date.now() - this.lastDreamAt < this.config.intervalMs / 2) {
            return;
        }
        const conclusions = this.store.getConclusions(workspaceId, "user", 100);
        const result = await this.reasoningEngine.dream(messages.map((m) => ({ role: m.role, content: m.content })), conclusions);
        // Save new conclusions
        for (const conclusion of result.newConclusions) {
            const savedConclusion = {
                id: crypto.randomUUID(),
                peerId: "user",
                createdAt: Date.now(),
                sourceSessionId: messages[0]?.session_id || "dream",
                type: conclusion.type,
                content: conclusion.content,
                premises: conclusion.premises,
                confidence: conclusion.confidence,
            };
            this.store.saveConclusion(workspaceId, savedConclusion);
        }
        this.lastDreamAt = Date.now();
    }
}
//# sourceMappingURL=dream.js.map