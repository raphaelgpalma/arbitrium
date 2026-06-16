import type { PermissionRule } from "./types.js";
export declare function evaluatePermission(permission: string, pattern: string, rules?: PermissionRule[]): "allow" | "ask" | "deny";
