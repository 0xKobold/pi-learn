/**
 * Context Assembler Module - Memory retrieval and context building
 */
export function createContextAssembler(store) {
    return new ContextAssembler(store);
}
export class ContextAssembler {
    store;
    constructor(store) {
        this.store = store;
    }
    assembleContext(workspaceId, peerId) {
        const rep = this.store.getRepresentation(workspaceId, peerId);
        if (!rep)
            return null;
        return this.buildContextString(rep);
    }
    async searchSimilar(workspaceId, peerId, query, topK = 5, minSimilarity = 0.0) {
        const conclusions = this.store.getConclusions(workspaceId, peerId, 100);
        if (!conclusions.length)
            return [];
        // Use embedding-based similarity when available, fallback to keyword
        const queryWords = query.toLowerCase().split(/\s+/);
        const scored = conclusions.map((c) => {
            let confidence;
            if (c.embedding && c.embedding.length > 0) {
                // Use cosine similarity - would need query embedding in real impl
                // For now, hybrid approach: keyword + embedding presence boost
                const contentWords = c.content.toLowerCase().split(/\s+/);
                const overlap = queryWords.filter((w) => contentWords.some((cw) => cw.includes(w) || w.includes(cw))).length;
                const keywordScore = overlap / Math.max(queryWords.length, 1);
                // Boost if has embeddings (indicates processed)
                confidence = keywordScore * 0.6 + (c.embedding ? 0.4 : 0);
            }
            else {
                // Keyword-only fallback
                const contentWords = c.content.toLowerCase().split(/\s+/);
                const overlap = queryWords.filter((w) => contentWords.some((cw) => cw.includes(w) || w.includes(cw))).length;
                confidence = overlap / Math.max(queryWords.length, 1);
            }
            return { ...c, confidence };
        });
        return scored
            .filter((c) => c.confidence >= minSimilarity)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, topK);
    }
    getConclusionsByType(workspaceId, peerId, type) {
        return this.store.getConclusions(workspaceId, peerId, 100).filter((c) => c.type === type);
    }
    getSummaries(workspaceId, peerId, limit = 10) {
        return this.store.getSummaries(workspaceId, peerId, limit);
    }
    getMemoryStats(workspaceId, peerId) {
        const rep = this.store.getRepresentation(workspaceId, peerId);
        if (!rep)
            return { conclusionCount: 0, summaryCount: 0, hasPeerCard: false, lastReasonedAt: null, topInterests: [], topTraits: [] };
        const card = rep.peerCard;
        return {
            conclusionCount: rep.conclusions.length,
            summaryCount: rep.summaries.length,
            hasPeerCard: !!card,
            lastReasonedAt: rep.lastReasonedAt || null,
            topInterests: card?.interests?.slice(0, 5) || [],
            topTraits: card?.traits?.slice(0, 5) || [],
        };
    }
    /**
     * Get comprehensive memory insights about a peer's learning patterns
     */
    getInsights(workspaceId, peerId) {
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        const conclusions = this.store.getConclusions(workspaceId, peerId, 1000);
        const summaries = this.store.getSummaries(workspaceId, peerId, 100);
        const sessions = this.store.getAllSessions(workspaceId);
        const peerCard = this.store.getPeerCard(workspaceId, peerId);
        // Learning velocity: conclusions per day over last week
        const recentConclusions = conclusions.filter(c => c.createdAt > oneWeekAgo);
        const learningVelocity = recentConclusions.length / 7;
        // Topic distribution
        const topicDistribution = {
            deductive: conclusions.filter(c => c.type === 'deductive').length,
            inductive: conclusions.filter(c => c.type === 'inductive').length,
            abductive: conclusions.filter(c => c.type === 'abductive').length,
        };
        // Interest evolution from peer card and conclusions
        const interestCounts = new Map();
        // Extract interests from peer card
        for (const interest of peerCard?.interests || []) {
            if (!interestCounts.has(interest)) {
                interestCounts.set(interest, [0, 0]); // [old count, recent count]
            }
        }
        // Extract interests from conclusions (look for keywords)
        const allConclusionsText = conclusions.map(c => c.content.toLowerCase()).join(' ');
        const knownInterests = peerCard?.interests || [];
        const interestEvolution = knownInterests.map(interest => {
            const interestLower = interest.toLowerCase();
            const words = interestLower.split(/\s+/);
            // Count in all conclusions
            const totalCount = words.reduce((sum, word) => {
                const regex = new RegExp(word, 'gi');
                return sum + (allConclusionsText.match(regex)?.length || 0);
            }, 0);
            // Count in recent conclusions (last month)
            const recentText = recentConclusions.map(c => c.content.toLowerCase()).join(' ');
            const recentCount = words.reduce((sum, word) => {
                const regex = new RegExp(word, 'gi');
                return sum + (recentText.match(regex)?.length || 0);
            }, 0);
            // Determine trend
            let trend = 'stable';
            const oldCount = totalCount - recentCount;
            if (oldCount === 0 && recentCount > 0) {
                trend = 'up';
            }
            else if (recentCount > oldCount * 1.5) {
                trend = 'up';
            }
            else if (recentCount < oldCount * 0.5 && oldCount > 0) {
                trend = 'down';
            }
            return {
                interest,
                frequency: totalCount,
                trend,
            };
        }).sort((a, b) => b.frequency - a.frequency);
        // Engagement metrics
        const oneWeekSessions = sessions.filter(s => s.createdAt > oneWeekAgo);
        const uniqueDays = new Set(oneWeekSessions.map(s => new Date(s.createdAt).toDateString()));
        // Count total messages across all sessions
        let totalMessages = 0;
        for (const session of sessions) {
            const messages = this.store.getMessages(workspaceId, session.id, 10000);
            totalMessages += messages.length;
        }
        const engagementMetrics = {
            totalSessions: sessions.length,
            totalMessages,
            avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
            sessionFrequencyPerWeek: oneWeekSessions.length,
            activeDaysLastWeek: uniqueDays.size,
        };
        // Recent activity
        const recentActivity = {
            conclusionsLastWeek: recentConclusions.length,
            conclusionsLastMonth: conclusions.filter(c => c.createdAt > oneMonthAgo).length,
            sessionsLastWeek: oneWeekSessions.length,
        };
        return {
            learningVelocity,
            topicDistribution,
            interestEvolution,
            engagementMetrics,
            recentActivity,
        };
    }
    /**
     * Get perspective-based context: what peer A knows/thinks about peer B
     */
    getPerspective(workspaceId, observerPeerId, targetPeerId) {
        // Get observations made BY observer ABOUT target
        const crossObservations = this.store.getObservationsAboutPeer(workspaceId, targetPeerId, 50)
            .filter(o => o.peerId === observerPeerId);
        // Get conclusions that observer has made about target
        const conclusions = this.store.getConclusions(workspaceId, observerPeerId, 100)
            .filter(c => c.content.toLowerCase().includes(targetPeerId.toLowerCase()));
        // Get target's peer card (public info)
        const targetCard = this.store.getPeerCard(workspaceId, targetPeerId);
        if (!crossObservations.length && !conclusions.length && !targetCard) {
            return null;
        }
        const parts = [];
        parts.push(`## Perspective: ${observerPeerId} on ${targetPeerId}`);
        if (crossObservations.length > 0) {
            parts.push("\n### Observations");
            crossObservations.slice(0, 10).forEach((o) => parts.push(`- ${o.content.slice(0, 200)}`));
        }
        if (conclusions.length > 0) {
            parts.push("\n### Conclusions");
            conclusions.slice(0, 5).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
        }
        if (targetCard) {
            parts.push("\n### Known Info");
            if (targetCard.name)
                parts.push(`- Name: ${targetCard.name}`);
            if (targetCard.occupation)
                parts.push(`- Occupation: ${targetCard.occupation}`);
            if (targetCard.interests.length)
                parts.push(`- Interests: ${targetCard.interests.join(", ")}`);
        }
        return parts.join("\n");
    }
    buildContextString(rep) {
        const parts = [];
        // Recent unprocessed observations
        const recentObservations = rep.observations
            .filter(o => !o.processed)
            .slice(0, 5);
        if (recentObservations.length > 0) {
            parts.push("## Recent Observations");
            recentObservations.forEach((o) => parts.push(`- [${o.role}] ${o.content.slice(0, 200)}`));
        }
        if (rep.conclusions.length > 0) {
            parts.push("\n## Key Conclusions");
            rep.conclusions.slice(0, 10).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
        }
        if (rep.summaries.length > 0) {
            parts.push("\n## Recent Summaries");
            rep.summaries.slice(0, 3).forEach((s) => parts.push(`- ${s.type}: ${s.content.slice(0, 200)}`));
        }
        if (rep.peerCard) {
            const card = rep.peerCard;
            parts.push("\n## User Profile");
            if (card.name)
                parts.push(`- Name: ${card.name}`);
            if (card.occupation)
                parts.push(`- Occupation: ${card.occupation}`);
            if (card.interests.length)
                parts.push(`- Interests: ${card.interests.join(", ")}`);
            if (card.traits.length)
                parts.push(`- Traits: ${card.traits.join(", ")}`);
            if (card.goals.length)
                parts.push(`- Goals: ${card.goals.join(", ")}`);
        }
        return parts.join("\n") || "No memory context available.";
    }
}
//# sourceMappingURL=context.js.map