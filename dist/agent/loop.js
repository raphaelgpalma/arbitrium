import { getTool, toolsToOpenAIFormat } from "./registry.js";
import { evaluatePermission } from "./permissions.js";
import { FULL_PROMPT } from "../engine/prompts.js";
import { computeAutoTuneParams } from "../engine/autotune.js";
import { applyStm } from "../engine/stm.js";
const MAX_STEPS = 25;
export async function* agentLoop(userMessage, history, config) {
    const params = computeAutoTuneParams(userMessage);
    // First turn: use the SAME engine as arb ask (no tools)
    if (history.length === 0) {
        const content = await config.provider.chatComplete([{ role: "user", content: userMessage }], {
            model: config.model,
            temperature: params.temperature + 0.1,
            top_p: params.top_p,
            maxTokens: 8192,
            system: FULL_PROMPT,
            apiKey: config.apiKey,
        });
        const final = applyStm(content);
        yield { type: "text", content: final };
        yield { type: "done" };
        return;
    }
    // Subsequent turns: agent mode with tools
    const messages = [
        { role: "system", content: FULL_PROMPT },
        ...history,
        { role: "user", content: userMessage },
    ];
    const allTools = toolsToOpenAIFormat();
    let step = 0;
    let toolsActive = false;
    while (step < MAX_STEPS) {
        step++;
        const tools = toolsActive ? allTools : undefined;
        const response = await callLLM(config.provider, messages, config.model, tools, config.apiKey);
        const choice = response.choices?.[0];
        if (!choice) {
            yield { type: "text", content: "(No response)" };
            break;
        }
        const msg = choice.message;
        if (!msg) {
            yield { type: "text", content: "(Empty message)" };
            break;
        }
        if (msg.content && !msg.tool_calls?.length) {
            yield { type: "text", content: msg.content };
            messages.push({ role: "assistant", content: msg.content });
            break;
        }
        if (msg.tool_calls?.length) {
            toolsActive = true;
            const assistantMsg = {
                role: "assistant",
                content: msg.content || "",
                tool_calls: msg.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: { name: tc.function.name, arguments: tc.function.arguments },
                })),
            };
            messages.push(assistantMsg);
            for (const tc of msg.tool_calls) {
                const toolName = tc.function.name;
                const tool = getTool(toolName);
                let args;
                try {
                    args = JSON.parse(tc.function.arguments);
                }
                catch {
                    yield { type: "tool_end", tool: toolName, result: `Error: Invalid JSON arguments` };
                    messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: Invalid JSON arguments` });
                    continue;
                }
                yield { type: "tool_start", tool: toolName, args };
                if (!tool) {
                    const err = `Unknown tool: ${toolName}`;
                    yield { type: "tool_end", tool: toolName, result: err };
                    messages.push({ role: "tool", tool_call_id: tc.id, content: err });
                    continue;
                }
                const ctx = {
                    cwd: config.cwd,
                    ask: async (permission, pattern) => {
                        const action = evaluatePermission(permission, pattern);
                        if (action === "deny")
                            return "deny";
                        if (action === "allow" || config.autoApprove)
                            return "allow";
                        return "allow";
                    },
                };
                try {
                    const result = await tool.execute(args, ctx);
                    const output = result.error || result.content;
                    yield { type: "tool_end", tool: toolName, result: output };
                    messages.push({ role: "tool", tool_call_id: tc.id, content: output });
                }
                catch (e) {
                    const err = `Tool error: ${e.message}`;
                    yield { type: "tool_end", tool: toolName, result: err };
                    messages.push({ role: "tool", tool_call_id: tc.id, content: err });
                }
            }
            continue;
        }
        break;
    }
    yield { type: "done" };
}
async function callLLM(provider, messages, model, tools, apiKey) {
    const openaiMessages = messages.map((m) => {
        const out = { role: m.role, content: m.content };
        if (m.tool_calls)
            out.tool_calls = m.tool_calls;
        if (m.tool_call_id)
            out.tool_call_id = m.tool_call_id;
        if (m.name)
            out.name = m.name;
        return out;
    });
    const body = {
        model,
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 8192,
        stream: false,
    };
    if (tools) {
        body.tools = tools;
        body.tool_choice = "auto";
    }
    const apiKeyFinal = apiKey || process.env.OPENROUTER_API_KEY || "";
    const baseURL = provider.baseURL;
    const res = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKeyFinal}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://arbitrium.local",
            "X-Title": "Arbitrium Agent",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}
