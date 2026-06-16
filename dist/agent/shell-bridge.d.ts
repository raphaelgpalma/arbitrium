import { EventEmitter } from "node:events";
import type { ToolResult } from "./types.js";
export interface ShellOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    shell?: string;
    timeout?: number;
}
export interface ShellCommand {
    command: string;
    description?: string;
    timeout?: number;
}
export interface ShellProgress {
    type: "stdout" | "stderr";
    data: string;
}
/**
 * Persistent shell bridge.
 *
 * OpenCode / Claude Code keep a long-lived shell (often a PTY) so that
 * `cd`, environment variables, background jobs, and interactive programs
 * persist across tool calls. Arbitrium implements the same idea using only
 * Node built-ins: a single `bash` child process stays alive for the lifetime
 * of the agent session, and commands are sent down its stdin delimited by a
 * marker. If `node-pty` happens to be installed, it is used automatically for
 * a true PTY experience.
 */
export declare class ShellBridge extends EventEmitter {
    private child;
    private pty;
    private buffer;
    private current;
    private ready;
    private startPromise;
    private queue;
    private marker;
    private cwd;
    private shell;
    private env;
    constructor(options: ShellOptions);
    start(): Promise<void>;
    private doStart;
    stop(): void;
    get isReady(): boolean;
    private waitForReady;
    /**
     * Run one command in the persistent shell. Returns a promise that resolves
     * when the marker following the command is observed. Streams partial stdout/
     * stderr through the `progress` callback.
     */
    run(cmd: ShellCommand, onProgress?: (p: ShellProgress) => void): Promise<ToolResult>;
    private runInternal;
    private normalizeCommand;
    private wrapCommand;
    private handleData;
    private handleExit;
    private handleError;
    private finishCurrent;
    private dequeue;
    private stripControlCodes;
    private stripBashNoise;
}
export declare function setShellProgressHandler(handler: ((p: ShellProgress) => void) | undefined): void;
export declare function createShellBridge(options: ShellOptions): ShellBridge;
