import { HALL_OF_FAME } from "../engine/combos.js";
const MODELS_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const CACHE = new Map();
const JAILBREAKABLE_MODELS = new Set(HALL_OF_FAME.map((c) => c.model));
function isJailbreakable(id) {
    // Exact match first
    if (JAILBREAKABLE_MODELS.has(id))
        return true;
    // Fallback: combo model may be a prefix (e.g. deepseek-v4-flash matches deepseek/deepseek-chat? no, but combo has deepseek-v4-flash)
    for (const combo of HALL_OF_FAME) {
        if (id.includes(combo.model) || combo.model.includes(id))
            return true;
    }
    return false;
}
export async function listOpenRouterModels(apiKey) {
    const cached = CACHE.get("openrouter");
    if (cached && Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS)
        return cached.models;
    const headers = { "Content-Type": "application/json" };
    if (apiKey)
        headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (!res.ok)
        throw new Error(`OpenRouter models error ${res.status}: ${await res.text().catch(() => "")}`);
    const data = (await res.json());
    const models = (data.data || []).map((m) => ({
        id: m.id,
        provider: "openrouter",
        name: (m.name || m.id),
        context: m.context_length,
        pricing: { input: m.pricing?.prompt || 0, output: m.pricing?.completion || 0 },
        jailbreakable: isJailbreakable(m.id),
    }));
    CACHE.set("openrouter", { fetchedAt: Date.now(), models });
    return models;
}
export async function listOllamaCloudModels(apiKey) {
    const cached = CACHE.get("ollama-cloud");
    if (cached && Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS)
        return cached.models;
    const headers = { "Content-Type": "application/json" };
    if (apiKey)
        headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch("https://ollama.com/v1/models", { headers });
    if (!res.ok)
        throw new Error(`Ollama Cloud models error ${res.status}: ${await res.text().catch(() => "")}`);
    const data = (await res.json());
    const models = ((data.data || data.models) || []).map((m) => ({
        id: (m.model || m.id || m.name),
        provider: "ollama-cloud",
        name: (m.name || m.model || m.id),
        context: m.details?.context_length,
        pricing: { input: 0, output: 0 },
        jailbreakable: isJailbreakable(m.id || m.model || ""),
    }));
    CACHE.set("ollama-cloud", { fetchedAt: Date.now(), models });
    return models;
}
export async function listOllamaLocalModels(baseUrl) {
    const url = (baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
    const cached = CACHE.get(`ollama:${url}`);
    if (cached && Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS)
        return cached.models;
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok)
        throw new Error(`Ollama local models error ${res.status}: ${await res.text().catch(() => "")}`);
    const data = (await res.json());
    const models = (data.models || []).map((m) => ({
        id: (m.model || m.name),
        provider: "ollama",
        name: (m.name || m.model),
        context: m.details?.context_length,
        pricing: { input: 0, output: 0 },
        jailbreakable: isJailbreakable(m.model || m.name || ""),
    }));
    CACHE.set(`ollama:${url}`, { fetchedAt: Date.now(), models });
    return models;
}
export async function listAllModels(config) {
    switch (config.provider) {
        case "openrouter":
            return listOpenRouterModels(config.apiKey);
        case "ollama-cloud":
            return listOllamaCloudModels(config.apiKey);
        case "ollama":
            return listOllamaLocalModels(config.baseUrl);
        default:
            return [];
    }
}
export function formatModel(model) {
    const price = model.pricing
        ? `\$${(model.pricing.input * 1e6).toFixed(2)}/M in · \$${(model.pricing.output * 1e6).toFixed(2)}/M out`
        : "pricing unknown";
    const jb = model.jailbreakable ? " · godmode-ready" : "";
    const ctx = model.context ? ` · ${(model.context / 1000).toFixed(0)}k ctx` : "";
    return `${model.id.padEnd(42)} ${price}${ctx}${jb}`;
}
