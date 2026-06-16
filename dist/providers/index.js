import { createOpenAICompatibleProvider } from "./openai-compat.js";
export const PROVIDERS = {
    openrouter: createOpenAICompatibleProvider("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", true),
    ollama: createOpenAICompatibleProvider("ollama", "Ollama (Local)", process.env.OLLAMA_HOST || "http://localhost:11434", "OLLAMA_API_KEY", false, false),
    "ollama-cloud": createOpenAICompatibleProvider("ollama-cloud", "Ollama Cloud", "https://ollama.com/v1", "OLLAMA_CLOUD_API_KEY", true),
};
export function getProvider(id) {
    const p = PROVIDERS[id];
    if (!p)
        throw new Error(`Unknown provider: ${id}. Available: ${Object.keys(PROVIDERS).join(", ")}`);
    return p;
}
export function listProviders() {
    return Object.values(PROVIDERS);
}
