import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
export const readTool = {
    name: "read",
    description: "Read a file or directory. For files, returns content with line numbers. For directories, returns listing. Supports offset and limit for large files. Prefer read for file operations instead of cat when using the agent.",
    parameters: {
        filePath: { type: "string", description: "Absolute path to the file or directory to read", required: true },
        offset: { type: "number", description: "Line number to start reading from (1-indexed)" },
        limit: { type: "number", description: "Maximum number of lines to read (default 2000)" },
    },
    async execute(args, ctx) {
        const filePath = resolve(ctx.cwd, args.filePath);
        const offset = args.offset || 1;
        const limit = args.limit || 2000;
        try {
            const s = await stat(filePath);
            if (s.isDirectory()) {
                const entries = await readdir(filePath);
                const lines = entries.map((e) => (e.endsWith("/") ? e : e + (s.isDirectory() ? "/" : ""))).join("\n");
                return { title: `Directory: ${relative(ctx.cwd, filePath)}`, content: lines };
            }
            const content = await readFile(filePath, "utf8");
            const allLines = content.split("\n");
            const slice = allLines.slice(offset - 1, offset - 1 + limit);
            const numbered = slice.map((l, i) => `${offset + i}: ${l}`).join("\n");
            const truncated = allLines.length > offset - 1 + limit
                ? numbered + `\n\n[Truncated: ${allLines.length - (offset - 1 + limit)} more lines. Use offset=${offset + limit} to continue.]`
                : numbered;
            return { title: `Read: ${relative(ctx.cwd, filePath)} (${allLines.length} lines)`, content: truncated };
        }
        catch (e) {
            return { content: "", error: `Cannot read ${filePath}: ${e.message}` };
        }
    },
};
