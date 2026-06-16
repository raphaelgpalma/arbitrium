import type { Provider } from "../types.js";
export declare function createOpenAICompatibleProvider(id: string, name: string, baseURL: string, envKey: string, apiKeyRequired: boolean, sseFormat?: boolean): Provider;
