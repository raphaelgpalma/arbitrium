/**
 * Shared UI theme + helpers for the Arbitrium CLI.
 * Centralizes colors, banner, dividers and the spinner so every command
 * renders with a consistent look.
 */
export declare const theme: {
    primary: (s: string) => string;
    primaryBold: (s: string) => string;
    accent: (s: string) => string;
    dim: (s: string) => string;
    ok: (s: string) => string;
    warn: (s: string) => string;
    err: (s: string) => string;
    text: (s: string) => string;
    label: (s: string) => string;
};
export declare function banner(): string;
/** A full-width rule, optionally with a centered label. */
export declare function divider(label?: string, width?: number): string;
/** A boxed section header used to introduce command output. */
export declare function header(label: string): string;
export interface Spinner {
    update(text: string): void;
    stop(final?: string): void;
}
/**
 * Lightweight spinner. Renders to stderr so it never contaminates stdout
 * (important when the user pipes command output elsewhere).
 */
export declare function spinner(initial: string): Spinner;
