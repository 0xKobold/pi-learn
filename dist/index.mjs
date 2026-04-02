// src/index.ts
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// src/core/store.ts
import initSqlJs from "sql.js";

// src/shared.ts
var DEFAULT_RETENTION = {
  retentionDays: 0,
  summaryRetentionDays: 30,
  conclusionRetentionDays: 90,
  pruneOnStartup: true,
  pruneIntervalHours: 24
};
var DEFAULT_DREAM = {
  enabled: true,
  intervalMs: 60 * 60 * 1000,
  minMessagesSinceLastDream: 5,
  batchSize: 50
};
var DEFAULT_TOKEN_BATCH_SIZE = 1000;
var DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v2-moe:latest";
var DEFAULT_REASONING_MODEL = "qwen3.5:latest";
var GLOBAL_WORKSPACE_ID = "__global__";
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimension");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0;i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
function generateId(prefix = "") {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// src/core/store.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
async function createStore(dbPath) {
  return new SQLiteStore(dbPath);
}

class SQLiteStore {
  db = null;
  dbPath;
  saveTimer = null;
  constructor(dbPath) {
    this.dbPath = dbPath;
  }
  async init() {
    const SQL = await initSqlJs();
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database;
    }
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = OFF");
    this.initTables();
    this.migrate();
    this.verifyAndFixSchema();
    this.scheduleSave();
  }
  scheduleSave() {
    if (this.saveTimer)
      clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDisk(), 5000);
  }
  saveToDisk() {
    if (!this.db)
      return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error("[Store] Error saving database to disk:", err);
    }
  }
  run(sql, params = []) {
    if (!this.db)
      throw new Error("Database not initialized");
    this.db.run(sql, params);
    this.scheduleSave();
  }
  exec(sql) {
    if (!this.db)
      throw new Error("Database not initialized");
    this.db.exec(sql);
    this.scheduleSave();
  }
  prepare(sql) {
    if (!this.db)
      throw new Error("Database not initialized");
    return this.db.prepare(sql);
  }
  getOne(sql, params = []) {
    if (!this.db)
      throw new Error("Database not initialized");
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }
  getAll(sql, params = []) {
    if (!this.db)
      throw new Error("Database not initialized");
    const results = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
  initTables() {
    this.exec(`
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
        scope TEXT NOT NULL DEFAULT 'project',
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

      CREATE TABLE IF NOT EXISTS dream_metadata (
        workspace_id TEXT PRIMARY KEY,
        last_dreamed_at INTEGER NOT NULL DEFAULT 0,
        dream_count INTEGER NOT NULL DEFAULT 0,
        last_dream_messages INTEGER NOT NULL DEFAULT 0,
        last_dream_conclusions INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
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
    try {
      const columns = this.getAll("PRAGMA table_info(sessions)");
      const hasTags = columns.some((c) => c.name === "tags");
      if (!hasTags) {
        this.exec("ALTER TABLE sessions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
      }
    } catch {}
    try {
      const columns = this.getAll("PRAGMA table_info(observations)");
      const hasAboutPeerId = columns.some((c) => c.name === "about_peer_id");
      if (!hasAboutPeerId) {
        this.exec("ALTER TABLE observations ADD COLUMN about_peer_id TEXT");
      }
    } catch {}
    try {
      const columns = this.getAll("PRAGMA table_info(messages)");
      const hasMetadata = columns.some((c) => c.name === "metadata");
      if (!hasMetadata) {
        this.exec("ALTER TABLE messages ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");
      }
    } catch {}
    try {
      const columns = this.getAll("PRAGMA table_info(conclusions)");
      const hasScope = columns.some((c) => c.name === "scope");
      if (!hasScope) {
        this.exec("ALTER TABLE conclusions ADD COLUMN scope TEXT NOT NULL DEFAULT 'project'");
      }
    } catch {}
  }
  verifyAndFixSchema() {
    const requiredColumns = {
      sessions: ["tags"],
      observations: ["about_peer_id"],
      messages: ["metadata"],
      conclusions: ["scope"]
    };
    const requiredIndexes = {
      observations: [
        { name: "idx_observations_about", columns: ["about_peer_id", "workspace_id"] }
      ],
      conclusions: [
        { name: "idx_conclusions_scope", columns: ["scope", "workspace_id"] }
      ]
    };
    for (const [table, requiredCols] of Object.entries(requiredColumns)) {
      try {
        const columns = this.getAll(`PRAGMA table_info(${table})`);
        const columnNames = new Set(columns.map((c) => c.name));
        for (const col of requiredCols) {
          if (!columnNames.has(col)) {
            console.warn(`[Store] Missing column '${col}' in '${table}' table. Adding...`);
            this.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
            console.log(`[Store] Added column '${col}' to '${table}' table.`);
          }
        }
      } catch (err) {
        console.error(`[Store] Error verifying columns for '${table}':`, err);
      }
    }
    for (const [table, requiredIdxs] of Object.entries(requiredIndexes)) {
      try {
        const existingIndexes = this.getAll(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}'`);
        const indexNames = new Set(existingIndexes.map((i) => i.name));
        for (const idx of requiredIdxs) {
          if (!indexNames.has(idx.name)) {
            console.warn(`[Store] Missing index '${idx.name}' on '${table}' table. Creating...`);
            this.exec(`CREATE INDEX ${idx.name} ON ${table}(${idx.columns.join(", ")})`);
            console.log(`[Store] Created index '${idx.name}' on '${table}' table.`);
          }
        }
      } catch (err) {
        console.error(`[Store] Error verifying indexes for '${table}':`, err);
      }
    }
  }
  getWorkspace(id) {
    const row = this.getOne("SELECT * FROM workspaces WHERE id = ?", [id]);
    if (!row)
      return null;
    return { id: row.id, name: row.name, createdAt: row.created_at, config: JSON.parse(row.config || "{}") };
  }
  saveWorkspace(workspace) {
    this.run(`INSERT OR REPLACE INTO workspaces (id, name, created_at, config) VALUES (?, ?, ?, ?)`, [workspace.id, workspace.name, workspace.createdAt, JSON.stringify(workspace.config)]);
  }
  getPeer(workspaceId, peerId) {
    const row = this.getOne("SELECT * FROM peers WHERE id = ? AND workspace_id = ?", [peerId, workspaceId]);
    if (!row)
      return null;
    return { id: row.id, name: row.name, type: row.type, createdAt: row.created_at, metadata: JSON.parse(row.metadata || "{}") };
  }
  savePeer(workspaceId, peer) {
    this.run(`INSERT OR REPLACE INTO peers (id, workspace_id, name, type, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)`, [peer.id, workspaceId, peer.name, peer.type, peer.createdAt, JSON.stringify(peer.metadata)]);
  }
  getAllPeers(workspaceId) {
    const rows = this.getAll("SELECT * FROM peers WHERE workspace_id = ?", [workspaceId]);
    return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, createdAt: r.created_at, metadata: JSON.parse(r.metadata || "{}") }));
  }
  getSession(workspaceId, sessionId) {
    const row = this.getOne("SELECT * FROM sessions WHERE id = ? AND workspace_id = ?", [sessionId, workspaceId]);
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
    this.run(`INSERT OR REPLACE INTO sessions (id, workspace_id, peer_ids, message_count, created_at, updated_at, config, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [session.id, workspaceId, JSON.stringify(session.peerIds), session.messageCount, session.createdAt, session.updatedAt, JSON.stringify(session.config), JSON.stringify(session.tags || [])]);
  }
  getAllSessions(workspaceId) {
    const rows = this.getAll("SELECT * FROM sessions WHERE workspace_id = ? ORDER BY created_at DESC", [workspaceId]);
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
  tagSession(workspaceId, sessionId, tags) {
    const session = this.getSession(workspaceId, sessionId);
    if (!session)
      return;
    const existingTags = new Set(session.tags || []);
    tags.forEach((t) => existingTags.add(t));
    session.tags = Array.from(existingTags);
    session.updatedAt = Date.now();
    this.saveSession(workspaceId, session);
  }
  untagSession(workspaceId, sessionId, tags) {
    const session = this.getSession(workspaceId, sessionId);
    if (!session)
      return;
    const tagSet = new Set(tags);
    session.tags = (session.tags || []).filter((t) => !tagSet.has(t));
    session.updatedAt = Date.now();
    this.saveSession(workspaceId, session);
  }
  getSessionsByTag(workspaceId, tag, limit = 20) {
    const rows = this.getAll("SELECT * FROM sessions WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?", [workspaceId, limit]);
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      peerIds: JSON.parse(r.peer_ids),
      messageCount: r.message_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      config: JSON.parse(r.config || "{}"),
      tags: JSON.parse(r.tags || "[]")
    })).filter((s) => s.tags.includes(tag));
  }
  getAllTags(workspaceId) {
    const sessions = this.getAllSessions(workspaceId);
    const tagCounts = new Map;
    for (const session of sessions) {
      for (const tag of session.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }
  saveMessage(workspaceId, message) {
    this.run(`INSERT INTO messages (id, session_id, workspace_id, peer_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [message.id, message.sessionId, workspaceId, message.peerId, message.role, message.content, JSON.stringify(message.metadata || {}), message.createdAt]);
  }
  saveMessagesBatch(workspaceId, messages) {
    for (const msg of messages) {
      this.run(`INSERT INTO messages (id, session_id, workspace_id, peer_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [msg.id, msg.sessionId, workspaceId, msg.peerId, msg.role, msg.content, JSON.stringify(msg.metadata || {}), msg.createdAt]);
    }
    return messages.length;
  }
  getMessages(workspaceId, sessionId, limit = 100) {
    return this.getAll("SELECT * FROM messages WHERE session_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?", [sessionId, workspaceId, limit]);
  }
  getRecentMessages(workspaceId, peerId, limit = 50) {
    return this.getAll("SELECT * FROM messages WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?", [peerId, workspaceId, limit]);
  }
  saveConclusion(workspaceId, conclusion) {
    this.run(`INSERT OR REPLACE INTO conclusions (id, peer_id, workspace_id, type, content, premises, confidence, created_at, source_session_id, embedding, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [conclusion.id, conclusion.peerId, workspaceId, conclusion.type, conclusion.content, JSON.stringify(conclusion.premises), conclusion.confidence, conclusion.createdAt, conclusion.sourceSessionId, conclusion.embedding ? JSON.stringify(conclusion.embedding) : null, conclusion.scope || "project"]);
  }
  getConclusions(workspaceId, peerId, limit = 10, scope) {
    let sql = "SELECT * FROM conclusions WHERE peer_id = ? AND workspace_id = ?";
    const params = [peerId, workspaceId];
    if (scope) {
      sql += " AND scope = ?";
      params.push(scope);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    const rows = this.getAll(sql, params);
    return rows.map((r) => ({
      id: r.id,
      peerId: r.peer_id,
      type: r.type,
      content: r.content,
      premises: JSON.parse(r.premises || "[]"),
      confidence: r.confidence,
      createdAt: r.created_at,
      sourceSessionId: r.source_session_id,
      embedding: r.embedding ? JSON.parse(r.embedding) : undefined,
      scope: r.scope || "project"
    }));
  }
  getAllConclusions(workspaceId, peerId, scope) {
    if (peerId) {
      return this.getConclusions(workspaceId, peerId, 1e4, scope);
    }
    let sql = "SELECT * FROM conclusions WHERE workspace_id = ?";
    const params = [workspaceId];
    if (scope) {
      sql += " AND scope = ?";
      params.push(scope);
    }
    sql += " ORDER BY created_at DESC";
    const rows = this.getAll(sql, params);
    return rows.map((r) => ({
      id: r.id,
      peerId: r.peer_id,
      type: r.type,
      content: r.content,
      premises: JSON.parse(r.premises || "[]"),
      confidence: r.confidence,
      createdAt: r.created_at,
      sourceSessionId: r.source_session_id,
      embedding: r.embedding ? JSON.parse(r.embedding) : undefined,
      scope: r.scope || "project"
    }));
  }
  getGlobalConclusions(peerId, limit = 100) {
    return this.getConclusions(GLOBAL_WORKSPACE_ID, peerId, limit, "user");
  }
  getAllGlobalConclusions(peerId) {
    return this.getAllConclusions(GLOBAL_WORKSPACE_ID, peerId, "user");
  }
  saveSummary(workspaceId, summary) {
    this.run(`INSERT INTO summaries (id, session_id, peer_id, workspace_id, type, content, message_count, created_at, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [summary.id, summary.sessionId, summary.peerId, workspaceId, summary.type, summary.content, summary.messageCount, summary.createdAt, summary.embedding ? JSON.stringify(summary.embedding) : null]);
  }
  getSummaries(workspaceId, peerId, limit = 10) {
    const rows = this.getAll("SELECT * FROM summaries WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?", [peerId, workspaceId, limit]);
    return rows.map((r) => ({ id: r.id, sessionId: r.session_id, peerId: r.peer_id, type: r.type, content: r.content, messageCount: r.message_count, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined }));
  }
  getPeerCard(workspaceId, peerId) {
    const row = this.getOne("SELECT * FROM peer_cards WHERE peer_id = ? AND workspace_id = ?", [peerId, workspaceId]);
    if (!row)
      return null;
    return { peerId: row.peer_id, name: row.name, occupation: row.occupation, interests: JSON.parse(row.interests || "[]"), traits: JSON.parse(row.traits || "[]"), goals: JSON.parse(row.goals || "[]"), updatedAt: row.updated_at };
  }
  savePeerCard(workspaceId, card) {
    this.run(`INSERT OR REPLACE INTO peer_cards (peer_id, workspace_id, name, occupation, interests, traits, goals, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [card.peerId, workspaceId, card.name || null, card.occupation || null, JSON.stringify(card.interests), JSON.stringify(card.traits), JSON.stringify(card.goals), card.updatedAt]);
  }
  saveObservation(observation) {
    this.run(`INSERT INTO observations (id, peer_id, about_peer_id, session_id, workspace_id, role, content, created_at, embedding, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [observation.id, observation.peerId, observation.aboutPeerId || null, observation.sessionId, observation.workspaceId, observation.role, observation.content, observation.createdAt, observation.embedding ? JSON.stringify(observation.embedding) : null, observation.processed ? 1 : 0]);
  }
  addObservation = this.saveObservation;
  getObservations(workspaceId, peerId, limit = 100) {
    const rows = this.getAll("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?", [peerId, workspaceId, limit]);
    return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id || undefined, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
  }
  getObservationsForPeer(workspaceId, observerPeerId, limit = 100) {
    const rows = this.getAll("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? AND about_peer_id IS NOT NULL ORDER BY created_at DESC LIMIT ?", [observerPeerId, workspaceId, limit]);
    return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
  }
  getObservationsAboutPeer(workspaceId, targetPeerId, limit = 100) {
    const rows = this.getAll("SELECT * FROM observations WHERE about_peer_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?", [targetPeerId, workspaceId, limit]);
    return rows.map((r) => ({ id: r.id, peerId: r.peer_id, aboutPeerId: r.about_peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: r.processed === 1 }));
  }
  getUnprocessedObservations(workspaceId, peerId, limit = 50) {
    const rows = this.getAll("SELECT * FROM observations WHERE peer_id = ? AND workspace_id = ? AND processed = 0 ORDER BY created_at ASC LIMIT ?", [peerId, workspaceId, limit]);
    return rows.map((r) => ({ id: r.id, peerId: r.peer_id, sessionId: r.session_id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, embedding: r.embedding ? JSON.parse(r.embedding) : undefined, processed: false }));
  }
  markObservationsProcessed(observationIds) {
    if (observationIds.length === 0)
      return;
    const placeholders = observationIds.map(() => "?").join(",");
    this.run(`UPDATE observations SET processed = 1 WHERE id IN (${placeholders})`, observationIds);
  }
  searchObservations(workspaceId, peerId, query, limit = 20) {
    const observations = this.getObservations(workspaceId, peerId, 100);
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
    if (queryWords.length === 0) {
      return observations.slice(0, limit).map((o) => ({ ...o, relevance: 1 }));
    }
    const scored = observations.map((obs) => {
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
    return scored.filter((o) => o.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }
  searchObservationsByEmbedding(workspaceId, peerId, queryEmbedding, limit = 20) {
    const observations = this.getObservations(workspaceId, peerId, 100);
    const scored = observations.filter((o) => o.embedding && o.embedding.length > 0).map((obs) => {
      const similarity = cosineSimilarity(queryEmbedding, obs.embedding);
      return { ...obs, relevance: similarity };
    });
    return scored.filter((o) => o.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }
  getRepresentation(workspaceId, peerId, includeGlobal = true) {
    const conclusions = this.getConclusions(workspaceId, peerId, 100);
    const summaries = this.getSummaries(workspaceId, peerId, 10);
    const peerCard = this.getPeerCard(workspaceId, peerId);
    const observations = this.getObservations(workspaceId, peerId, 50);
    const lastConclusion = conclusions[0];
    return { peerId, conclusions, summaries, peerCard, observations, lastReasonedAt: lastConclusion?.createdAt || 0 };
  }
  getBlendedRepresentation(workspaceId, peerId) {
    const local = this.getRepresentation(workspaceId, peerId, false);
    const global = this.getRepresentation(GLOBAL_WORKSPACE_ID, peerId, false);
    const blendedConclusions = [
      ...local?.conclusions || [],
      ...global?.conclusions || []
    ];
    return {
      local,
      global,
      blendedConclusions
    };
  }
  searchSessions(workspaceId, query, limit = 10) {
    const rows = this.getAll(`SELECT DISTINCT s.id, s.created_at, m.content
       FROM sessions s
       JOIN messages m ON m.session_id = s.id AND m.workspace_id = s.workspace_id
       WHERE s.workspace_id = ? AND m.content LIKE ?
       ORDER BY s.created_at DESC
       LIMIT ?`, [workspaceId, `%${query}%`, limit]);
    return rows.map((r) => ({
      sessionId: r.id,
      createdAt: r.created_at,
      snippet: r.content.slice(0, 150).replace(/\n/g, " ") + (r.content.length > 150 ? "..." : ""),
      relevance: 1
    }));
  }
  prune(retentionDays, summaryRetentionDays, conclusionRetentionDays) {
    const now = Date.now();
    let deleted = 0;
    const tables = [
      ["messages", "created_at", retentionDays],
      ["summaries", "created_at", summaryRetentionDays],
      ["conclusions", "created_at", conclusionRetentionDays],
      ["observations", "created_at", retentionDays]
    ];
    for (const [table, field, days] of tables) {
      if (days > 0) {
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        this.run(`DELETE FROM ${table} WHERE ${field} < ?`, [cutoff]);
        deleted++;
      }
    }
    return { deleted };
  }
  exportAll(workspaceId) {
    const workspace = this.getWorkspace(workspaceId);
    const peers = this.getAllPeers(workspaceId);
    const conclusions = this.getAllConclusions(workspaceId);
    const summaries = this.getSummaries(workspaceId, "", 1e4);
    const observations = this.getObservations(workspaceId, "", 1e4);
    const peerCards = this.getAll("SELECT * FROM peer_cards WHERE workspace_id = ?", [workspaceId]).map((r) => ({
      peerId: r.peer_id,
      name: r.name,
      occupation: r.occupation,
      interests: JSON.parse(r.interests || "[]"),
      traits: JSON.parse(r.traits || "[]"),
      goals: JSON.parse(r.goals || "[]"),
      updatedAt: r.updated_at
    }));
    return { version: "1.0.0", exportedAt: Date.now(), workspace, peers, conclusions, summaries, observations, peerCards };
  }
  importAll(workspaceId, data, merge = true) {
    if (!merge) {
      ["conclusions", "summaries", "observations", "peer_cards"].forEach((t) => this.run(`DELETE FROM ${t} WHERE workspace_id = ?`, [workspaceId]));
    }
    data.peerCards?.forEach((c) => this.savePeerCard(workspaceId, c));
    data.conclusions?.forEach((c) => this.saveConclusion(workspaceId, c));
    data.summaries?.forEach((s) => this.saveSummary(workspaceId, s));
    data.observations?.forEach((o) => this.saveObservation(o));
  }
  getDreamMetadata(workspaceId) {
    const row = this.getOne("SELECT * FROM dream_metadata WHERE workspace_id = ?", [workspaceId]);
    if (!row) {
      return { lastDreamedAt: 0, dreamCount: 0, lastDreamMessages: 0, lastDreamConclusions: 0 };
    }
    return {
      lastDreamedAt: row.last_dreamed_at,
      dreamCount: row.dream_count,
      lastDreamMessages: row.last_dream_messages,
      lastDreamConclusions: row.last_dream_conclusions
    };
  }
  updateDreamMetadata(workspaceId, messageCount, conclusionCount) {
    this.run(`INSERT INTO dream_metadata (workspace_id, last_dreamed_at, dream_count, last_dream_messages, last_dream_conclusions) 
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET 
         last_dreamed_at = excluded.last_dreamed_at,
         dream_count = dream_count + 1,
         last_dream_messages = excluded.last_dream_messages,
         last_dream_conclusions = excluded.last_dream_conclusions`, [workspaceId, Date.now(), messageCount, conclusionCount]);
  }
  getOrCreateWorkspace(id, name = "Default Workspace") {
    let ws = this.getWorkspace(id);
    if (!ws) {
      ws = { id, name, createdAt: Date.now(), config: { reasoningEnabled: true, tokenBatchSize: 1000 } };
      this.saveWorkspace(ws);
    }
    return ws;
  }
  ensureGlobalWorkspace() {
    return this.getOrCreateWorkspace(GLOBAL_WORKSPACE_ID, "Global (Cross-Project)");
  }
  ensureGlobalPeer(peerId, name) {
    this.ensureGlobalWorkspace();
    return this.getOrCreatePeer(GLOBAL_WORKSPACE_ID, peerId, name, "user");
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
  close() {
    if (this.saveTimer)
      clearTimeout(this.saveTimer);
    this.saveToDisk();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// src/core/reasoning.ts
var DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 2000,
  timeoutMs: 120000,
  maxBackoffMs: 30000
};
function createReasoningEngine(config) {
  return new ReasoningEngine(config);
}

class ReasoningEngine {
  config;
  messageQueue = [];
  isProcessing = false;
  maxRetries;
  retryDelayMs;
  timeoutMs;
  maxBackoffMs;
  concurrency;
  activeRequests = 0;
  requestQueue = [];
  lastProcessedAt = 0;
  constructor(config) {
    this.config = config;
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.maxRetries = retryConfig.maxRetries;
    this.retryDelayMs = retryConfig.retryDelayMs;
    this.timeoutMs = retryConfig.timeoutMs;
    this.maxBackoffMs = retryConfig.maxBackoffMs ?? DEFAULT_RETRY_CONFIG.maxBackoffMs;
    this.concurrency = config.concurrency ?? 1;
  }
  queue(item) {
    this.messageQueue.push(item);
    const oldestWaitMs = Date.now() - this.messageQueue[0]?.queuedAt;
    const shouldProcess = this.messageQueue.length >= 3 || oldestWaitMs > 30000 || !this.isProcessing;
    if (shouldProcess && !this.isProcessing) {
      setImmediate(() => this.processQueue());
    }
  }
  getQueueSize() {
    return this.messageQueue.length;
  }
  isReasoning() {
    return this.isProcessing;
  }
  async generateEmbedding(text) {
    const response = await this.callOllama("/api/embeddings", { model: this.config.embeddingModel, prompt: text });
    return response.embedding;
  }
  async reason(messages, _peerId, context) {
    const prompt = this.buildReasoningPrompt(messages, context);
    const content = await this.callOllamaChat(prompt);
    return this.parseReasoningOutput(content);
  }
  async dream(messages, existingConclusions, context) {
    const prompt = this.buildDreamPrompt(messages, existingConclusions, context);
    const content = await this.callOllamaChat(prompt);
    return this.parseDreamOutput(content);
  }
  async callOllamaChat(prompt) {
    const response = await this.callOllama("/api/chat", {
      model: this.config.reasoningModel,
      messages: [{ role: "user", content: prompt }],
      stream: false
    });
    return response.message?.content ?? response.choices?.[0]?.message?.content ?? "";
  }
  async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0)
      return;
    this.isProcessing = true;
    try {
      while (this.messageQueue.length > 0) {
        const item = this.messageQueue.shift();
        try {
          await this.reason(item.messages, item.peerId);
        } catch (error) {
          console.error(`[ReasoningEngine] Failed to process queued item: ${error}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  async callOllama(endpoint, body) {
    await this.acquireSemaphore();
    let lastError = null;
    try {
      for (let attempt = 1;attempt <= this.maxRetries; attempt++) {
        try {
          const controller = new AbortController;
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
          try {
            const response = await fetch(`${this.config.ollamaBaseUrl}${endpoint}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...this.config.ollamaApiKey && { Authorization: `Bearer ${this.config.ollamaApiKey}` } },
              body: JSON.stringify(body),
              signal: controller.signal
            });
            if (!response.ok) {
              throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const classifiedError = this.classifyError(lastError);
          if (attempt < this.maxRetries) {
            const backoffMs = this.calculateBackoff(attempt);
            console.warn(`[ReasoningEngine] Attempt ${attempt} failed: ${classifiedError}. Retrying in ${Math.round(backoffMs)}ms...`);
            await this.sleep(backoffMs);
          }
        }
      }
      throw new Error(`[ReasoningEngine] All ${this.maxRetries} attempts failed. Last error: ${this.classifyError(lastError)}`);
    } finally {
      this.releaseSemaphore();
    }
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  calculateBackoff(attempt) {
    const exponential = Math.min(this.retryDelayMs * Math.pow(2, attempt - 1), this.maxBackoffMs);
    const jitter = Math.random() * 1000;
    return exponential + jitter;
  }
  classifyError(error) {
    if (error.name === "AbortError" || error.message.includes("aborted")) {
      return `Request timeout after ${this.timeoutMs}ms - Ollama may be overloaded or slow`;
    }
    if (error.message.includes("fetch") && error.message.includes("network")) {
      return `Network error - check Ollama connectivity: ${error.message}`;
    }
    return error.message;
  }
  async acquireSemaphore() {
    if (this.activeRequests < this.concurrency) {
      this.activeRequests++;
      return;
    }
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
      this.activeRequests++;
    });
  }
  releaseSemaphore() {
    this.activeRequests--;
    const next = this.requestQueue.shift();
    if (next) {
      this.activeRequests++;
      next();
    }
  }
  buildReasoningPrompt(messages, context) {
    const formatted = messages.map((m) => `[${m.role}] ${m.content}`).join(`

`);
    let contextStr = "";
    if (context) {
      if (context.globalPeerCard) {
        const card = context.globalPeerCard;
        contextStr += `

## Known User Profile (Global)
`;
        if (card.name)
          contextStr += `- Name: ${card.name}
`;
        if (card.occupation)
          contextStr += `- Occupation: ${card.occupation}
`;
        if (card.interests.length)
          contextStr += `- Interests: ${card.interests.join(", ")}
`;
        if (card.traits.length)
          contextStr += `- Traits: ${card.traits.join(", ")}
`;
        if (card.goals.length)
          contextStr += `- Goals: ${card.goals.join(", ")}
`;
      }
      if (context.globalConclusions?.length) {
        contextStr += `

## Cross-Project Insights
`;
        context.globalConclusions.slice(0, 5).forEach((c) => {
          contextStr += `- [${c.type}] ${c.content}
`;
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
  parseReasoningOutput(text) {
    const conclusions = [];
    const blocks = text.split(/(?=SCOPE:)/i).filter(Boolean);
    for (const block of blocks) {
      const scopeMatch = block.match(/SCOPE:\s*(\w+)/i);
      const typeMatch = block.match(/Type:\s*(\w+)/i);
      const contentMatch = block.match(/Content:\s*(.+?)(?=Premises:|Confidence:|$)/s);
      const premisesMatch = block.match(/Premises:\s*(.+?)(?=Confidence:|Type:|SCOPE:|$)/s);
      const confidenceMatch = block.match(/Confidence:\s*([\d.]+)/);
      if (scopeMatch && contentMatch) {
        const scope = scopeMatch[1].toLowerCase() || "project";
        const type = typeMatch?.[1] || "inductive";
        const content = contentMatch[1].trim();
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
        let premises = [];
        if (premisesMatch) {
          premises = premisesMatch[1].split(/[,;]/).map((p) => p.trim()).filter(Boolean);
        }
        conclusions.push({ content, type, premises, scope, confidence });
      }
    }
    if (conclusions.length === 0) {
      const legacyBlocks = text.split(/CONCLUSION:/i).filter(Boolean);
      for (const block of legacyBlocks) {
        const typeMatch = block.match(/Type:\s*(\w+)/i);
        const contentMatch = block.match(/Content:\s*(.+?)(?=Premises:|$)/s);
        if (contentMatch) {
          conclusions.push({
            content: contentMatch[1].trim(),
            type: typeMatch?.[1] || "inductive",
            premises: [],
            scope: "project",
            confidence: 0.5
          });
        }
      }
    }
    const explicit = conclusions.map((c) => ({ content: c.content, scope: c.scope }));
    const deductive = conclusions.filter((c) => c.type === "deductive").map((c) => ({ premises: c.premises, conclusion: c.content, scope: c.scope }));
    return { explicit, deductive, conclusions };
  }
  buildDreamPrompt(messages, existingConclusions, context) {
    const recent = messages.slice(-50).map((m) => `[${m.role}] ${m.content}`).join(`
`);
    const userConclusions = existingConclusions.filter((c) => c.scope === "user");
    const projectConclusions = existingConclusions.filter((c) => c.scope === "project");
    let contextStr = "";
    if (context?.globalPeerCard) {
      const card = context.globalPeerCard;
      contextStr += `

## Known User Profile
`;
      if (card.name)
        contextStr += `- Name: ${card.name}
`;
      if (card.interests.length)
        contextStr += `- Interests: ${card.interests.join(", ")}
`;
      if (card.traits.length)
        contextStr += `- Traits: ${card.traits.join(", ")}
`;
      if (card.goals.length)
        contextStr += `- Goals: ${card.goals.join(", ")}
`;
    }
    return `You are dreaming - consolidating memories and generating new insights.

Recent messages:
${recent}
${contextStr}

Prior conclusions by scope:
## Cross-Project (user scope):
${userConclusions.slice(0, 10).map((c) => `- [${c.type}] ${c.content}`).join(`
`) || "None"}

## Project-Specific (project scope):
${projectConclusions.slice(0, 10).map((c) => `- [${c.type}] ${c.content}`).join(`
`) || "None"}

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
  parseDreamOutput(text) {
    const newConclusions = [];
    const updatedPatterns = [];
    const newMatch = text.match(/NEW_CONCLUSIONS:(.+?)(?=UPDATED_PATTERNS:|$)/si);
    if (newMatch) {
      const conclusionBlocks = newMatch[1].split(/(?=^\s*SCOPE:)/m).filter(Boolean);
      for (const block of conclusionBlocks) {
        const scopeMatch = block.match(/SCOPE:\s*(\w+)/i);
        const typeMatch = block.match(/Type:\s*(\w+)/i);
        const contentMatch = block.match(/Content:\s*(.+?)(?=$)/s);
        if (scopeMatch && contentMatch) {
          const scope = scopeMatch[1].toLowerCase() || "project";
          const type = typeMatch?.[1]?.toLowerCase() || "inductive";
          const content = contentMatch[1].trim();
          if (content && content.length > 5) {
            newConclusions.push({
              type,
              content,
              premises: [],
              confidence: 0.6,
              scope
            });
          }
        }
      }
    }
    if (newConclusions.length === 0) {
      const lines = text.split(`
`).filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(/-\s*(deductive|inductive|abductive)[\s:]+(.+)/i);
        if (match) {
          newConclusions.push({
            type: match[1].toLowerCase(),
            content: match[2].trim(),
            premises: [],
            confidence: 0.6,
            scope: "project"
          });
        }
      }
    }
    const updatedMatch = text.match(/UPDATED_PATTERNS:(.+?)$/si);
    if (updatedMatch) {
      const lines = updatedMatch[1].split(`
`).filter((l) => l.includes(":"));
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

// src/core/context.ts
function createContextAssembler(store) {
  return new ContextAssembler(store);
}

class ContextAssembler {
  store;
  constructor(store) {
    this.store = store;
  }
  assembleContext(workspaceId, peerId) {
    const blended = this.getBlendedContext(workspaceId, peerId);
    return blended.assembledString;
  }
  getBlendedContext(workspaceId, peerId) {
    const localRep = this.store.getRepresentation(workspaceId, peerId, false);
    const globalRep = this.store.getRepresentation(GLOBAL_WORKSPACE_ID, peerId, false);
    const assembledString = this.buildBlendedContextString(globalRep, localRep);
    const blendedConclusions = [
      ...localRep?.conclusions || [],
      ...globalRep?.conclusions || []
    ];
    return {
      global: {
        peerCard: globalRep?.peerCard || null,
        conclusions: globalRep?.conclusions || []
      },
      project: {
        peerCard: localRep?.peerCard || null,
        conclusions: localRep?.conclusions || [],
        summaries: localRep?.summaries || [],
        observations: (localRep?.observations || []).filter((o) => !o.processed).slice(0, 5).map((o) => ({ role: o.role, content: o.content, processed: o.processed }))
      },
      blendedConclusions,
      assembledString
    };
  }
  getGlobalContext(peerId) {
    const rep = this.store.getRepresentation(GLOBAL_WORKSPACE_ID, peerId, false);
    if (!rep)
      return null;
    return this.buildGlobalContextString(rep);
  }
  getProjectContext(workspaceId, peerId) {
    const rep = this.store.getRepresentation(workspaceId, peerId, false);
    if (!rep)
      return null;
    return this.buildProjectContextString(rep);
  }
  async searchSimilar(workspaceId, peerId, query, topK = 5, minSimilarity = 0, searchGlobal = true) {
    const localConclusions = this.store.getConclusions(workspaceId, peerId, 100);
    const globalConclusions = searchGlobal ? this.store.getGlobalConclusions(peerId, 100) : [];
    const allConclusions = [
      ...localConclusions.map((c) => ({ ...c, scope: "project" })),
      ...globalConclusions.map((c) => ({ ...c, scope: "user" }))
    ];
    if (!allConclusions.length)
      return [];
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = allConclusions.map((c) => {
      let confidence;
      if (c.embedding && c.embedding.length > 0) {
        const contentWords = c.content.toLowerCase().split(/\s+/);
        const overlap = queryWords.filter((w) => contentWords.some((cw) => cw.includes(w) || w.includes(cw))).length;
        const keywordScore = overlap / Math.max(queryWords.length, 1);
        confidence = keywordScore * 0.6 + (c.embedding ? 0.4 : 0);
      } else {
        const contentWords = c.content.toLowerCase().split(/\s+/);
        const overlap = queryWords.filter((w) => contentWords.some((cw) => cw.includes(w) || w.includes(cw))).length;
        confidence = overlap / Math.max(queryWords.length, 1);
      }
      return { ...c, confidence };
    });
    return scored.filter((c) => c.confidence >= minSimilarity).sort((a, b) => b.confidence - a.confidence).slice(0, topK);
  }
  getConclusionsByType(workspaceId, peerId, type, scope) {
    if (scope === "user") {
      return this.store.getGlobalConclusions(peerId, 100).filter((c) => c.type === type);
    }
    return this.store.getConclusions(workspaceId, peerId, 100).filter((c) => c.type === type);
  }
  getSummaries(workspaceId, peerId, limit = 10) {
    return this.store.getSummaries(workspaceId, peerId, limit);
  }
  getMemoryStats(workspaceId, peerId) {
    const rep = this.store.getRepresentation(workspaceId, peerId, false);
    const globalRep = this.store.getRepresentation(GLOBAL_WORKSPACE_ID, peerId, false);
    if (!rep) {
      return {
        conclusionCount: 0,
        summaryCount: 0,
        globalConclusionCount: globalRep?.conclusions.length || 0,
        hasPeerCard: false,
        hasGlobalPeerCard: !!globalRep?.peerCard,
        lastReasonedAt: null,
        topInterests: globalRep?.peerCard?.interests?.slice(0, 5) || [],
        topTraits: globalRep?.peerCard?.traits?.slice(0, 5) || []
      };
    }
    const card = rep.peerCard;
    const globalCard = globalRep?.peerCard;
    const allInterests = [...card?.interests || [], ...globalCard?.interests || []];
    const allTraits = [...card?.traits || [], ...globalCard?.traits || []];
    const uniqueInterests = [...new Set(allInterests)];
    const uniqueTraits = [...new Set(allTraits)];
    return {
      conclusionCount: rep.conclusions.length,
      summaryCount: rep.summaries.length,
      globalConclusionCount: globalRep?.conclusions.length || 0,
      hasPeerCard: !!card,
      hasGlobalPeerCard: !!globalCard,
      lastReasonedAt: rep.lastReasonedAt || null,
      topInterests: uniqueInterests.slice(0, 5),
      topTraits: uniqueTraits.slice(0, 5)
    };
  }
  getInsights(workspaceId, peerId) {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const localConclusions = this.store.getConclusions(workspaceId, peerId, 1000);
    const globalConclusions = this.store.getGlobalConclusions(peerId, 1000);
    const allConclusions = [...localConclusions, ...globalConclusions];
    const summaries = this.store.getSummaries(workspaceId, peerId, 100);
    const sessions = this.store.getAllSessions(workspaceId);
    const localCard = this.store.getPeerCard(workspaceId, peerId);
    const globalCard = this.store.getPeerCard(GLOBAL_WORKSPACE_ID, peerId);
    const peerCard = this.mergePeerCards(localCard, globalCard);
    const recentConclusions = allConclusions.filter((c) => c.createdAt > oneWeekAgo);
    const learningVelocity = recentConclusions.length / 7;
    const topicDistribution = {
      deductive: allConclusions.filter((c) => c.type === "deductive").length,
      inductive: allConclusions.filter((c) => c.type === "inductive").length,
      abductive: allConclusions.filter((c) => c.type === "abductive").length
    };
    const allConclusionsText = allConclusions.map((c) => c.content.toLowerCase()).join(" ");
    const knownInterests = peerCard?.interests || [];
    const interestEvolution = knownInterests.map((interest) => {
      const interestLower = interest.toLowerCase();
      const words = interestLower.split(/\s+/);
      const totalCount = words.reduce((sum, word) => {
        const regex = new RegExp(word, "gi");
        return sum + (allConclusionsText.match(regex)?.length || 0);
      }, 0);
      const recentText = recentConclusions.map((c) => c.content.toLowerCase()).join(" ");
      const recentCount = words.reduce((sum, word) => {
        const regex = new RegExp(word, "gi");
        return sum + (recentText.match(regex)?.length || 0);
      }, 0);
      let trend = "stable";
      const oldCount = totalCount - recentCount;
      if (oldCount === 0 && recentCount > 0) {
        trend = "up";
      } else if (recentCount > oldCount * 1.5) {
        trend = "up";
      } else if (recentCount < oldCount * 0.5 && oldCount > 0) {
        trend = "down";
      }
      return {
        interest,
        frequency: totalCount,
        trend
      };
    }).sort((a, b) => b.frequency - a.frequency);
    const oneWeekSessions = sessions.filter((s) => s.createdAt > oneWeekAgo);
    const uniqueDays = new Set(oneWeekSessions.map((s) => new Date(s.createdAt).toDateString()));
    let totalMessages = 0;
    for (const session of sessions) {
      const messages = this.store.getMessages(workspaceId, session.id, 1e4);
      totalMessages += messages.length;
    }
    const engagementMetrics = {
      totalSessions: sessions.length,
      totalMessages,
      avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
      sessionFrequencyPerWeek: oneWeekSessions.length,
      activeDaysLastWeek: uniqueDays.size
    };
    const recentActivity = {
      conclusionsLastWeek: recentConclusions.length,
      conclusionsLastMonth: allConclusions.filter((c) => c.createdAt > oneMonthAgo).length,
      sessionsLastWeek: oneWeekSessions.length
    };
    return {
      learningVelocity,
      topicDistribution,
      interestEvolution,
      engagementMetrics,
      recentActivity
    };
  }
  getPerspective(workspaceId, observerPeerId, targetPeerId) {
    const crossObservations = this.store.getObservationsAboutPeer(workspaceId, targetPeerId, 50).filter((o) => o.peerId === observerPeerId);
    const conclusions = this.store.getConclusions(workspaceId, observerPeerId, 100).filter((c) => c.content.toLowerCase().includes(targetPeerId.toLowerCase()));
    const targetCard = this.store.getPeerCard(workspaceId, targetPeerId);
    if (!crossObservations.length && !conclusions.length && !targetCard) {
      return null;
    }
    const parts = [];
    parts.push(`## Perspective: ${observerPeerId} on ${targetPeerId}`);
    if (crossObservations.length > 0) {
      parts.push(`
### Observations`);
      crossObservations.slice(0, 10).forEach((o) => parts.push(`- ${o.content.slice(0, 200)}`));
    }
    if (conclusions.length > 0) {
      parts.push(`
### Conclusions`);
      conclusions.slice(0, 5).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
    }
    if (targetCard) {
      parts.push(`
### Known Info`);
      if (targetCard.name)
        parts.push(`- Name: ${targetCard.name}`);
      if (targetCard.occupation)
        parts.push(`- Occupation: ${targetCard.occupation}`);
      if (targetCard.interests.length)
        parts.push(`- Interests: ${targetCard.interests.join(", ")}`);
    }
    return parts.join(`
`);
  }
  mergePeerCards(local, global) {
    if (!local && !global)
      return {};
    return {
      name: local?.name || global?.name,
      occupation: local?.occupation || global?.occupation,
      interests: [...new Set([...local?.interests || [], ...global?.interests || []])],
      traits: [...new Set([...local?.traits || [], ...global?.traits || []])],
      goals: [...new Set([...local?.goals || [], ...global?.goals || []])]
    };
  }
  buildBlendedContextString(globalRep, localRep) {
    const parts = [];
    if (globalRep?.peerCard) {
      const card = globalRep.peerCard;
      parts.push("## User Profile (Global)");
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
    if (globalRep?.conclusions && globalRep.conclusions.length > 0) {
      parts.push(`
## Cross-Project Insights`);
      globalRep.conclusions.slice(0, 5).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
    }
    const recentObservations = (localRep?.observations || []).filter((o) => !o.processed).slice(0, 3);
    if (recentObservations.length > 0) {
      parts.push(`
## Recent Observations`);
      recentObservations.forEach((o) => parts.push(`- [${o.role}] ${o.content.slice(0, 150)}`));
    }
    if (localRep?.conclusions && localRep.conclusions.length > 0) {
      parts.push(`
## Project Conclusions`);
      localRep.conclusions.slice(0, 5).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
    }
    if (localRep?.summaries && localRep.summaries.length > 0) {
      parts.push(`
## Project Summaries`);
      localRep.summaries.slice(0, 2).forEach((s) => parts.push(`- ${s.type}: ${s.content.slice(0, 150)}`));
    }
    if (localRep?.peerCard) {
      const card = localRep.peerCard;
      const showFullProfile = !globalRep?.peerCard;
      if (showFullProfile) {
        parts.push(`
## User Profile`);
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
      } else {
        const hasUniqueInfo = card.occupation || card.interests.length || card.traits.length;
        if (hasUniqueInfo) {
          parts.push(`
## Project-Specific Profile`);
          if (card.occupation)
            parts.push(`- Occupation: ${card.occupation}`);
          if (card.interests.length)
            parts.push(`- Interests: ${card.interests.join(", ")}`);
        }
      }
    }
    return parts.join(`
`) || "No memory context available.";
  }
  buildGlobalContextString(rep) {
    const parts = [];
    if (rep.peerCard) {
      const card = rep.peerCard;
      parts.push("## User Profile (Global)");
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
    if (rep.conclusions.length > 0) {
      parts.push(`
## Cross-Project Insights`);
      rep.conclusions.slice(0, 10).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
    }
    return parts.join(`
`) || "No global context available.";
  }
  buildProjectContextString(rep) {
    const parts = [];
    const recentObservations = rep.observations.filter((o) => !o.processed).slice(0, 5);
    if (recentObservations.length > 0) {
      parts.push("## Recent Observations");
      recentObservations.forEach((o) => parts.push(`- [${o.role}] ${o.content.slice(0, 200)}`));
    }
    if (rep.conclusions.length > 0) {
      parts.push(`
## Key Conclusions`);
      rep.conclusions.slice(0, 10).forEach((c) => parts.push(`- [${c.type}] ${c.content}`));
    }
    if (rep.summaries.length > 0) {
      parts.push(`
## Recent Summaries`);
      rep.summaries.slice(0, 3).forEach((s) => parts.push(`- ${s.type}: ${s.content.slice(0, 200)}`));
    }
    if (rep.peerCard) {
      const card = rep.peerCard;
      parts.push(`
## User Profile`);
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
    return parts.join(`
`) || "No project context available.";
  }
}

// src/core/project-integration.ts
var PROJECT_CHANGE_EVENT = "project:change";
var PROJECT_DETECTED_EVENT = "project:detected";
var DEFAULT_PROJECT_CONFIG = {
  enabled: true,
  autoDetect: true,
  injectContext: true
};
var cachedProject = null;
function initProjectIntegration(pi, store, config, onWorkspaceChange) {
  if (!config.enabled)
    return;
  pi.events.on(PROJECT_CHANGE_EVENT, (data) => {
    const event = data;
    handleProjectChange(event, store, config, onWorkspaceChange);
  });
  pi.events.on(PROJECT_DETECTED_EVENT, (data) => {
    const event = data;
    ensureProjectWorkspace(store, event.project);
    cachedProject = event.project;
  });
}
function handleProjectChange(event, store, config, onWorkspaceChange) {
  const { previous, current, reason } = event;
  if (previous && current) {
    console.log(`[pi-learn] Project switch: ${previous.name} → ${current.name} (${reason})`);
  } else if (current) {
    console.log(`[pi-learn] Project detected: ${current.name} (${reason})`);
  } else {
    console.log(`[pi-learn] Project cleared (was: ${previous?.name})`);
  }
  if (current) {
    ensureProjectWorkspace(store, current);
    cachedProject = current;
  } else {
    cachedProject = null;
  }
  if (onWorkspaceChange) {
    onWorkspaceChange(current);
  }
}
function ensureProjectWorkspace(store, project) {
  const workspaceId = project.id;
  store.getOrCreateWorkspace(workspaceId, project.name);
  store.getOrCreatePeer(workspaceId, "user", "User", "user");
  store.getOrCreatePeer(workspaceId, "agent", "Agent", "agent");
  return workspaceId;
}
function getCurrentProjectInfo() {
  return cachedProject;
}
function createProjectContextSnippet(project) {
  const parts = [
    `Current Project: ${project.name}`,
    `Path: ${project.path}`
  ];
  if (project.repo) {
    parts.push(`Repository: ${project.repo.remote}`);
    if (project.repo.branch) {
      parts.push(`Branch: ${project.repo.branch}`);
    }
  }
  if (project.stack && project.stack.length > 0) {
    parts.push(`Tech Stack: ${project.stack.join(", ")}`);
  }
  return parts.join(`
`);
}

// src/tools/index.ts
import { Type } from "@sinclair/typebox";

// src/renderers.ts
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
function measureWidth(text) {
  return visibleWidth(text);
}
function fitText(text, maxWidth) {
  if (maxWidth <= 0)
    return "";
  return truncateToWidth(text, maxWidth);
}

class TextComponent {
  text;
  maxLines;
  constructor(text, maxLines = 0) {
    this.text = text;
    this.maxLines = maxLines;
  }
  render(width) {
    const lines = this.text.split(`
`);
    const result = [];
    for (let i = 0;i < lines.length; i++) {
      if (this.maxLines > 0 && i >= this.maxLines) {
        result.push(fitText(`... and ${lines.length - this.maxLines} more lines`, width));
        break;
      }
      result.push(fitText(lines[i], width));
    }
    return result;
  }
  invalidate() {}
}

class BoxComponent {
  children;
  paddingX;
  paddingY;
  bgColor;
  constructor(children, paddingX = 1, paddingY = 0, bgColor) {
    this.children = children;
    this.paddingX = paddingX;
    this.paddingY = paddingY;
    this.bgColor = bgColor;
  }
  render(width) {
    const result = [];
    const innerWidth = Math.max(1, width - this.paddingX * 2);
    for (let i = 0;i < this.paddingY; i++) {
      result.push(" ".repeat(width));
    }
    for (const child of this.children) {
      const childLines = child.render(innerWidth);
      for (const line of childLines) {
        const truncated = fitText(line, innerWidth);
        const padded = " ".repeat(this.paddingX) + truncated + " ".repeat(Math.max(0, innerWidth - measureWidth(truncated)));
        result.push(padded);
      }
    }
    for (let i = 0;i < this.paddingY; i++) {
      result.push(" ".repeat(width));
    }
    return result;
  }
  invalidate() {}
}
function createHeader(text, theme) {
  return new TextComponent(theme.fg("toolTitle", `\uD83D\uDCDA ${text}`));
}
function createLabel(text, theme) {
  return new TextComponent(theme.bold(text));
}
function createListItem(label, value, theme, maxValueWidth = 50) {
  const prefix = `${theme.fg("accent", "•")} ${theme.bold(label + ":")} `;
  const fullLine = prefix + value;
  const truncatedLine = fitText(fullLine, maxValueWidth);
  return new TextComponent(truncatedLine);
}
function createDivider(theme, width = 40) {
  return new TextComponent(theme.fg("border", "─".repeat(width)));
}
function createPeerCardRenderer(data, theme) {
  const children = [];
  children.push(createHeader("Peer Card", theme));
  children.push(createDivider(theme));
  if (data.name) {
    children.push(createListItem("Name", data.name, theme, 50));
  }
  if (data.occupation) {
    children.push(createListItem("Occupation", data.occupation, theme, 50));
  }
  if (data.interests && data.interests.length > 0) {
    children.push(createListItem("Interests", data.interests.join(", "), theme, 50));
  }
  if (data.traits && data.traits.length > 0) {
    children.push(createListItem("Traits", data.traits.join(", "), theme, 50));
  }
  if (data.goals && data.goals.length > 0) {
    children.push(createListItem("Goals", data.goals.join(", "), theme, 50));
  }
  return new BoxComponent(children, 1, 0);
}
function createStatsRenderer(stats, theme) {
  const children = [];
  children.push(createHeader("Memory Stats", theme));
  children.push(createDivider(theme));
  children.push(createListItem("Conclusions", stats.conclusionCount.toString(), theme));
  children.push(createListItem("Summaries", stats.summaryCount.toString(), theme));
  children.push(createListItem("Peer Card", stats.hasPeerCard ? "Yes" : "No", theme));
  if (stats.lastReasonedAt) {
    const date = new Date(stats.lastReasonedAt).toLocaleString();
    children.push(createListItem("Last Reasoned", date, theme));
  }
  if (stats.topInterests.length > 0) {
    children.push(new TextComponent(""));
    children.push(createLabel("Top Interests:", theme));
    const interestsText = stats.topInterests.slice(0, 5).map((i) => `  ${theme.fg("accent", "•")} ${i}`).join(`
`);
    children.push(new TextComponent(fitText(interestsText, 50)));
  }
  if (stats.topTraits.length > 0) {
    children.push(new TextComponent(""));
    children.push(createLabel("Top Traits:", theme));
    const traitsText = stats.topTraits.slice(0, 5).map((t) => `  ${theme.fg("accent", "•")} ${t}`).join(`
`);
    children.push(new TextComponent(fitText(traitsText, 50)));
  }
  return new BoxComponent(children, 1, 0);
}
function createSearchResultsRenderer(results, query, theme) {
  const children = [];
  const headerQuery = query.length > 30 ? query.slice(0, 27) + "..." : query;
  children.push(createHeader(`Search Results for "${headerQuery}"`, theme));
  children.push(createDivider(theme));
  if (results.length === 0) {
    children.push(new TextComponent(theme.fg("muted", "No results found")));
  } else {
    const limited = results.slice(0, 10);
    for (let i = 0;i < limited.length; i++) {
      const r = limited[i];
      const date = new Date(r.createdAt).toLocaleDateString();
      const sessionParts = r.sessionId.split("/");
      const sessionName = sessionParts.length > 1 ? sessionParts.slice(-2).join("/") : r.sessionId;
      const truncatedSession = fitText(sessionName, 40);
      children.push(new TextComponent(""));
      children.push(new TextComponent(fitText(`${theme.bold(`${i + 1}.`)} ${theme.fg("accent", date)} - ${truncatedSession}`, 60)));
      children.push(new TextComponent(fitText(`   "${fitText(r.snippet, 80)}"`, 80)));
      children.push(new TextComponent(fitText(`   ${theme.fg("muted", `(${r.relevance.toFixed(2)} match)`)}`, 30)));
    }
    if (results.length > 10) {
      children.push(new TextComponent(""));
      children.push(new TextComponent(theme.fg("muted", `... and ${results.length - 10} more results`)));
    }
  }
  return new BoxComponent(children, 1, 0);
}
function createSessionListRenderer(sessions, theme) {
  const children = [];
  children.push(createHeader(`Sessions (${sessions.length} total)`, theme));
  children.push(createDivider(theme));
  if (sessions.length === 0) {
    children.push(new TextComponent(theme.fg("muted", "No sessions found")));
  } else {
    const limited = sessions.slice(0, 15);
    for (let i = 0;i < limited.length; i++) {
      const s = limited[i];
      const date = new Date(s.createdAt).toLocaleDateString();
      const sessionParts = s.id.split("/");
      const sessionName = sessionParts.length > 2 ? ".../" + sessionParts.slice(-2).join("/") : s.id;
      const truncatedSession = fitText(sessionName, 45);
      let line = `${theme.bold(`${i + 1}.`)} ${truncatedSession}`;
      if (s.tags && s.tags.length > 0) {
        const tagsText = fitText(`[${s.tags.slice(0, 3).join(", ")}]`, 20);
        line += ` ${theme.fg("accent", tagsText)}`;
      }
      children.push(new TextComponent(fitText(line, 80)));
      const metaLine = `   ${theme.fg("muted", `Created: ${date}, Msgs: ${s.messageCount}`)}`;
      children.push(new TextComponent(fitText(metaLine, 60)));
    }
    if (sessions.length > 15) {
      children.push(new TextComponent(""));
      children.push(new TextComponent(theme.fg("muted", `... and ${sessions.length - 15} more sessions`)));
    }
  }
  return new BoxComponent(children, 1, 0);
}

// src/tools/index.ts
var TOOLS = {
  learn_add_message: {
    label: "Add Message",
    description: "Store a message in memory for future reasoning.",
    params: Type.Object({
      content: Type.String({ description: "The message content to store" }),
      role: Type.String({ description: "Role of the message sender (user, assistant)" })
    })
  },
  learn_add_messages_batch: {
    label: "Add Messages Batch",
    description: "Store multiple messages in a single batch operation. Efficient for bulk ingestion.",
    params: Type.Object({
      messages: Type.Array(Type.Object({
        content: Type.String({ description: "Message content" }),
        role: Type.String({ description: "Role (user, assistant)" }),
        sessionId: Type.Optional(Type.String({ description: "Session ID" })),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Message metadata" }))
      }), { description: "Array of messages to store" })
    })
  },
  learn_add_observation: {
    label: "Add Observation",
    description: "Store a raw observation/message for later processing. Observations are stored before reasoning extracts insights.",
    params: Type.Object({
      content: Type.String({ description: "The observation content to store" }),
      role: Type.String({ description: "Role of the message sender (user, assistant)" }),
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      sessionId: Type.Optional(Type.String({ description: "Session ID (defaults to current session)" }))
    })
  },
  learn_get_context: {
    label: "Get Peer Context",
    description: "Retrieve the blended context for a peer (global user profile + project memories).",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      scope: Type.Optional(Type.String({ description: "Scope filter: 'blended' (default), 'global', or 'project'" }))
    })
  },
  learn_get_global_context: {
    label: "Get Global Context",
    description: "Retrieve cross-project context (user traits, interests, goals) shared across all projects.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) })
  },
  learn_get_project_context: {
    label: "Get Project Context",
    description: "Retrieve project-specific context (local to current workspace).",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      workspaceId: Type.Optional(Type.String({ description: "Workspace ID (defaults to current)" }))
    })
  },
  learn_query: {
    label: "Query Memory",
    description: "Search memory for conclusions similar to a query.",
    params: Type.Object({
      query: Type.String({ description: "Search query" }),
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      topK: Type.Optional(Type.Integer({ description: "Number of results (default 5)" })),
      minSimilarity: Type.Optional(Type.Number({ description: "Minimum similarity threshold 0-1 (default 0)" }))
    })
  },
  learn_reason_now: { label: "Trigger Reasoning", description: "Immediately process pending messages through the reasoning engine.", params: Type.Object({}) },
  learn_trigger_dream: {
    label: "Trigger Dream",
    description: "Manually trigger a dream cycle for deeper reasoning.",
    params: Type.Object({
      scope: Type.Optional(Type.String({ description: "Scope: 'project' (default) or 'user' (global)" }))
    })
  },
  learn_prune: { label: "Prune Old Data", description: "Manually trigger retention pruning to delete old data.", params: Type.Object({}) },
  learn_get_peer_card: {
    label: "Get Peer Card",
    description: "Get the biographical information card for a peer.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) })
  },
  learn_update_peer_card: {
    label: "Update Peer Card",
    description: "Manually update the peer card with biographical information.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      name: Type.Optional(Type.String({ description: "Peer's name" })),
      occupation: Type.Optional(Type.String({ description: "Peer's occupation" })),
      interests: Type.Optional(Type.Array(Type.String(), { description: "List of interests" })),
      traits: Type.Optional(Type.Array(Type.String(), { description: "List of traits" })),
      goals: Type.Optional(Type.Array(Type.String(), { description: "List of goals" }))
    })
  },
  learn_list_peers: { label: "List Peers", description: "List all peers in the current workspace.", params: Type.Object({}) },
  learn_get_stats: {
    label: "Get Memory Stats",
    description: "Get statistics about memory for a peer.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) })
  },
  learn_get_insights: {
    label: "Get Memory Insights",
    description: "Get comprehensive insights about learning patterns, topic distribution, and engagement metrics.",
    params: Type.Object({ peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })) })
  },
  learn_get_summaries: {
    label: "Get Summaries",
    description: "Get all summaries for a peer.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" })),
      limit: Type.Optional(Type.Integer({ description: "Max summaries to return (default 10)" }))
    })
  },
  learn_search_sessions: {
    label: "Search Sessions",
    description: "Search through session history by keyword.",
    params: Type.Object({
      query: Type.String({ description: "Search query to match in messages" }),
      limit: Type.Optional(Type.Integer({ description: "Max results (default 10)" }))
    })
  },
  learn_get_session: {
    label: "Get Session",
    description: "Get details and messages from a specific session.",
    params: Type.Object({
      sessionId: Type.String({ description: "Session ID to retrieve" }),
      limit: Type.Optional(Type.Integer({ description: "Max messages (default 50)" }))
    })
  },
  learn_list_sessions: {
    label: "List Sessions",
    description: "List all sessions in the current workspace.",
    params: Type.Object({ limit: Type.Optional(Type.Integer({ description: "Max sessions (default 20)" })) })
  },
  learn_tag_session: {
    label: "Tag Session",
    description: "Add or remove tags from a session for categorization.",
    params: Type.Object({
      sessionId: Type.String({ description: "Session ID to tag" }),
      addTags: Type.Optional(Type.Array(Type.String(), { description: "Tags to add" })),
      removeTags: Type.Optional(Type.Array(Type.String(), { description: "Tags to remove" }))
    })
  },
  learn_get_sessions_by_tag: {
    label: "Get Sessions By Tag",
    description: "Get all sessions with a specific tag.",
    params: Type.Object({
      tag: Type.String({ description: "Tag to search for" }),
      limit: Type.Optional(Type.Integer({ description: "Max sessions (default 20)" }))
    })
  },
  learn_list_tags: {
    label: "List All Tags",
    description: "List all unique tags across sessions with their counts.",
    params: Type.Object({})
  },
  learn_get_dream_status: {
    label: "Get Dream Status",
    description: "Get information about the dreaming system - when it last ran, next scheduled dream, and statistics.",
    params: Type.Object({})
  },
  learn_export: { label: "Export Memory", description: "Export all memory data as JSON for backup.", params: Type.Object({}) },
  learn_import: {
    label: "Import Memory",
    description: "Import memory data from a JSON export.",
    params: Type.Object({
      data: Type.String({ description: "JSON export data" }),
      merge: Type.Optional(Type.Boolean({ description: "Merge with existing data (default: true)" }))
    })
  },
  learn_observe_peer: {
    label: "Observe Peer",
    description: "Record an observation about another peer (cross-peer). Used for perspective-taking.",
    params: Type.Object({
      aboutPeerId: Type.String({ description: "The peer ID being observed" }),
      content: Type.String({ description: "The observation content" }),
      sessionId: Type.Optional(Type.String({ description: "Session ID (defaults to current)" }))
    })
  },
  learn_get_perspective: {
    label: "Get Perspective",
    description: "Get context from a specific peer's perspective - what they know about another peer.",
    params: Type.Object({
      observerPeerId: Type.String({ description: "The peer whose perspective to view" }),
      targetPeerId: Type.String({ description: "The peer being observed" })
    })
  },
  learn_test_hybrid: {
    label: "Test Hybrid Memory",
    description: "Debug tool that outputs structured info about both global and project scopes. Useful for testing the hybrid architecture.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" }))
    })
  },
  learn_count_by_scope: {
    label: "Count Conclusions By Scope",
    description: "Show conclusion counts broken down by scope (user/project) for both global and project workspaces.",
    params: Type.Object({
      peerId: Type.Optional(Type.String({ description: "Peer ID (defaults to 'user')" }))
    })
  }
};
function createToolExecutors(deps) {
  const { store, contextAssembler, reasoningEngine, config, runDream } = deps;
  return {
    learn_add_message: {
      execute: async (_, params, _signal, _onUpdate, ctx) => {
        const sessionFile = ctx.sessionManager.getSessionFile();
        if (!sessionFile)
          return { content: [{ type: "text", text: "No active session" }], details: { error: "No active session" } };
        reasoningEngine.queue({ sessionFile, peerId: params.role === "assistant" ? "agent" : params.role, messages: [{ role: params.role, content: params.content }], queuedAt: Date.now() });
        return { content: [{ type: "text", text: "Message queued for reasoning" }], details: { queued: true } };
      }
    },
    learn_add_messages_batch: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const sessionFile = _ctx.sessionManager.getSessionFile() || "default";
        const messages = params.messages.map((m, i) => ({
          id: generateId(`msg_${i}_`),
          sessionId: m.sessionId || sessionFile,
          peerId: m.role === "assistant" ? "agent" : "user",
          role: m.role,
          content: m.content,
          createdAt: Date.now() + i,
          metadata: m.metadata
        }));
        const count = store.saveMessagesBatch(config.workspaceId, messages);
        return { content: [{ type: "text", text: `Batch inserted ${count} messages` }], details: { count, success: true } };
      }
    },
    learn_add_observation: {
      execute: async (_, params, _signal, _onUpdate, ctx) => {
        const peerId = params.peerId || "user";
        const sessionId = params.sessionId || ctx.sessionManager.getSessionFile() || "default";
        const observation = {
          id: generateId("obs_"),
          workspaceId: config.workspaceId,
          peerId,
          sessionId,
          role: params.role,
          content: params.content,
          createdAt: Date.now(),
          processed: false
        };
        store.saveObservation(observation);
        return {
          content: [{ type: "text", text: `Observation saved: ${params.content.slice(0, 100)}${params.content.length > 100 ? "..." : ""}` }],
          details: { success: true, observationId: observation.id }
        };
      }
    },
    learn_get_context: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const scope = params.scope || "blended";
        let assembledCtx = null;
        let contextType = "blended";
        if (scope === "global") {
          assembledCtx = contextAssembler.getGlobalContext(peerId);
          contextType = "global";
        } else if (scope === "project") {
          assembledCtx = contextAssembler.getProjectContext(config.workspaceId, peerId);
          contextType = "project";
        } else {
          assembledCtx = contextAssembler.assembleContext(config.workspaceId, peerId);
        }
        if (!assembledCtx)
          return { content: [{ type: "text", text: "No context found" }], details: { found: false, scope: contextType } };
        return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: contextType } };
      }
    },
    learn_get_global_context: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const assembledCtx = contextAssembler.getGlobalContext(peerId);
        if (!assembledCtx)
          return { content: [{ type: "text", text: "No global context found" }], details: { found: false, scope: "global" } };
        return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: "global" } };
      }
    },
    learn_get_project_context: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const workspaceId = params.workspaceId || config.workspaceId;
        const assembledCtx = contextAssembler.getProjectContext(workspaceId, peerId);
        if (!assembledCtx)
          return { content: [{ type: "text", text: "No project context found" }], details: { found: false, scope: "project" } };
        return { content: [{ type: "text", text: assembledCtx }], details: { found: true, peerId, scope: "project", workspaceId } };
      }
    },
    learn_query: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const results = await contextAssembler.searchSimilar(config.workspaceId, params.peerId || "user", params.query, params.topK || 5, params.minSimilarity ?? 0);
        if (!results.length)
          return { content: [{ type: "text", text: `No results found for: ${params.query}` }], details: { found: false } };
        return { content: [{ type: "text", text: results.map((r, i) => `${i + 1}. [${r.type}] ${r.content}`).join(`
`) }], details: { found: true, count: results.length } };
      }
    },
    learn_reason_now: {
      execute: async (_, __, _signal, _onUpdate, ctx) => {
        ctx.ui.setStatus("learn", "Reasoning...");
        const stats = contextAssembler.getMemoryStats(config.workspaceId, "user");
        return { content: [{ type: "text", text: `Reasoning complete. ${stats.conclusionCount} conclusions.` }], details: stats };
      }
    },
    learn_trigger_dream: {
      execute: async (_, params, _signal, _onUpdate, ctx) => {
        ctx.ui.setStatus("learn", "Dreaming...");
        const scope = params.scope || "project";
        await runDream(scope);
        const dreamMeta = store.getDreamMetadata(scope === "user" ? "__global__" : config.workspaceId);
        return { content: [{ type: "text", text: `Dream cycle complete (${scope} scope). ${dreamMeta.lastDreamConclusions} conclusions generated.` }], details: { success: true, scope, dreamMeta } };
      }
    },
    learn_prune: {
      execute: async (_, __, _signal, _onUpdate, _ctx) => {
        const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
        return { content: [{ type: "text", text: `Pruned ${result.deleted} old records` }], details: result };
      }
    },
    learn_get_peer_card: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const card = store.getPeerCard(config.workspaceId, params.peerId || "user");
        if (!card)
          return { content: [{ type: "text", text: "No peer card found" }], details: { found: false, peerId: params.peerId } };
        return { content: [{ type: "text", text: `## Peer Card

Name: ${card.name || "N/A"}` }], details: { found: true, peerId: params.peerId, card } };
      },
      renderResult: (result, _options, theme) => {
        const details = result.details;
        if (!details?.card)
          return { render: () => ["No peer card found"] };
        return createPeerCardRenderer(details.card, theme);
      }
    },
    learn_update_peer_card: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const existing = store.getPeerCard(config.workspaceId, peerId);
        const updated = {
          peerId,
          name: params.name ?? existing?.name,
          occupation: params.occupation ?? existing?.occupation,
          interests: params.interests ?? existing?.interests ?? [],
          traits: params.traits ?? existing?.traits ?? [],
          goals: params.goals ?? existing?.goals ?? [],
          updatedAt: Date.now()
        };
        store.savePeerCard(config.workspaceId, updated);
        return { content: [{ type: "text", text: `Peer card updated for: ${peerId}` }], details: { success: true } };
      }
    },
    learn_list_peers: {
      execute: async (_, __, _signal, _onUpdate, _ctx) => {
        const peers = store.getAllPeers(config.workspaceId);
        return { content: [{ type: "text", text: peers.map((p, i) => `${i + 1}. ${p.name} (${p.type})`).join(`
`) || "No peers" }], details: { count: peers.length } };
      }
    },
    learn_get_stats: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const stats = contextAssembler.getMemoryStats(config.workspaceId, params.peerId || "user");
        return { content: [{ type: "text", text: `Stats: ${stats.conclusionCount} conclusions` }], details: stats };
      },
      renderResult: (result, _options, theme) => {
        const details = result.details;
        if (!details)
          return { render: () => ["No stats"] };
        return createStatsRenderer(details, theme);
      }
    },
    learn_get_insights: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const insights = contextAssembler.getInsights(config.workspaceId, params.peerId || "user");
        const lines = [
          "## Memory Insights",
          "",
          "### Learning Velocity",
          `${insights.learningVelocity.toFixed(2)} conclusions/day (7-day avg)`,
          "",
          "### Topic Distribution",
          `- Deductive: ${insights.topicDistribution.deductive}`,
          `- Inductive: ${insights.topicDistribution.inductive}`,
          `- Abductive: ${insights.topicDistribution.abductive}`,
          "",
          "### Engagement",
          `- Total Sessions: ${insights.engagementMetrics.totalSessions}`,
          `- Total Messages: ${insights.engagementMetrics.totalMessages}`,
          `- Sessions This Week: ${insights.engagementMetrics.sessionFrequencyPerWeek}`,
          `- Active Days Last Week: ${insights.engagementMetrics.activeDaysLastWeek}`,
          "",
          "### Recent Activity",
          `- Conclusions Last Week: ${insights.recentActivity.conclusionsLastWeek}`,
          `- Conclusions Last Month: ${insights.recentActivity.conclusionsLastMonth}`
        ];
        if (insights.interestEvolution.length > 0) {
          lines.push("", "### Interest Trends");
          for (const item of insights.interestEvolution.slice(0, 5)) {
            const trendIcon = item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→";
            lines.push(`- ${item.interest}: ${trendIcon} (${item.frequency})`);
          }
        }
        return { content: [{ type: "text", text: lines.join(`
`) }], details: insights };
      }
    },
    learn_get_summaries: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const summaries = store.getSummaries(config.workspaceId, params.peerId || "user", params.limit || 10);
        if (!summaries.length)
          return { content: [{ type: "text", text: "No summaries found" }], details: { count: 0 } };
        return { content: [{ type: "text", text: summaries.map((s, i) => `${i + 1}. [${s.type}] ${s.content}`).join(`
`) }], details: { count: summaries.length } };
      }
    },
    learn_search_sessions: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const results = store.searchSessions(config.workspaceId, params.query, params.limit || 10);
        if (!results.length)
          return { content: [{ type: "text", text: "No results" }], details: { found: false, query: params.query, results: [] } };
        return { content: [{ type: "text", text: results.map((r, i) => `${i + 1}. ${r.snippet}`).join(`
`) }], details: { found: true, query: params.query, count: results.length, results } };
      },
      renderResult: (result, _options, theme) => {
        const details = result.details;
        if (!details?.results?.length)
          return { render: () => ["No results"] };
        return createSearchResultsRenderer(details.results, details.query || "", theme);
      }
    },
    learn_get_session: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const messages = store.getMessages(config.workspaceId, params.sessionId, params.limit || 50);
        const session = store.getSession(config.workspaceId, params.sessionId);
        return {
          content: [{ type: "text", text: messages.map((m) => `[${m.role}] ${m.content}`).join(`
`) }],
          details: { found: true, sessionId: params.sessionId, messageCount: messages.length, tags: session?.tags || [] }
        };
      }
    },
    learn_list_sessions: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const sessions = store.getAllSessions(config.workspaceId).slice(0, params.limit || 20);
        if (!sessions.length)
          return { content: [{ type: "text", text: "No sessions" }], details: { count: 0, sessions: [] } };
        return { content: [{ type: "text", text: sessions.map((s, i) => `${i + 1}. ${s.id}${s.tags.length > 0 ? ` [${s.tags.join(", ")}]` : ""}`).join(`
`) }], details: { count: sessions.length, sessions } };
      },
      renderResult: (result, _options, theme) => {
        const details = result.details;
        if (!details?.sessions?.length)
          return { render: () => ["No sessions"] };
        return createSessionListRenderer(details.sessions, theme);
      }
    },
    learn_tag_session: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        if (params.addTags?.length) {
          store.tagSession(config.workspaceId, params.sessionId, params.addTags);
        }
        if (params.removeTags?.length) {
          store.untagSession(config.workspaceId, params.sessionId, params.removeTags);
        }
        const session = store.getSession(config.workspaceId, params.sessionId);
        return {
          content: [{ type: "text", text: `Session ${params.sessionId} updated. Tags: ${session?.tags?.join(", ") || "none"}` }],
          details: { success: true, sessionId: params.sessionId, tags: session?.tags || [] }
        };
      }
    },
    learn_get_sessions_by_tag: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const sessions = store.getSessionsByTag(config.workspaceId, params.tag, params.limit || 20);
        if (!sessions.length)
          return { content: [{ type: "text", text: `No sessions with tag: ${params.tag}` }], details: { found: false, tag: params.tag, count: 0 } };
        return { content: [{ type: "text", text: sessions.map((s, i) => `${i + 1}. ${s.id}`).join(`
`) }], details: { found: true, tag: params.tag, count: sessions.length, sessions } };
      }
    },
    learn_list_tags: {
      execute: async (_, __, _signal, _onUpdate, _ctx) => {
        const tags = store.getAllTags(config.workspaceId);
        if (!tags.length)
          return { content: [{ type: "text", text: "No tags found" }], details: { count: 0, tags: [] } };
        return { content: [{ type: "text", text: tags.map((t, i) => `${i + 1}. ${t.tag} (${t.count})`).join(`
`) }], details: { count: tags.length, tags } };
      }
    },
    learn_get_dream_status: {
      execute: async (_, __, _signal, _onUpdate, _ctx) => {
        const dreamMeta = store.getDreamMetadata(config.workspaceId);
        const messages = store.getRecentMessages(config.workspaceId, "user", 1000);
        const messagesSinceLastDream = messages.filter((m) => m.created_at > dreamMeta.lastDreamedAt).length;
        const nextDreamMs = dreamMeta.lastDreamedAt > 0 ? Math.max(0, dreamMeta.lastDreamedAt + config.dream.intervalMs - Date.now()) : 0;
        const nextDreamMinutes = Math.ceil(nextDreamMs / 60000);
        const lastDreamFormatted = dreamMeta.lastDreamedAt > 0 ? new Date(dreamMeta.lastDreamedAt).toLocaleString() : "Never";
        const lines = [
          "## Dream Status",
          "",
          `**Enabled**: ${config.dream.enabled ? "Yes" : "No"}`,
          `**Last Dream**: ${lastDreamFormatted}`,
          `**Total Dreams**: ${dreamMeta.dreamCount}`,
          `**Messages Since Last Dream**: ${messagesSinceLastDream}`,
          "",
          "### Configuration",
          `**Interval**: ${(config.dream.intervalMs / 60000).toFixed(0)} minutes`,
          `**Batch Size**: ${config.dream.batchSize} messages`,
          `**Min Messages**: ${config.dream.minMessagesSinceLastDream}`,
          "",
          "### Last Dream Results",
          `**Messages Processed**: ${dreamMeta.lastDreamMessages}`,
          `**Conclusions Generated**: ${dreamMeta.lastDreamConclusions}`,
          "",
          nextDreamMs > 0 ? `**Next Dream In**: ~${nextDreamMinutes} minutes` : `**Next Dream**: Ready now (${messagesSinceLastDream} messages pending)`
        ];
        return {
          content: [{ type: "text", text: lines.join(`
`) }],
          details: {
            enabled: config.dream.enabled,
            lastDreamedAt: dreamMeta.lastDreamedAt,
            dreamCount: dreamMeta.dreamCount,
            messagesSinceLastDream,
            nextDreamMs,
            intervalMs: config.dream.intervalMs,
            lastDreamMessages: dreamMeta.lastDreamMessages,
            lastDreamConclusions: dreamMeta.lastDreamConclusions
          }
        };
      }
    },
    learn_export: {
      execute: async (_, __, _signal, _onUpdate, _ctx) => {
        const data = store.exportAll(config.workspaceId);
        return { content: [{ type: "text", text: `Exported ${data.conclusions.length} conclusions` }], details: data };
      }
    },
    learn_import: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        try {
          const data = JSON.parse(params.data);
          store.importAll(config.workspaceId, data, params.merge ?? true);
          return { content: [{ type: "text", text: `Imported ${data.conclusions?.length || 0} conclusions` }], details: { success: true } };
        } catch (e) {
          return { content: [{ type: "text", text: `Import failed: ${e}` }], details: { success: false, error: String(e) } };
        }
      }
    },
    learn_observe_peer: {
      execute: async (_, params, _signal, _onUpdate, ctx) => {
        const sessionFile = ctx.sessionManager.getSessionFile();
        const observerPeerId = "user";
        store.saveObservation({
          id: crypto.randomUUID(),
          workspaceId: config.workspaceId,
          peerId: observerPeerId,
          aboutPeerId: params.aboutPeerId,
          sessionId: params.sessionId || sessionFile || "default",
          role: "user",
          content: params.content,
          createdAt: Date.now(),
          processed: false
        });
        return { content: [{ type: "text", text: `Observation recorded about ${params.aboutPeerId}` }], details: { success: true, aboutPeerId: params.aboutPeerId } };
      }
    },
    learn_get_perspective: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const perspective = contextAssembler.getPerspective(config.workspaceId, params.observerPeerId, params.targetPeerId);
        if (!perspective) {
          return { content: [{ type: "text", text: `No perspective data found for ${params.observerPeerId} on ${params.targetPeerId}` }], details: { found: false } };
        }
        return { content: [{ type: "text", text: perspective }], details: { found: true, observerPeerId: params.observerPeerId, targetPeerId: params.targetPeerId } };
      }
    },
    learn_test_hybrid: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const blended = contextAssembler.getBlendedContext(config.workspaceId, peerId);
        const globalConclusions = store.getGlobalConclusions(peerId, 100);
        const projectConclusions = store.getConclusions(config.workspaceId, peerId, 100);
        const globalCard = store.getPeerCard("__global__", peerId);
        const projectCard = store.getPeerCard(config.workspaceId, peerId);
        const lines = [
          "## Hybrid Memory Test",
          "",
          `**Workspace ID**: ${config.workspaceId}`,
          `**Global Workspace**: __global__`,
          "",
          "### Scope Summary",
          `| Scope | Conclusions | Has Peer Card |`,
          `|-------|-------------|---------------|`,
          `| Global (__global__) | ${globalConclusions.length} | ${globalCard ? "Yes" : "No"} |`,
          `| Project (${config.workspaceId}) | ${projectConclusions.length} | ${projectCard ? "Yes" : "No"} |`,
          "",
          "### Global Conclusions (user scope)"
        ];
        if (globalConclusions.length === 0) {
          lines.push("  _(none yet)_");
        } else {
          globalConclusions.slice(0, 5).forEach((c) => {
            lines.push(`  - [${c.type}] ${c.content.slice(0, 80)}${c.content.length > 80 ? "..." : ""}`);
          });
          if (globalConclusions.length > 5) {
            lines.push(`  _... and ${globalConclusions.length - 5} more_`);
          }
        }
        lines.push("", "### Project Conclusions (project scope)");
        if (projectConclusions.length === 0) {
          lines.push("  _(none yet)_");
        } else {
          projectConclusions.slice(0, 5).forEach((c) => {
            lines.push(`  - [${c.type}] ${c.content.slice(0, 80)}${c.content.length > 80 ? "..." : ""}`);
          });
          if (projectConclusions.length > 5) {
            lines.push(`  _... and ${projectConclusions.length - 5} more_`);
          }
        }
        if (globalCard) {
          lines.push("", "### Global Peer Card");
          if (globalCard.name)
            lines.push(`  - Name: ${globalCard.name}`);
          if (globalCard.occupation)
            lines.push(`  - Occupation: ${globalCard.occupation}`);
          if (globalCard.interests.length)
            lines.push(`  - Interests: ${globalCard.interests.join(", ")}`);
          if (globalCard.traits.length)
            lines.push(`  - Traits: ${globalCard.traits.join(", ")}`);
        }
        if (projectCard) {
          lines.push("", "### Project Peer Card");
          if (projectCard.name)
            lines.push(`  - Name: ${projectCard.name}`);
          if (projectCard.occupation)
            lines.push(`  - Occupation: ${projectCard.occupation}`);
          if (projectCard.interests.length)
            lines.push(`  - Interests: ${projectCard.interests.join(", ")}`);
        }
        lines.push("", "### Blended Context Preview");
        lines.push("```");
        const preview = blended.assembledString.slice(0, 300);
        lines.push(preview + (blended.assembledString.length > 300 ? "..." : ""));
        lines.push("```");
        return {
          content: [{ type: "text", text: lines.join(`
`) }],
          details: {
            globalConclusionCount: globalConclusions.length,
            projectConclusionCount: projectConclusions.length,
            hasGlobalCard: !!globalCard,
            hasProjectCard: !!projectCard,
            blendedContext: blended
          }
        };
      }
    },
    learn_count_by_scope: {
      execute: async (_, params, _signal, _onUpdate, _ctx) => {
        const peerId = params.peerId || "user";
        const globalConclusions = store.getGlobalConclusions(peerId, 1000);
        const allProjectConclusions = store.getConclusions(config.workspaceId, peerId, 1000);
        const projectByScope = {
          project: allProjectConclusions.filter((c) => c.scope === "project").length,
          user: allProjectConclusions.filter((c) => c.scope === "user").length
        };
        const globalByType = {
          deductive: globalConclusions.filter((c) => c.type === "deductive").length,
          inductive: globalConclusions.filter((c) => c.type === "inductive").length,
          abductive: globalConclusions.filter((c) => c.type === "abductive").length
        };
        const projectByType = {
          deductive: allProjectConclusions.filter((c) => c.type === "deductive").length,
          inductive: allProjectConclusions.filter((c) => c.type === "inductive").length,
          abductive: allProjectConclusions.filter((c) => c.type === "abductive").length
        };
        const lines = [
          "## Conclusion Counts by Scope",
          "",
          "```",
          "                    | Global (__global__) | Project",
          "--------------------|---------------------|-------",
          `Total conclusions   | ${String(globalConclusions.length).padEnd(19)} | ${allProjectConclusions.length}`,
          "                    |                     |",
          `  deductive        | ${String(globalByType.deductive).padEnd(19)} | ${projectByType.deductive}`,
          `  inductive        | ${String(globalByType.inductive).padEnd(19)} | ${projectByType.inductive}`,
          `  abductive        | ${String(globalByType.abductive).padEnd(19)} | ${projectByType.abductive}`,
          "                    |                     |",
          `Scope breakdown:    | All 'user'          | project: ${projectByScope.project}, user: ${projectByScope.user}`,
          "```",
          "",
          "**Note**: Global conclusions should all be 'user' scope. Project conclusions can be",
          "either 'project' scope (code decisions) or 'user' scope (traits learned in project)."
        ];
        return {
          content: [{ type: "text", text: lines.join(`
`) }],
          details: {
            global: {
              total: globalConclusions.length,
              byType: globalByType
            },
            project: {
              total: allProjectConclusions.length,
              byScope: projectByScope,
              byType: projectByType
            }
          }
        };
      }
    }
  };
}

