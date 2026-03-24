/**
 * Unit Tests for Modular SQLiteStore
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createStore } from "../src/core/store.js";

const testDir = path.join(os.tmpdir(), `pi-learn-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

describe("SQLiteStore Unit Tests", () => {
  describe("Workspace Operations", () => {
    it("creates and retrieves workspace", () => {
      const store = createStore(path.join(testDir, "ws.db"));
      const ws = store.getOrCreateWorkspace("test-ws", "Test Workspace");
      expect(ws.id).toBe("test-ws");
      expect(ws.name).toBe("Test Workspace");
      store;
    });

    it("returns null for missing workspace", () => {
      const store = createStore(path.join(testDir, "ws2.db"));
      expect(store.getWorkspace("missing")).toBeNull();
      store;
    });
  });

  describe("Peer Operations", () => {
    it("creates and retrieves peer", () => {
      const store = createStore(path.join(testDir, "peer.db"));
      store.getOrCreateWorkspace("ws");
      const peer = store.getOrCreatePeer("ws", "user", "Test User", "user");
      expect(peer.id).toBe("user");
      expect(peer.type).toBe("user");
      store;
    });

    it("lists all peers", () => {
      const store = createStore(path.join(testDir, "peers.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "u1", "User 1", "user");
      store.getOrCreatePeer("ws", "u2", "User 2", "user");
      const peers = store.getAllPeers("ws");
      expect(peers.length).toBeGreaterThanOrEqual(2);
      store;
    });
  });

  describe("Conclusion Operations", () => {
    it("saves and retrieves conclusions", () => {
      const store = createStore(path.join(testDir, "conc.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "user", "User", "user");
      store.saveConclusion("ws", {
        id: "c1", peerId: "user", type: "deductive", content: "Test conclusion",
        premises: ["test"], confidence: 0.8, createdAt: Date.now(), sourceSessionId: "s1",
      });
      const results = store.getConclusions("ws", "user", 10);
      expect(results.length).toBe(1);
      expect(results[0].content).toBe("Test conclusion");
      store;
    });
  });

  describe("PeerCard Operations", () => {
    it("saves and retrieves peer card", () => {
      const store = createStore(path.join(testDir, "card.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "user", "User", "user");
      store.savePeerCard("ws", {
        peerId: "user", name: "Warren", occupation: "Dev",
        interests: ["AI"], traits: ["detail"], goals: ["build"], updatedAt: Date.now(),
      });
      const retrieved = store.getPeerCard("ws", "user");
      expect(retrieved?.name).toBe("Warren");
      expect(retrieved?.interests).toContain("AI");
      store;
    });
  });

  describe("Retention", () => {
    it("prunes old data based on retention config", () => {
      const store = createStore(path.join(testDir, "prune.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "user", "User", "user");
      store.saveSummary("ws", {
        id: "old", sessionId: "s1", peerId: "user", type: "short",
        content: "Old", messageCount: 5, createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
      });
      const result = store.prune(0, 30, 0);
      expect(result.deleted).toBe(1);
      store;
    });
  });

  describe("Search", () => {
    it("searches sessions by keyword", () => {
      const store = createStore(path.join(testDir, "search.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "user", "User", "user");
      store.getOrCreateSession("ws", "s1", ["user"]);
      store.saveMessage("ws", {
        id: "m1", sessionId: "s1", peerId: "user", role: "user",
        content: "Testing search functionality", createdAt: Date.now(),
      });
      const results = store.searchSessions("ws", "search", 10);
      expect(results.length).toBe(1);
      store;
    });
  });

  describe("Export/Import", () => {
    it("exports all data", () => {
      const store = createStore(path.join(testDir, "export.db"));
      store.getOrCreateWorkspace("ws");
      store.getOrCreatePeer("ws", "user", "User", "user");
      store.savePeerCard("ws", {
        peerId: "user", name: "Test", occupation: "Dev",
        interests: [], traits: [], goals: [], updatedAt: Date.now(),
      });
      const data = store.exportAll("ws");
      expect(data.version).toBe("1.0.0");
      expect(data.peerCards.length).toBeGreaterThan(0);
      store;
    });

    it("imports data with merge", () => {
      const store = createStore(path.join(testDir, "import.db"));
      store.getOrCreateWorkspace("ws");
      const data = {
        version: "1.0.0", exportedAt: Date.now(), workspace: { id: "ws", name: "Test", createdAt: Date.now(), config: {} },
        peers: [], conclusions: [], summaries: [], observations: [],
        peerCards: [{ peerId: "restored", name: "Restored", occupation: "Tester", interests: [], traits: [], goals: [], updatedAt: Date.now() }],
      };
      store.importAll("ws", data, true);
      const card = store.getPeerCard("ws", "restored");
      expect(card?.name).toBe("Restored");
      store;
    });
  });
});
