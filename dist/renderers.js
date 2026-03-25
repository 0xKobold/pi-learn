/**
 * Custom renderers for pi-learn tools
 *
 * Uses pi-tui Component interface for custom tool rendering
 * All output properly truncates to fit terminal width
 */
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
// ANSI escape code patterns for stripping color codes when measuring
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
/**
 * Get visible width of text (stripping ANSI codes)
 */
function measureWidth(text) {
    return visibleWidth(text);
}
/**
 * Truncate text to fit within maxWidth, preserving ANSI colors
 */
function fitText(text, maxWidth) {
    if (maxWidth <= 0)
        return "";
    return truncateToWidth(text, maxWidth);
}
/**
 * Simple text component with proper width truncation
 */
class TextComponent {
    text;
    maxLines;
    constructor(text, maxLines = 0) {
        this.text = text;
        this.maxLines = maxLines;
    }
    render(width) {
        const lines = this.text.split("\n");
        const result = [];
        for (let i = 0; i < lines.length; i++) {
            // Respect maxLines if set (0 = unlimited)
            if (this.maxLines > 0 && i >= this.maxLines) {
                result.push(fitText(`... and ${lines.length - this.maxLines} more lines`, width));
                break;
            }
            result.push(fitText(lines[i], width));
        }
        return result;
    }
    invalidate() { }
}
/**
 * Box component with proper width truncation for all children
 */
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
        // Top padding
        for (let i = 0; i < this.paddingY; i++) {
            result.push(" ".repeat(width));
        }
        // Render children
        for (const child of this.children) {
            const childLines = child.render(innerWidth);
            for (const line of childLines) {
                // Truncate line to innerWidth
                const truncated = fitText(line, innerWidth);
                const padded = " ".repeat(this.paddingX) + truncated + " ".repeat(Math.max(0, innerWidth - measureWidth(truncated)));
                result.push(padded);
            }
        }
        // Bottom padding
        for (let i = 0; i < this.paddingY; i++) {
            result.push(" ".repeat(width));
        }
        return result;
    }
    invalidate() { }
}
/**
 * Create a styled header component with width truncation
 */
function createHeader(text, theme) {
    return new TextComponent(theme.fg("toolTitle", `📚 ${text}`));
}
/**
 * Create a styled label component with width truncation
 */
function createLabel(text, theme) {
    return new TextComponent(theme.bold(text));
}
/**
 * Create a styled value component with width truncation
 */
function createValue(text, theme) {
    return new TextComponent(text);
}
/**
 * Create a status indicator (✅ or ❌)
 */
function createStatus(enabled, theme) {
    return new TextComponent(enabled ? theme.fg("success", "✅") : theme.fg("error", "❌"));
}
/**
 * Create a list item component with width truncation
 */
function createListItem(label, value, theme, maxValueWidth = 40) {
    const prefix = `${theme.fg("accent", "•")} ${theme.bold(label + ":")} `;
    const prefixWidth = measureWidth(prefix);
    const availableWidth = Math.max(1, maxValueWidth - prefixWidth);
    const truncatedValue = fitText(value, availableWidth);
    return new TextComponent(prefix + truncatedValue);
}
/**
 * Create a section divider with width truncation
 */
function createDivider(theme, width = 40) {
    return new TextComponent(theme.fg("border", "─".repeat(width)));
}
/**
 * Create a peer card renderer
 */
export function createPeerCardRenderer(data, theme) {
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
/**
 * Create a stats renderer
 */
export function createStatsRenderer(stats, theme) {
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
        // Truncate interests list
        const interestsText = stats.topInterests
            .slice(0, 5)
            .map(i => `  ${theme.fg("accent", "•")} ${i}`)
            .join("\n");
        children.push(new TextComponent(fitText(interestsText, 50)));
    }
    if (stats.topTraits.length > 0) {
        children.push(new TextComponent(""));
        children.push(createLabel("Top Traits:", theme));
        const traitsText = stats.topTraits
            .slice(0, 5)
            .map(t => `  ${theme.fg("accent", "•")} ${t}`)
            .join("\n");
        children.push(new TextComponent(fitText(traitsText, 50)));
    }
    return new BoxComponent(children, 1, 0);
}
/**
 * Create a search results renderer with proper truncation
 */
export function createSearchResultsRenderer(results, query, theme) {
    const children = [];
    // Truncate query in header if too long
    const headerQuery = query.length > 30 ? query.slice(0, 27) + "..." : query;
    children.push(createHeader(`Search Results for "${headerQuery}"`, theme));
    children.push(createDivider(theme));
    if (results.length === 0) {
        children.push(new TextComponent(theme.fg("muted", "No results found")));
    }
    else {
        // Limit to 10 results
        const limited = results.slice(0, 10);
        for (let i = 0; i < limited.length; i++) {
            const r = limited[i];
            const date = new Date(r.createdAt).toLocaleDateString();
            // Truncate session ID
            const sessionParts = r.sessionId.split("/");
            const sessionName = sessionParts.length > 1
                ? sessionParts.slice(-2).join("/") // last 2 parts
                : r.sessionId;
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
/**
 * Create a session list renderer with proper truncation
 */
export function createSessionListRenderer(sessions, theme) {
    const children = [];
    children.push(createHeader(`Sessions (${sessions.length} total)`, theme));
    children.push(createDivider(theme));
    if (sessions.length === 0) {
        children.push(new TextComponent(theme.fg("muted", "No sessions found")));
    }
    else {
        // Limit to 15 sessions
        const limited = sessions.slice(0, 15);
        for (let i = 0; i < limited.length; i++) {
            const s = limited[i];
            const date = new Date(s.createdAt).toLocaleDateString();
            // Truncate session ID - take last 2 path components
            const sessionParts = s.id.split("/");
            const sessionName = sessionParts.length > 2
                ? ".../" + sessionParts.slice(-2).join("/")
                : s.id;
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
/**
 * Create a conclusions renderer with proper truncation
 */
export function createConclusionsRenderer(conclusions, theme) {
    const children = [];
    children.push(createHeader(`Conclusions (${conclusions.length})`, theme));
    children.push(createDivider(theme));
    if (conclusions.length === 0) {
        children.push(new TextComponent(theme.fg("muted", "No conclusions yet")));
    }
    else {
        // Show top 10 by confidence
        const sorted = [...conclusions]
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10);
        for (let i = 0; i < sorted.length; i++) {
            const c = sorted[i];
            const typeColor = c.type === "deductive" ? "success" : c.type === "inductive" ? "accent" : "muted";
            const confidenceText = `${(c.confidence * 100).toFixed(0)}%`;
            children.push(new TextComponent(""));
            children.push(new TextComponent(fitText(`${theme.bold(`${i + 1}.`)} [${theme.fg(typeColor, c.type)}] ${theme.fg("accent", confidenceText)} confidence`, 60)));
            // Truncate content to 100 chars
            const truncatedContent = c.content.length > 100 ? c.content.slice(0, 97) + "..." : c.content;
            children.push(new TextComponent(fitText(`   ${truncatedContent}`, 80)));
        }
        if (conclusions.length > 10) {
            children.push(new TextComponent(""));
            children.push(new TextComponent(theme.fg("muted", `... and ${conclusions.length - 10} more conclusions`)));
        }
    }
    return new BoxComponent(children, 1, 0);
}
export { TextComponent, BoxComponent, createHeader, createLabel, createValue, createStatus, createListItem, createDivider, fitText, measureWidth, };
//# sourceMappingURL=renderers.js.map