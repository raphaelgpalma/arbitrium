import type { ToolDef } from "../types.js";
/** Optional hook for the agent UI to stream live shell output. */
export declare function setShellProgressCallback(handler: ((data: {
    type: "stdout" | "stderr";
    data: string;
}) => void) | undefined): void;
export declare const bashTool: ToolDef;
/** Terminate all persistent shell bridges. Useful on agent session exit. */
export declare function closeAllShellBridges(): void;
