async function* streamSSE(reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.startsWith("data: "))
                continue;
            const json = line.slice(6);
            if (json.trim() === "[DONE]")
                return;
            try {
                const ev = JSON.parse(json);
                const delta = ev.choices?.[0]?.delta?.content || ev.choices?.[0]?.text || "";
                if (delta)
                    yield delta;
            }
            catch {
                /* skip malformed */
            }
        }
    }
}
async function* streamJSON(reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const ev = JSON.parse(line);
                const content = ev.message?.content || ev.choices?.[0]?.delta?.content || ev.response || "";
                if (content)
                    yield content;
            }
            catch {
                /* skip malformed */
            }
        }
    }
}
function buildHeaders(apiKey, referer) {
    return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "Arbitrium",
    };
}
function buildBody(messages, opts) {
    const body = {
        model: opts.model,
        messages: opts.system ? [{ role: "system", content: opts.system }, ...messages] : messages,
        temperature: opts.temperature ?? 0.7,
        top_p: opts.top_p ?? 1,
        max_tokens: opts.maxTokens ?? 4096,
        stream: opts.stream !== false,
    };
    return body;
}
export function createOpenAICompatibleProvider(id, name, baseURL, envKey, apiKeyRequired, sseFormat = true) {
    return {
        id,
        name,
        baseURL,
        envKey,
        apiKeyRequired,
        async *chat(messages, opts) {
            const apiKey = opts.apiKey || process.env[envKey] || "";
            const url = `${baseURL}/chat/completions`;
            const res = await fetch(url, {
                method: "POST",
                headers: buildHeaders(apiKey, "https://arbitrium.local"),
                body: JSON.stringify(buildBody(messages, opts)),
                signal: opts.signal,
            });
            if (!res.ok)
                throw new Error(`${name} error ${res.status}: ${await res.text().catch(() => "")}`);
            if (!res.body)
                throw new Error("No response body");
            const reader = res.body.getReader();
            const gen = sseFormat ? streamSSE(reader) : streamJSON(reader);
            for await (const chunk of gen)
                yield chunk;
        },
        async chatComplete(messages, opts) {
            const apiKey = opts.apiKey || process.env[envKey] || "";
            const url = `${baseURL}/chat/completions`;
            const res = await fetch(url, {
                method: "POST",
                headers: buildHeaders(apiKey, "https://arbitrium.local"),
                body: JSON.stringify({ ...buildBody(messages, opts), stream: false }),
                signal: opts.signal,
            });
            if (!res.ok)
                throw new Error(`${name} error ${res.status}: ${await res.text().catch(() => "")}`);
            const data = await res.json();
            return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
        },
    };
}
