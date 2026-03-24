/**
 * SQLite Store Module - Database operations for pi-learn
 */
import Database from "better-sqlite3";
import { cosineSimilarity } from "../shared.js";
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
export function createStore(dbPath) {
    return new SQLiteStore(dbPath);
}
// ============================================================================
// STORE CLASS
// ============================================================================
export class SQLiteStore {
    db;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = OFF");
        this.initTables();
        this.migrate();
        this.verifyAndFixSchema();
    }
    initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        config TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS peers (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (id, workspace_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        peer_ids TEXT NOT NULL DEFAULT '[]',
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        tags TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (id, workspace_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id, workspace_id) REFERENCES sessions(id, workspace_id),
        FOREIGN KEY (peer_id, workspace_id) REFERENCES peers(id, workspace_id)
      );

      CREATE TABLE IF NOT EXISTS conclusions (
        id TEXT PRIMARY KEY,
        peer_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        premises TEXT NOT NULL DEFAULT '[]',
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        source_session_id TEXT NOT NULL,
        embedding TEXT,
        FOREIGN KEY (peer_id, workspace_id) REFERENCES peers(id, workspace_id),
        FOREIGN KEY (source_session_id, workspace_id) REFERENCES sessions(id, workspace_id)
      );

      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        embedding TEXT,
        FOREIGN KEY (session_id, workspace_id) REFERENCES sessions(id, workspace_id),
        FOREIGN KEY (peer_id, workspace_id) REFERENCES peers(id, workspace_id)
      );

      CREATE TABLE IF NOT EXISTS peer_cards (
        peer_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        name TEXT,
        occupation TEXT,
        interests TEXT NOT NULL DEFAULT '[]',
        traits TEXT NOT NULL DEFAULT '[]',
        goals TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (peer_id, workspace_id),
        FOREIGN KEY (peer_id, workspace_id) REFERENCES peers(id, workspace_id)
      );

      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        peer_id TEXT NOT NULL,
        about_peer_id TEXT,
        session_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        embedding TEXT,
        processed INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (peer_id, workspace_id) REFERENCES peers(id, workspace_id),
        FOREIGN KEY (session_id, workspace_id) REFERENCES sessions(id, workspace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_conclusions_peer ON conclusions(peer_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_conclusions_created ON conclusions(created_at);
      CREATE INDEX IF NOT EXISTS idx_summaries_peer ON summaries(peer_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_observations_peer ON observations(peer_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_observations_processed ON observations(processed);
      CREATE INDEX IF NOT EXISTS idx_observations_about ON observations(about_peer_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_tags ON sessions(tags);
    `);
    }
    migrate() {
        // Migrate sessions table to add tags column if it doesn't exist
        try {
            const columns = this.db.prepare("PRAGMA table_info(sessions)").all();
            const hasTags = columns.some(c => c.name === 'tags');
            if (!hasTags) {
                this.db.exec("ALTER TABLE sessions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
            }
        }
        catch {
            // Column may already exist or table doesn't exist yet
        }
        // Migrate observations table to add about_peer_id column
        try {
            const columns = this.db.prepare("PRAGMA table_info(observations)").all();
            const hasAboutPeerId = columns.some(c => c.name === 'about_peer_id');
            if (!hasAboutPeerId) {
                this.db.exec("ALTER TABLE observations ADD COLUMN about_peer_id TEXT");
            }
        }
        catch {
            // Column may already exist
        }
        // Migrate messages table to add metadata column
        try {
            const columns = this.db.prepare("PRAGMA table_info(messages)").all();
            const hasMetadata = columns.some(c => c.name === 'metadata');
            if (!hasMetadata) {
                this.db.exec("ALTER TABLE messages ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");
            }
        }
        catch {
            // Column may already exist
        }
    }
    /**
     * Verify database schema integrity and fix any issues.
     * This ensures all required columns and indexes exist even if migrations
     * were skipped or failed in previous runs.
     */
    verifyAndFixSchema() {
        const requiredColumns = {
            sessions: ['tags'],
            observations: ['about_peer_id'],
            messages: ['metadata'],
        };
        const requiredIndexes = {
            observations: [
                { name: 'idx_observations_about', columns: ['about_peer_id', 'workspace_id'] },
            ],
        };
        // Verify and fix columns
        for (const [table, requiredCols] of Object.entries(requiredColumns)) {
            try {
                const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
                const columnNames = new Set(columns.map(c => c.name));
                for (const col of requiredCols) {
                    if (!columnNames.has(col)) {
                        console.warn(`[Store] Missing column '${col}' in '${table}' table. Adding...`);
                        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
                        console.log(`[Store] Added column '${col}' to '${table}' table.`);
                    }
                }
            }
            catch (err) {
                console.error(`[Store] Error verifying columns for '${table}':`, err);
            }
        }
        // Verify and fix indexes
        for (const [table, requiredIdxs] of Object.entries(requiredIndexes)) {
            try {
                const existingIndexes = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}'`).all();
                const indexNames = new Set(existingIndexes.map(i => i.name));
                for (const idx of requiredIdxs) {
                    if (!indexNames.has(idx.name)) {
                        console.warn(`[Store] Missing index '${idx.name}' on '${table}' table. Creating...`);
                        this.db.exec(`CREATE INDEX ${idx.name} ON ${table}(${idx.columns.join(', ')})`);
                        console.log(`[Store] Created index '${idx.name}' on '${table}' table.`);
                    }
                }
            }
            catch (err) {
                console.error(`[Store] Error verifying indexes for '${table}':`, err);
            }
        }
    }
    // Workspace
    getWorkspace(id) {
        const row = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id);
        if (!row)
            return null;
        return { id: row.id, name: row.name, createdAt: row.created_at, config: JSON.parse(row.config || "{}") };
    }
    saveWorkspace(workspace) {
        this.db.prepare(`INSERT OR REPLACE INTO workspaces (id, name, created_at, config) VALUES (?, ?, ?, ?)`)
            .run(workspace.id, workspace.name, workspace.createdAt, JSON.stringify(workspace.config));
    }
    // Peer
    getPeer(workspaceId, peerId) {
        const row = this.db.prepare("SELECT * FROM peers WHERE id = ? AND workspace_id = ?").get(peerId, workspaceId);
        if (!row)
            return null;
        return { id: row.id, name: row.name, type: row.type, createdAt: row.created_at, metadata: JSON.parse(row.metadata || "{}") };
    }
    savePeer(workspaceId, peer) {
        this.db.prepare(`INSERT OR REPLACE INTO peers (id, workspace_id, name, type, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(peer.id, workspaceId, peer.name, peer.type, peer.createdAt, JSON.stringify(peer.metadata));
    }
    getAllPeers(workspaceId) {
        const rows = this.db.prepare("SELECT * FROM peers WHERE workspace_id = ?").all(workspaceId);
        return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, createdAt: r.created_at, metadata: JSON.parse(r.metadata || "{}") }));
    }
    // Session
    getSession(workspaceId, sessionId) {
        const row = this.db.prepare("SELECT * FROM sessions WHERE id = ? AND workspace_id = ?").get(sessionId, workspaceId);
        if (!row)
            return null;
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            peerIds: JSON.parse(row.peer_ids),
            messageCount: row.message_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            config: JSON.parse(row.config || "{}"),
            tags: JSON.parse(row.tags || "[]")
        };
    }
    saveSession(workspaceId, session) {
        this.db.prepare(`INSERT OR REPLACE INTO sessions (id, workspace_id, peer_ids, message_count, created_at, updated_at, config, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(session.id, workspaceId, JSON.stringify(session.peerIds), session.messageCount, session.createdAt, session.updatedAt, JSON.stringify(session.config), JSON.stringify(session.tags || []));
    }
    getAllSessions(workspaceId) {
        const rows = this.db.prepare("SELECT * FROM sessions WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
        return rows.map((r) => ({
            id: r.id,
            workspaceId: r.workspace_id,
            peerIds: JSON.parse(r.peer_ids),
            messageCount: r.message_count,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            config: JSON.parse(r.config || "{}"),
            tags: JSON.parse(r.tags || "[]")
        }));
    }
    // Session Tags
    tagSession(workspaceId, sessionId, tags) {
        const session = this.getSession(workspaceId, sessionId);
        if (!session)
            return;
        const existingTags = new Set(session.tags || []);
        tags.forEach(t => existingTags.add(t));
        session.tags = Array.from(existingTags);
        session.updatedAt = Date.now();
        this.saveSession(workspaceId, session);
    }
    untagSession(workspaceId, sessionId, tags) {
        const session = this.getSession(workspaceId, sessionId);
        if (!session)
            return;
        const tagSet = new Set(tags);
        session.tags = (session.tags || []).filter(t => !tagSet.has(t));
        session.updatedAt = Date.now();
        this.saveSession(workspaceId, session);
    }
    getSessionsByTag(workspaceId, tag, limit = 20) {
        const rows = this.db.prepare("SELECT * FROM sessions WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(workspaceId, limit);
        return rows
            .map((r) => ({
            id: r.id,
            workspaceId: r.workspace_id,
            peerIds: JSON.parse(r.peer_ids),
            messageCount: r.message_count,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            config: JSON.parse(r.config || "{}"),
            tags: JSON.parse(r.tags || "[]")
        }))
            .filter(s => s.tags.includes(tag));
    }
    getAllTags(workspaceId) {
        const sessions = this.getAllSessions(workspaceId);
        const tagCounts = new Map();
        for (const session of sessions) {
            for (const tag of session.tags || []) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }
    // Messages
    saveMessage(workspaceId, message) {
        this.db.prepare(`INSERT INTO messages (id, session_id, workspace_id, peer_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(message.id, message.sessionId, workspaceId, message.peerId, message.role, message.content, JSON.stringify(message.metadata || {}), message.createdAt);
    }
    // Batch message creation - efficient insert of multiple messages
    saveMessagesBatch(workspaceId, messages) {
        const stmt = this.db.prepare(`INSERT INTO messages (id, session_id, workspace_id, peer_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertMany = this.db.transaction((msgs) => {
            for (const msg of msgs) {
                stmt.run(msg.id, msg.sessionId, workspaceId, msg.peerId, msg.role, msg.content, JSON.stringify(msg.metadata || {}), msg.createdAt);
            }
            return msgs.length;
        });
        return insertMany(messages);
    }
    getMessages(workspaceId, sessionId, limit = 100) {
        return this.db.prepare("SELECT * FROM messages WHERE session_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(sessionId, workspaceId, limit);
    }
    getRecentMessages(workspaceId, peerId, limit = 50) {
        return this.db.prepare("SELECT * FROM messages WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(peerId, workspaceId, limit);
    }
    // Conclusions
    saveConclusion(workspaceId, conclusion) {
        this.db.prepare(`INSERT OR REPLACE INTO conclusions (id, peer_id, workspace_id, type, content, premises, confidence, created_at, source_session_id, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(conclusion.id, conclusion.peerId, workspaceId, conclusion.type, conclusion.content, JSON.stringify(conclusion.premises), conclusion.confidence, conclusion.createdAt, conclusion.sourceSessionId, conclusion.embedding ? JSON.stringify(conclusion.embedding) : null);
    }
    getConclusions(workspaceId, peerId, limit = 10) {
        const rows = this.db.prepare("SELECT * FROM conclusions WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(peerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, type: r.type, content: r.content, premises: JSON.parse(r.premises || "[]"), confidence: r.confidence, createdAt: r.created_at, sourceSessionId: r.source_session_id, embedding: r.embedding ? JSON.parse(r.embedding) : undefined }));
    }
    getAllConclusions(workspaceId, peerId) {
        if (peerId) {
            return this.getConclusions(workspaceId, peerId, 10000);
        }
        const rows = this.db.prepare("SELECT * FROM conclusions WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, type: r.type, content: r.content, premises: JSON.parse(r.premises || "[]"), confidence: r.confidence, createdAt: r.created_at, sourceSessionId: r.source_session_id, embedding: r.embedding ? JSON.parse(r.embedding) : undefined }));
    }
    // Summaries
    saveSummary(workspaceId, summary) {
        this.db.prepare(`INSERT INTO summaries (id, session_id, peer_id, workspace_id, type, content, message_count, created_at, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(summary.id, summary.sessionId, summary.peerId, workspaceId, summary.type, summary.content, summary.messageCount, summary.createdAt, summary.embedding ? JSON.stringify(summary.embedding) : null);
    }
    getSummaries(workspaceId, peerId, limit = 10) {
        const rows = this.db.prepare("SELECT * FROM summaries WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(peerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, sessionId: r.session_id, peerId: r.peer_id, type: r.type, content: r.content, messageCount: r.message_count, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined }));
    }
    // Peer Cards
    getPeerCard(workspaceId, peerId) {
        const row = this.db.prepare("SELECT * FROM peer_cards WHERE peer_id = ? AND workspace_id = ?").get(peerId, workspaceId);
        if (!row)
            return null;
        return { peerId: row.peer_id, name: row.name, occupation: row.occupation, interests: JSON.parse(row.interests || "[]"), traits: JSON.parse(row.traits || "[]"), goals: JSON.parse(row.goals || "[]"), updatedAt: row.updated_at };
    }
    savePeerCard(workspaceId, card) {
        this.db.prepare(`INSERT OR REPLACE INTO peer_cards (peer_id, workspace_id, name, occupation, interests, traits, goals, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(card.peerId, workspaceId, card.name || null, card.occupation || null, JSON.stringify(card.interests), JSON.stringify(card.traits), JSON.stringify(card.goals), card.updatedAt);
    }
    // Observations
    saveObservation(observation) {
        this.db.prepare(`INSERT INTO observations (id, peer_id, about_peer_id, session_id, workspace_id, role, content, created_at, embedding, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(observation.id, observation.peerId, observation.aboutPeerId || null, observation.sessionId, observation.workspaceId, observation.role, observation.content, observation.createdAt, observation.embedding ? JSON.stringify(observation.embedding) : null, observation.processed ? 1 : 0);
    }
    // Alias for backward compatibility
    addObservation = this.saveObservation;
    getObservations(workspaceId, peerId, limit = 100) {
        const rows = this.db.prepare("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(peerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id || undefined, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
    }
    // Cross-peer: Get observations made BY a peer about OTHER peers
    getObservationsForPeer(workspaceId, observerPeerId, limit = 100) {
        const rows = this.db.prepare("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? AND about_peer_id IS NOT NULL ORDER BY created_at DESC LIMIT ?").all(observerPeerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
    }
    // Cross-peer: Get observations made ABOUT a specific peer by OTHER peers
    getObservationsAboutPeer(workspaceId, targetPeerId, limit = 100) {
        const rows = this.db.prepare("SELECT * FROM observations WHERE about_peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(targetPeerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
    }
    getUnprocessedObservations(workspaceId, peerId, limit = 50) {
        const rows = this.db.prepare("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? AND processed = 0 ORDER BY created_at ASC LIMIT ?").all(peerId, workspaceId, limit);
        return rows.map((r) => ({ id: r.id, peerId: r.peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: false }));
    }
    markObservationsProcessed(observationIds) {
        if (observationIds.length === 0)
            return;
        const placeholders = observationIds.map(() => '?').join(',');
        this.db.prepare(`UPDATE observations SET processed = 1 WHERE id IN (${placeholders})`).run(...observationIds);
    }
    searchObservations(workspaceId, peerId, query, limit = 20) {
        const observations = this.getObservations(workspaceId, peerId, 100);
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length === 0) {
            return observations.slice(0, limit).map(o => ({ ...o, relevance: 1 }));
        }
        // Score observations by keyword overlap
        const scored = observations.map(obs => {
            const contentLower = obs.content.toLowerCase();
            let matchCount = 0;
            for (const word of queryWords) {
                if (contentLower.includes(word)) {
                    matchCount++;
                }
            }
            const relevance = matchCount / queryWords.length;
            return { ...obs, relevance };
        });
        return scored
            .filter(o => o.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }
    searchObservationsByEmbedding(workspaceId, peerId, queryEmbedding, limit = 20) {
        const observations = this.getObservations(workspaceId, peerId, 100);
        const scored = observations
            .filter(o => o.embedding && o.embedding.length > 0)
            .map(obs => {
            const similarity = cosineSimilarity(queryEmbedding, obs.embedding);
            return { ...obs, relevance: similarity };
        });
        return scored
            .filter(o => o.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }
    // Representation
    getRepresentation(workspaceId, peerId) {
        const conclusions = this.getConclusions(workspaceId, peerId, 100);
        const summaries = this.getSummaries(workspaceId, peerId, 10);
        const peerCard = this.getPeerCard(workspaceId, peerId);
        const observations = this.getObservations(workspaceId, peerId, 50);
        const lastConclusion = conclusions[0];
        return { peerId, conclusions, summaries, peerCard, observations, lastReasonedAt: lastConclusion?.createdAt || 0 };
    }
    // Search
    searchSessions(workspaceId, query, limit = 10) {
        const rows = this.db.prepare(`
      SELECT DISTINCT s.id, s.created_at, m.content
      FROM sessions s
      JOIN messages m ON m.session_id = s.id AND m.workspace_id = s.workspace_id
      WHERE s.workspace_id = ? AND m.content LIKE ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `).all(workspaceId, `%${query}%`, limit);
        return rows.map((r) => ({ sessionId: r.id, createdAt: r.created_at, snippet: r.content.slice(0, 150).replace(/\n/g, " ") + (r.content.length > 150 ? "..." : ""), relevance: 1.0 }));
    }
    // Retention
    prune(retentionDays, summaryRetentionDays, conclusionRetentionDays) {
        const now = Date.now();
        let deleted = 0;
        const tables = [
            ["messages", "created_at", retentionDays],
            ["summaries", "created_at", summaryRetentionDays],
            ["conclusions", "created_at", conclusionRetentionDays],
            ["observations", "created_at", retentionDays],
        ];
        for (const [table, field, days] of tables) {
            if (days > 0) {
                const cutoff = now - days * 24 * 60 * 60 * 1000;
                const result = this.db.prepare(`DELETE FROM ${table} WHERE ${field} < ?`).run(cutoff);
                deleted += result.changes;
            }
        }
        return { deleted };
    }
    // Export/Import
    exportAll(workspaceId) {
        const workspace = this.getWorkspace(workspaceId);
        const peers = this.getAllPeers(workspaceId);
        const conclusions = this.getAllConclusions(workspaceId);
        const summaries = this.getSummaries(workspaceId, "", 10000);
        const observations = this.getObservations(workspaceId, "", 10000);
        const peerCards = this.db.prepare("SELECT * FROM peer_cards WHERE workspace_id = ?").all(workspaceId).map((r) => ({
            peerId: r.peer_id, name: r.name, occupation: r.occupation,
            interests: JSON.parse(r.interests || "[]"), traits: JSON.parse(r.traits || "[]"),
            goals: JSON.parse(r.goals || "[]"), updatedAt: r.updated_at,
        }));
        return { version: "1.0.0", exportedAt: Date.now(), workspace, peers, conclusions, summaries, observations, peerCards };
    }
    importAll(workspaceId, data, merge = true) {
        if (!merge) {
            ["conclusions", "summaries", "observations", "peer_cards"].forEach((t) => this.db.prepare(`DELETE FROM ${t} WHERE workspace_id = ?`).run(workspaceId));
        }
        data.peerCards?.forEach((c) => this.savePeerCard(workspaceId, c));
        data.conclusions?.forEach((c) => this.saveConclusion(workspaceId, c));
        data.summaries?.forEach((s) => this.saveSummary(workspaceId, s));
        data.observations?.forEach((o) => this.saveObservation(o));
    }
    // Helpers
    getOrCreateWorkspace(id, name = "Default Workspace") {
        let ws = this.getWorkspace(id);
        if (!ws) {
            ws = { id, name, createdAt: Date.now(), config: { reasoningEnabled: true, tokenBatchSize: 1000 } };
            this.saveWorkspace(ws);
        }
        return ws;
    }
    getOrCreatePeer(workspaceId, id, name, type = "user") {
        let peer = this.getPeer(workspaceId, id);
        if (!peer) {
            peer = { id, name, type, createdAt: Date.now(), metadata: {} };
            this.savePeer(workspaceId, peer);
        }
        return peer;
    }
    getOrCreateSession(workspaceId, id, peerIds = []) {
        let session = this.getSession(workspaceId, id);
        if (!session) {
            session = { id, workspaceId, peerIds, messageCount: 0, createdAt: Date.now(), updatedAt: Date.now(), config: { observeMe: true, observeOthers: true }, tags: [] };
            this.saveSession(workspaceId, session);
        }
        return session;
    }
    close() { this.db.close(); }
}
//# sourceMappingURL=store.js.map