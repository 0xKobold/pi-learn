/**
 * Pi-Project Integration for Pi-Learn
 *
 * Automatically switches memory workspace based on detected project.
 * Subscribes to pi-project events and reconfigures workspace scope.
 */
// Event names must match pi-project's exported constants
const PROJECT_CHANGE_EVENT = "project:change";
const PROJECT_DETECTED_EVENT = "project:detected";
export const DEFAULT_PROJECT_CONFIG = {
    enabled: true,
    autoDetect: true,
    injectContext: true,
};
// Module-level cache for current project info
let cachedProject = null;
export function initProjectIntegration(pi, store, config, onWorkspaceChange) {
    if (!config.enabled)
        return;
    // Subscribe to project changes from pi-project
    pi.events.on(PROJECT_CHANGE_EVENT, (data) => {
        const event = data;
        handleProjectChange(event, store, config, onWorkspaceChange);
    });
    // Also subscribe to initial detection
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
    }
    else if (current) {
        console.log(`[pi-learn] Project detected: ${current.name} (${reason})`);
    }
    else {
        console.log(`[pi-learn] Project cleared (was: ${previous?.name})`);
    }
    if (current) {
        ensureProjectWorkspace(store, current);
        cachedProject = current;
    }
    else {
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
export function getCurrentProjectInfo() {
    return cachedProject;
}
export function createProjectContextSnippet(project) {
    const parts = [
        `Current Project: ${project.name}`,
        `Path: ${project.path}`,
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
    return parts.join("\n");
}
export function isProjectExtensionAvailable(pi) {
    try {
        const tools = pi.getAllTools();
        return tools.some((t) => t.name === "get_current_project");
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=project-integration.js.map