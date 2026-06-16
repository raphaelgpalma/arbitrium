import type { Provider } from "../types.js";
export declare const PROVIDERS: Record<string, Provider>;
export declare function getProvider(id: string): Provider;
export declare function listProviders(): Provider[];
