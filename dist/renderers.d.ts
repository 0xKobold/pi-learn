/**
 * Custom renderers for pi-learn tools
 *
 * Uses pi-tui Component interface for custom tool rendering
 */
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
/**
 * Simple text component
 */
declare class TextComponent implements Component {
    private lines;
    constructor(text: string);
    render(width: number): string[];
    invalidate(): void;
}
/**
 * Box component with optional background
 */
declare class BoxComponent implements Component {
    private children;
    private paddingX;
    private paddingY;
    private bgColor?;
    constructor(children: Component[], paddingX?: number, paddingY?: number, bgColor?: string);
    render(width: number): string[];
    invalidate(): void;
}
/**
 * Create a styled header component
 */
declare function createHeader(text: string, theme: Theme): Component;
/**
 * Create a styled label component
 */
declare function createLabel(text: string, theme: Theme): Component;
/**
 * Create a styled value component
 */
declare function createValue(text: string, theme: Theme): Component;
/**
 * Create a status indicator (✅ or ❌)
 */
declare function createStatus(enabled: boolean, theme: Theme): Component;
/**
 * Create a list item component
 */
declare function createListItem(label: string, value: string, theme: Theme, maxValueWidth?: number): Component;
/**
 * Create a section divider
 */
declare function createDivider(theme: Theme): Component;
/**
 * Create a peer card renderer
 */
export declare function createPeerCardRenderer(data: {
    name?: string;
    occupation?: string;
    interests?: string[];
    traits?: string[];
    goals?: string[];
}, theme: Theme): Component;
/**
 * Create a stats renderer
 */
export declare function createStatsRenderer(stats: {
    conclusionCount: number;
    summaryCount: number;
    hasPeerCard: boolean;
    lastReasonedAt: number | null;
    topInterests: string[];
    topTraits: string[];
}, theme: Theme): Component;
/**
 * Create a search results renderer
 */
export declare function createSearchResultsRenderer(results: Array<{
    sessionId: string;
    createdAt: number;
    snippet: string;
    relevance: number;
}>, query: string, theme: Theme): Component;
/**
 * Create a session list renderer
 */
export declare function createSessionListRenderer(sessions: Array<{
    id: string;
    createdAt: number;
    messageCount: number;
}>, theme: Theme): Component;
/**
 * Create a conclusions renderer
 */
export declare function createConclusionsRenderer(conclusions: Array<{
    type: string;
    content: string;
    confidence: number;
    createdAt: number;
}>, theme: Theme): Component;
export { TextComponent, BoxComponent, createHeader, createLabel, createValue, createStatus, createListItem, createDivider, };
//# sourceMappingURL=renderers.d.ts.map