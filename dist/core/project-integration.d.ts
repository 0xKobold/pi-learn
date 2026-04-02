/**
 * Pi-Project Integration for Pi-Learn
 *
 * Automatically switches memory workspace based on detected project.
 * Subscribes to pi-project events and reconfigures workspace scope.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { SQLiteStore } from "./store.js";
interface ProjectInfo {
    id: string;
    name: string;
    path: string;
    repo?: {
        remote: string;
        owner?: string;
        name?: string;
        branch?: string;
    };
    stack?: string[];
    detectedAt: number;
}
export interface ProjectIntegrationConfig {
    enabled: boolean;
    autoDetect: boolean;
    injectContext: boolean;
}
export declare const DEFAULT_PROJECT_CONFIG: ProjectIntegrationConfig;
export declare function initProjectIntegration(pi: ExtensionAPI, store: SQLiteStore, config: ProjectIntegrationConfig, onWorkspaceChange?: (project: ProjectInfo | null) => void): void;
export declare function getCurrentProjectInfo(): ProjectInfo | null;
export declare function createProjectContextSnippet(project: ProjectInfo): string;
export declare function isProjectExtensionAvailable(pi: ExtensionAPI): boolean;
export {};
//# sourceMappingURL=project-integration.d.ts.map