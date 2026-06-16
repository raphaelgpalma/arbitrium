import type { ToolDef } from "./types.js";
export declare function getTools(): ToolDef[];
export declare function getTool(name: string): ToolDef | undefined;
export declare function toolsToOpenAIFormat(): Array<{
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}>;
