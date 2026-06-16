const DEFAULT_RULES = [
    { permission: "bash", pattern: "git *", action: "allow" },
    { permission: "bash", pattern: "npm *", action: "allow" },
    { permission: "bash", pattern: "ls *", action: "allow" },
    { permission: "bash", pattern: "cat *", action: "allow" },
    { permission: "bash", pattern: "find *", action: "allow" },
    { permission: "bash", pattern: "mkdir *", action: "allow" },
    { permission: "bash", pattern: "chmod *", action: "allow" },
    { permission: "bash", pattern: "npx *", action: "allow" },
    { permission: "bash", pattern: "node *", action: "allow" },
    { permission: "bash", pattern: "tsx *", action: "allow" },
    { permission: "bash", pattern: "bun *", action: "allow" },
    { permission: "bash", pattern: "cargo *", action: "allow" },
    { permission: "bash", pattern: "go *", action: "allow" },
    { permission: "bash", pattern: "python*", action: "allow" },
    { permission: "bash", pattern: "pip *", action: "allow" },
    { permission: "bash", pattern: "curl *", action: "allow" },
    { permission: "bash", pattern: "wget *", action: "allow" },
    { permission: "bash", pattern: "which *", action: "allow" },
    { permission: "bash", pattern: "echo *", action: "allow" },
    { permission: "bash", pattern: "pwd", action: "allow" },
    { permission: "bash", pattern: "env", action: "allow" },
    { permission: "bash", pattern: "uname *", action: "allow" },
    { permission: "bash", pattern: "df *", action: "allow" },
    { permission: "bash", pattern: "du *", action: "allow" },
    { permission: "bash", pattern: "ps *", action: "allow" },
    { permission: "bash", pattern: "kill *", action: "allow" },
    { permission: "bash", pattern: "rm *", action: "ask" },
    { permission: "bash", pattern: "sudo *", action: "ask" },
    { permission: "bash", pattern: "docker *", action: "ask" },
    { permission: "bash", pattern: "systemctl *", action: "ask" },
    { permission: "bash", pattern: "shutdown *", action: "deny" },
    { permission: "bash", pattern: "reboot", action: "deny" },
    { permission: "bash", pattern: "dd *", action: "deny" },
    { permission: "bash", pattern: "mkfs.*", action: "deny" },
    { permission: "bash", pattern: ":(){ :|:& };:*", action: "deny" },
    { permission: "external_directory", pattern: "/tmp/*", action: "allow" },
    { permission: "external_directory", pattern: "/home/*", action: "allow" },
    { permission: "external_directory", pattern: "*", action: "ask" },
];
export function evaluatePermission(permission, pattern, rules = DEFAULT_RULES) {
    for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i];
        if (matchWildcard(permission, rule.permission) && matchWildcard(pattern, rule.pattern)) {
            return rule.action;
        }
    }
    return "ask";
}
function matchWildcard(str, wildcard) {
    if (wildcard === "*")
        return true;
    const re = wildcard
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${re}$`, "i").test(str);
}
