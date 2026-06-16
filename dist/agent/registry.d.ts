import type { ToolDef } from "./types.js";
export declare function getTools(): ToolDef[];
export declare function getTool(name: string): ToolDef | undefined;
/** Dispose of any resources held by tools (e.g. persistent shells). */
export declare function disposeTools(): void;
export declare function toolsToOpenAIFormat(): Array<{
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}>;
