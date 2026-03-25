/**
 * Custom renderers for pi-learn tools
 *
 * Uses pi-tui Component interface for custom tool rendering
 * All output properly truncates to fit terminal width
 */
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
/**
 * Get visible width of text (stripping ANSI codes)
 */
declare function measureWidth(text: string): number;
/**
 * Truncate text to fit within maxWidth, preserving ANSI colors
 */
declare function fitText(text: string, maxWidth: number): string;
/**
 * Simple text component with proper width truncation
 */
declare class TextComponent implements Component {
    private text;
    private maxLines;
    constructor(text: string, maxLines?: number);
    render(width: number): string[];
    invalidate(): void;
}
/**
 * Box component with proper width truncation for all children
 */
declare class BoxComponent implements Component {
    private children;
    private paddingX;
    private paddingY;
    private bgColor?;
    constructor(children: Component[], paddingX?: number, paddingY?: number, bgColor?: string | undefined);
    render(width: number): string[];
    invalidate(): void;
}
/**
 * Create a styled header component with width truncation
 */
declare function createHeader(text: string, theme: Theme): Component;
/**
 * Create a styled label component with width truncation
 */
declare function createLabel(text: string, theme: Theme): Component;
/**
 * Create a styled value component with width truncation
 */
declare function createValue(text: string, theme: Theme): Component;
/**
 * Create a status indicator (✅ or ❌)
 */
declare function createStatus(enabled: boolean, theme: Theme): Component;
/**
 * Create a list item component with width truncation
 */
declare function createListItem(label: string, value: string, theme: Theme, maxValueWidth?: number): Component;
/**
 * Create a section divider with width truncation
 */
declare function createDivider(theme: Theme, width?: number): Component;
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
 * Create a search results renderer with proper truncation
 */
export declare function createSearchResultsRenderer(results: Array<{
    sessionId: string;
    createdAt: number;
    snippet: string;
    relevance: number;
}>, query: string, theme: Theme): Component;
/**
 * Create a session list renderer with proper truncation
 */
export declare function createSessionListRenderer(sessions: Array<{
    id: string;
    createdAt: number;
    messageCount: number;
    tags?: string[];
}>, theme: Theme): Component;
/**
 * Create a conclusions renderer with proper truncation
 */
export declare function createConclusionsRenderer(conclusions: Array<{
    type: string;
    content: string;
    confidence: number;
    createdAt: number;
}>, theme: Theme): Component;
export { TextComponent, BoxComponent, createHeader, createLabel, createValue, createStatus, createListItem, createDivider, fitText, measureWidth, };
//# sourceMappingURL=renderers.d.ts.map