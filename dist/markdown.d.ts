/** Render a complete markdown document to an ANSI string. */
export declare function renderMarkdown(text: string): string;
/**
 * Incremental renderer for streaming output. Buffers partial input and emits
 * one fully-rendered line at a time, so what's on screen never has to be
 * rewritten as more tokens arrive.
 */
export declare class MarkdownStream {
    private buf;
    private st;
    private out;
    constructor(out?: NodeJS.WriteStream);
    push(chunk: string): void;
    /** Flush any trailing partial line. */
    end(): void;
}
