/**
 * Custom renderers for pi-learn tools
 *
 * Uses pi-tui Component interface for custom tool rendering
 */
/**
 * Simple text component
 */
class TextComponent {
    lines;
    constructor(text) {
        this.lines = text.split("\n");
    }
    render(width) {
        return this.lines;
    }
    invalidate() { }
}
/**
 * Box component with optional background
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
        const leftPad = " ".repeat(this.paddingX);
        // Top padding
        for (let i = 0; i < this.paddingY; i++) {
            result.push(" ".repeat(width));
        }
        // Render children
        for (const child of this.children) {
            const childLines = child.render(innerWidth);
            for (const line of childLines) {
                const padded = leftPad + line + " ".repeat(Math.max(0, innerWidth - line.length));
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
 * Create a styled header component
 */
function createHeader(text, theme) {
    return new TextComponent(theme.fg("toolTitle", `📚 ${text}`));
}
/**
 * Create a styled label component
 */
function createLabel(text, theme) {
    return new TextComponent(theme.bold(text));
}
/**
 * Create a styled value component
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
 * Truncate a string to fit within a given width, accounting for ANSI codes
 */
function truncateToWidth(text, maxWidth) {
    if (text.length <= maxWidth)
        return text;
    // Account for trailing ellipsis
    return text.slice(0, Math.max(0, maxWidth - 3)) + "...";
}
/**
 * Create a list item component
 */
function createListItem(label, value, theme, maxValueWidth) {
    // Prefix is: "• " + label + ": " = ~13 chars + label length
    const prefixLen = 13 + label.length;
    const availableWidth = maxValueWidth ? maxValueWidth - prefixLen : undefined;
    const truncatedValue = availableWidth ? truncateToWidth(value, availableWidth) : value;
    return new TextComponent(`${theme.fg("accent", "•")} ${theme.bold(label)}: ${truncatedValue}`);
}
/**
 * Create a section divider
 */
function createDivider(theme) {
    return new TextComponent(theme.fg("border", "─".repeat(40)));
}
/**
 * Create a peer card renderer
 */
export function createPeerCardRenderer(data, theme) {
    const children = [];
    children.push(createHeader("Peer Card", theme));
    children.push(createDivider(theme));
    if (data.name) {
        children.push(createListItem("Name", data.name, theme));
    }
    if (data.occupation) {
        children.push(createListItem("Occupation", data.occupation, theme));
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
        children.push(new TextComponent(stats.topInterests.map(i => `  ${theme.fg("accent", "•")} ${i}`).join("\n")));
    }
    if (stats.topTraits.length > 0) {
        children.push(new TextComponent(""));
        children.push(createLabel("Top Traits:", theme));
        children.push(new TextComponent(stats.topTraits.map(t => `  ${theme.fg("accent", "•")} ${t}`).join("\n")));
    }
    return new BoxComponent(children, 1, 0);
}
/**
 * Create a search results renderer
 */
export function createSearchResultsRenderer(results, query, theme) {
    const children = [];
    children.push(createHeader(`Search Results for "${query}"`, theme));
    children.push(createDivider(theme));
    if (results.length === 0) {
        children.push(new TextComponent(theme.fg("muted", "No results found")));
    }
    else {
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const date = new Date(r.createdAt).toLocaleDateString();
            const sessionName = r.sessionId.split("/").pop()?.split("_")[0] || r.sessionId;
            children.push(new TextComponent(""));
            children.push(new TextComponent(`${theme.bold(`${i + 1}.`)} ${theme.fg("accent", date)} - ${sessionName}`));
            children.push(new TextComponent(`   "${r.snippet}"`));
            children.push(new TextComponent(`   ${theme.fg("muted", `(${r.relevance} match${r.relevance > 1 ? "es" : ""})`)}`));
        }
    }
    return new BoxComponent(children, 1, 0);
}
/**
 * Create a session list renderer
 */
export function createSessionListRenderer(sessions, theme) {
    const children = [];
    children.push(createHeader(`Sessions (${sessions.length} total)`, theme));
    children.push(createDivider(theme));
    if (sessions.length === 0) {
        children.push(new TextComponent(theme.fg("muted", "No sessions found")));
    }
    else {
        for (let i = 0; i < Math.min(sessions.length, 20); i++) {
            const s = sessions[i];
            const date = new Date(s.createdAt).toLocaleDateString();
            const sessionName = s.id.split("/").pop()?.split("_")[0] || s.id;
            children.push(new TextComponent(""));
            children.push(new TextComponent(`${theme.bold(`${i + 1}.`)} ${sessionName}`));
            children.push(new TextComponent(`   ${theme.fg("muted", `Created: ${date}, Messages: ${s.messageCount}`)}`));
        }
    }
    return new BoxComponent(children, 1, 0);
}
/**
 * Create a conclusions renderer
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
            children.push(new TextComponent(""));
            children.push(new TextComponent(`${theme.bold(`${i + 1}.`)} [${theme.fg(typeColor, c.type)}] ${(c.confidence * 100).toFixed(0)}% confidence`));
            children.push(new TextComponent(`   ${c.content.slice(0, 100)}${c.content.length > 100 ? "..." : ""}`));
        }
    }
    return new BoxComponent(children, 1, 0);
}
export { TextComponent, BoxComponent, createHeader, createLabel, createValue, createStatus, createListItem, createDivider, };
//# sourceMappingURL=renderers.js.map