// src/index.ts
var notifyCallback = null;
var src_default = async (pi) => {
  const config = loadConfig();
  const dbPath = path.join(os.homedir(), ".pi", "memory", "pi-learn.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const store = await createStore(dbPath);
  await store.init();
  const reasoningEngine = createReasoningEngine({
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaApiKey: config.ollamaApiKey,
    reasoningModel: config.reasoningModel,
    embeddingModel: config.embeddingModel,
    tokenBatchSize: config.tokenBatchSize,
    retry: config.retry,
    concurrency: config.concurrency
  });
  const contextAssembler = createContextAssembler(store);
  store.getOrCreateWorkspace(config.workspaceId, "Default Workspace");
  store.getOrCreatePeer(config.workspaceId, "user", "User", "user");
  store.getOrCreatePeer(config.workspaceId, "agent", "Agent", "agent");
  store.ensureGlobalWorkspace();
  store.ensureGlobalPeer("user", "User");
  store.ensureGlobalPeer("agent", "Agent");
  const runDream = async (scope = "project") => {
    if (!config.dream.enabled)
      return;
    const workspaceId = scope === "user" ? "__global__" : activeWorkspaceId;
    const messages = store.getRecentMessages(activeWorkspaceId, "user", config.dream.batchSize);
    if (messages.length < config.dream.minMessagesSinceLastDream)
      return;
    const blended = contextAssembler.getBlendedContext(activeWorkspaceId, "user");
    const reasoningContext = {
      globalConclusions: blended.global.conclusions,
      localConclusions: blended.project.conclusions,
      globalPeerCard: blended.global.peerCard || undefined
    };
    const result = await reasoningEngine.dream(messages.map((m) => ({ role: m.role, content: m.content })), blended.blendedConclusions, reasoningContext);
    let userScopeCount = 0;
    let projectScopeCount = 0;
    for (const c of result.newConclusions) {
      const conclusionScope = c.scope || scope;
      const conclusionWorkspaceId = conclusionScope === "user" ? "__global__" : activeWorkspaceId;
      store.saveConclusion(conclusionWorkspaceId, {
        id: crypto.randomUUID(),
        peerId: "user",
        type: c.type,
        content: c.content,
        premises: c.premises,
        confidence: c.confidence,
        createdAt: Date.now(),
        sourceSessionId: messages[0]?.session_id || "dream",
        scope: conclusionScope
      });
      if (conclusionScope === "user") {
        userScopeCount++;
      } else {
        projectScopeCount++;
      }
    }
    store.updateDreamMetadata(workspaceId, messages.length, result.newConclusions.length);
    if (result.newConclusions.length > 0) {
      notify(`Dream complete: ${userScopeCount} user-scope, ${projectScopeCount} project-scope conclusions`, "info");
    }
  };
  const notify = (message, type = "info") => {
    if (notifyCallback) {
      notifyCallback(message, type);
    }
  };
  const toolsConfig = {
    workspaceId: config.workspaceId,
    retention: config.retention,
    dream: config.dream
  };
  const executors = createToolExecutors({ store, contextAssembler, reasoningEngine, config: toolsConfig, runDream });
  for (const [name, def] of Object.entries(TOOLS)) {
    const executor = executors[name];
    if (!executor)
      continue;
    const toolDef = {
      name,
      label: def.label,
      description: def.description,
      parameters: def.params,
      execute: executor.execute
    };
    if ("renderResult" in executor) {
      toolDef.renderResult = executor.renderResult;
    }
    pi.registerTool(toolDef);
  }
  pi.registerCommand("learn", {
    description: "Pi-learn memory management",
    handler: async (args, ctx) => {
      notifyCallback = ctx.ui.notify.bind(ctx.ui);
      const [sub, ...rest] = args.trim().split(/\s+/);
      const subArgs = rest.join(" ");
      switch (sub) {
        case "status": {
          const stats = contextAssembler.getMemoryStats(activeWorkspaceId, "user");
          ctx.ui.notify(`Memory Status: ${stats.conclusionCount} conclusions, ${stats.summaryCount} summaries`, "info");
          return;
        }
        case "project": {
          const project = getCurrentProjectInfo();
          if (project) {
            ctx.ui.notify(`Active Project
Name: ${project.name}
ID: ${project.id}
Path: ${project.path}`, "info");
          } else {
            ctx.ui.notify(`Workspace: ${activeWorkspaceId} (no project detected)`, "info");
          }
          return;
        }
        case "context": {
          const assembledCtx = contextAssembler.assembleContext(activeWorkspaceId, "user");
          ctx.ui.notify(assembledCtx || "No context available", "info");
          return;
        }
        case "dream":
          ctx.ui.setStatus("learn", "Dreaming...");
          await runDream();
          ctx.ui.notify("Dream cycle complete", "info");
          return;
        case "dream-status": {
          const dreamMeta = store.getDreamMetadata(activeWorkspaceId);
          const messages = store.getRecentMessages(activeWorkspaceId, "user", 1000);
          const messagesSinceLastDream = messages.filter((m) => m.created_at > dreamMeta.lastDreamedAt).length;
          const lastDreamFormatted = dreamMeta.lastDreamedAt > 0 ? new Date(dreamMeta.lastDreamedAt).toLocaleString() : "Never";
          const nextDreamMs = dreamMeta.lastDreamedAt > 0 ? Math.max(0, dreamMeta.lastDreamedAt + config.dream.intervalMs - Date.now()) : 0;
          ctx.ui.notify(`Dream Status
Enabled: ${config.dream.enabled}
Last Dream: ${lastDreamFormatted}
Total Dreams: ${dreamMeta.dreamCount}
Messages Since: ${messagesSinceLastDream}
Next In: ${nextDreamMs > 0 ? Math.ceil(nextDreamMs / 60000) + " min" : "Ready now"}`, "info");
          return;
        }
        case "prune": {
          const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
          ctx.ui.notify(`Pruned ${result.deleted} records`, "info");
          return;
        }
        case "search":
          if (!subArgs) {
            ctx.ui.notify("Usage: /learn search <query>", "info");
            return;
          }
          const results = store.searchSessions(activeWorkspaceId, subArgs, 5);
          ctx.ui.notify(results.length ? results.map((r, i) => `${i + 1}. ${r.snippet}`).join(`
`) : "No results found", "info");
          return;
        case "sessions": {
          const sessions = store.getAllSessions(activeWorkspaceId);
          ctx.ui.notify(sessions.length ? sessions.slice(0, 10).map((s, i) => `${i + 1}. ${s.id}`).join(`
`) : "No sessions", "info");
          return;
        }
        default:
          ctx.ui.notify("Commands: status, project, context, dream, dream-status, prune, search <query>, sessions", "info");
          return;
      }
    }
  });
  let activeWorkspaceId = config.workspaceId;
  if (config.project.enabled) {
    initProjectIntegration(pi, store, config.project, (newProject) => {
      if (newProject) {
        activeWorkspaceId = newProject.id;
        notify(`Switched to project: ${newProject.name}`, "info");
      } else {
        activeWorkspaceId = config.workspaceId;
        notify("No project detected - using default workspace", "info");
      }
    });
  }
  pi.on("session_start", async (_event, ctx) => {
    store.getOrCreateWorkspace(activeWorkspaceId);
    ctx.ui.notify("Pi-learn memory extension loaded", "info");
    if (config.project.enabled && config.project.autoDetect) {
      pi.sendUserMessage("detect_project", { deliverAs: "steer" });
    }
  });
  pi.on("before_agent_start", async (event, ctx) => {
    if (config.project.enabled && config.project.injectContext) {
      const project = getCurrentProjectInfo();
      if (project) {
        const snippet = createProjectContextSnippet(project);
        return {
          systemPrompt: `${event.systemPrompt}

### Current Project Context
${snippet}`
        };
      }
    }
    return {};
  });
  pi.on("tool_result", async (event, ctx) => {
    if (!config.reasoningEnabled)
      return;
    const toolName = event.toolName;
    if (toolName && toolName.startsWith("learn_")) {
      return;
    }
  });
  if (config.dream.enabled) {
    setTimeout(() => runDream().catch(console.error), 30000);
    setInterval(() => runDream().catch(console.error), config.dream.intervalMs);
  }
  if (config.retention.pruneOnStartup) {
    setTimeout(() => {
      const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
      if (result.deleted > 0) {
        notify(`Pruned ${result.deleted} old records`, "info");
      }
    }, 5000);
  }
  setInterval(() => {
    const result = store.prune(config.retention.retentionDays, config.retention.summaryRetentionDays, config.retention.conclusionRetentionDays);
    if (result.deleted > 0) {
      notify(`Pruned ${result.deleted} old records`, "info");
    }
  }, config.retention.pruneIntervalHours * 60 * 60 * 1000);
};
function loadConfig() {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  let settings = {};
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch (e) {
    console.warn("[pi-learn] Failed to load settings:", e);
  }
  const learnSettings = settings.learn || {};
  return {
    workspaceId: learnSettings.workspaceId || "default",
    reasoningEnabled: learnSettings.reasoningEnabled ?? true,
    reasoningModel: learnSettings.reasoningModel || DEFAULT_REASONING_MODEL,
    embeddingModel: learnSettings.embeddingModel || DEFAULT_EMBEDDING_MODEL,
    tokenBatchSize: learnSettings.tokenBatchSize || DEFAULT_TOKEN_BATCH_SIZE,
    ollamaBaseUrl: settings.ollama?.baseUrl || "http://localhost:11434",
    ollamaApiKey: settings.ollama?.apiKey || "",
    retention: { ...DEFAULT_RETENTION, ...learnSettings.retention },
    dream: { ...DEFAULT_DREAM, ...learnSettings.dream },
    retry: { ...DEFAULT_RETRY_CONFIG, ...learnSettings.retry },
    concurrency: learnSettings.concurrency ?? 1,
    project: { ...DEFAULT_PROJECT_CONFIG, ...learnSettings.project }
  };
}
export {
  src_default as default
};
