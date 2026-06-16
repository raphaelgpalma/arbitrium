import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
function minimatch(pattern, str) {
    const re = pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, "«GLOBSTAR»")
        .replace(/\*/g, "[^/]*")
        .replace(/«GLOBSTAR»/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${re}$`).test(str);
}
async function walk(dir, pattern, base, results) {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = join(dir, e.name);
            const rel = relative(base, full);
            if (e.isDirectory()) {
                if (minimatch(pattern, rel + "/") || minimatch(pattern, rel)) {
                    results.push(rel + "/");
                }
                await walk(full, pattern, base, results);
            }
            else if (e.isFile()) {
                if (minimatch(pattern, rel)) {
                    results.push(rel);
                }
            }
        }
    }
    catch {
        /* skip inaccessible */
    }
}
export const globTool = {
    name: "glob",
    description: "Fast file pattern matching. Supports glob patterns like '**/*.js' or 'src/**/*.ts'. Returns matching file paths relative to the search directory.",
    parameters: {
        pattern: { type: "string", description: "The glob pattern to match files against", required: true },
        path: { type: "string", description: "The directory to search in. Defaults to current working directory." },
    },
    async execute(args, ctx) {
        const pattern = args.pattern;
        const searchPath = args.path ? resolve(ctx.cwd, args.path) : ctx.cwd;
        const results = [];
        await walk(searchPath, pattern, searchPath, results);
        const content = results.length > 0
            ? results.sort().join("\n")
            : `No files matched pattern: ${pattern}`;
        return {
            title: `Glob: ${pattern}`,
            content: `${results.length} matches\n\n${content}`,
        };
    },
};
