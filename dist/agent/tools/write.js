import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
export const writeTool = {
    name: "write",
    description: "Writes a file to the local filesystem. Overwrites existing files. Creates parent directories if needed.",
    parameters: {
        filePath: { type: "string", description: "Absolute path to the file to write", required: true },
        content: { type: "string", description: "The content to write to the file", required: true },
    },
    async execute(args, ctx) {
        const filePath = resolve(ctx.cwd, args.filePath);
        const content = args.content;
        const rel = relative(ctx.cwd, filePath);
        if (rel.startsWith("..") || filePath === "/") {
            const allowed = await ctx.ask("external_directory", filePath);
            if (allowed === "deny")
                return { content: "", error: "Write denied: path outside workspace." };
        }
        try {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, content, "utf8");
            return { title: `Wrote: ${relative(ctx.cwd, filePath)}`, content: `File written: ${relative(ctx.cwd, filePath)} (${content.length} chars)` };
        }
        catch (e) {
            return { content: "", error: `Cannot write ${filePath}: ${e.message}` };
        }
    },
};
