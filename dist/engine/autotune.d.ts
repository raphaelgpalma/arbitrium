/**
 * AutoTune - Context-adaptive sampling parameter engine.
 */
interface TuneProfile {
    temperature: number;
    top_p: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}
export declare function computeAutoTuneParams(query: string): TuneProfile;
export {};
