import type { Provider } from "../types.js";
import type { AgentMessage } from "./types.js";
export interface AgentConfig {
    provider: Provider;
    model: string;
    apiKey?: string;
    cwd: string;
    autoApprove: boolean;
    godmode?: boolean;
    onShellProgress?: (data: {
        type: "stdout" | "stderr";
        data: string;
    }) => void;
}
export declare function agentLoop(userMessage: string, history: AgentMessage[], config: AgentConfig): AsyncGenerator<{
    type: "text" | "tool_start" | "tool_end" | "permission" | "done";
    content?: string;
    tool?: string;
    args?: Record<string, unknown>;
    result?: string;
}, void, unknown>;
