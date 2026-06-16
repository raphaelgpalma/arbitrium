import type { ModelInfo } from "../types.js";
export declare function listOpenRouterModels(apiKey?: string): Promise<ModelInfo[]>;
export declare function listOllamaCloudModels(apiKey?: string): Promise<ModelInfo[]>;
export declare function listOllamaLocalModels(baseUrl?: string): Promise<ModelInfo[]>;
export declare function listAllModels(config: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
}): Promise<ModelInfo[]>;
export declare function formatModel(model: ModelInfo): string;
