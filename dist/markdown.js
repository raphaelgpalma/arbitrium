import chalk from "chalk";
import { theme } from "./ui.js";
/**
 * Minimal Markdown → ANSI renderer for the terminal.
 *
 * Two entry points share the same line-level logic:
 *  - renderMarkdown(text): render a complete string (one-shot answers).
 *  - new MarkdownStream(): render incrementally as tokens stream in, flushing
 *    one full line at a time so formatting stays stable while typing.
 *
 * It is deliberately small (no external parser) but covers the constructs that
 * coding agents emit most: fenced code, headings, lists, quotes, rules and the
 * common inline spans (code, bold, italic, links, strikethrough).
 */
const CODE_FG = "#c5c8e0";
const CODE_BG = "#2a2a3a";
/** Render the inline spans inside a single line of normal text. */
function inline(s) {
    // Split on inline code first so emphasis never touches code contents.
    const parts = s.split(/(`[^`]+`)/g);
    return parts
        .map((part) => {
        if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
            return chalk.bgHex(CODE_BG).hex("#f0c987")(` ${part.slice(1, -1)} `);
        }
        let t = part;
        // [text](url)
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, url) => `${chalk.hex("#06b6d4").underline(txt)}${chalk.gray(` (${url})`)}`);
        // **bold** / __bold__
        t = t.replace(/\*\*([^*]+)\*\*/g, (_m, x) => chalk.bold(x));
        t = t.replace(/__([^_]+)__/g, (_m, x) => chalk.bold(x));
        // *italic* / _italic_
        t = t.replace(/\*([^*\n]+)\*/g, (_m, x) => chalk.italic(x));
        t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, (_m, pre, x) => `${pre}${chalk.italic(x)}`);
        // ~~strike~~
        t = t.replace(/~~([^~]+)~~/g, (_m, x) => chalk.strikethrough(x));
        return t;
    })
        .join("");
}
function newState() {
    return { inFence: false, fenceLang: "" };
}
/** Render one logical line of markdown, mutating fence state as needed. */
function renderLine(line, st) {
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
        if (!st.inFence) {
            st.inFence = true;
            st.fenceLang = fence[1].trim();
            const lang = st.fenceLang ? theme.dim(` ${st.fenceLang}`) : "";
            return theme.dim("  ╭─") + lang;
        }
        st.inFence = false;
        st.fenceLang = "";
        return theme.dim("  ╰─");
    }
    if (st.inFence) {
        return theme.dim("  │ ") + chalk.hex(CODE_FG)(line);
    }
    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
        const level = h[1].length;
        const txt = inline(h[2]);
        if (level === 1)
            return chalk.bold.hex("#7c3aed")(`▌ ${h[2].toUpperCase()}`);
        if (level === 2)
            return chalk.bold.hex("#a855f7")(`▌ ${h[2]}`);
        return chalk.bold.hex("#06b6d4")(txt);
    }
    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        const w = Math.min(60, (process.stdout.columns || 80) - 2);
        return theme.dim("─".repeat(w));
    }
    // Blockquote
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq)
        return `${theme.dim("  ▏")} ${chalk.italic.gray(inline(bq[1]))}`;
    // Bullet list
    const b = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (b)
        return `${b[1]}${theme.primary("•")} ${inline(b[2])}`;
    // Numbered list
    const n = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (n)
        return `${n[1]}${theme.accent(`${n[2]}.`)} ${inline(n[3])}`;
    return inline(line);
}
/** Render a complete markdown document to an ANSI string. */
export function renderMarkdown(text) {
    const st = newState();
    return text
        .split("\n")
        .map((l) => renderLine(l, st))
        .join("\n");
}
/**
 * Incremental renderer for streaming output. Buffers partial input and emits
 * one fully-rendered line at a time, so what's on screen never has to be
 * rewritten as more tokens arrive.
 */
export class MarkdownStream {
    buf = "";
    st = newState();
    out;
    constructor(out = process.stdout) {
        this.out = out;
    }
    push(chunk) {
        this.buf += chunk;
        let idx;
        while ((idx = this.buf.indexOf("\n")) !== -1) {
            const line = this.buf.slice(0, idx);
            this.buf = this.buf.slice(idx + 1);
            this.out.write(`${renderLine(line, this.st)}\n`);
        }
    }
    /** Flush any trailing partial line. */
    end() {
        if (this.buf.length) {
            this.out.write(`${renderLine(this.buf, this.st)}\n`);
            this.buf = "";
        }
    }
}
