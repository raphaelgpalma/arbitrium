import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ToolDef, ToolContext, ToolResult } from "../types.js";

async function grepFile(filePath: string, regex: RegExp): Promise<string[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    const matches: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push(`${relative(process.cwd(), filePath)}:${i + 1}: ${lines[i].slice(0, 200)}`);
      }
    }
    return matches;
  } catch {
    return [];
  }
}

async function walkFiles(dir: string, include: string | undefined, results: string[]): Promise<void> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        await walkFiles(full, include, results);
      } else if (e.isFile()) {
        if (!include || new RegExp(include.replace(/\./g, "\\.").replace(/\*/g, ".*")).test(e.name)) {
          results.push(full);
        }
      }
    }
  } catch {
    /* skip */
  }
}

export const grepTool: ToolDef = {
  name: "grep",
  description: "Fast content search tool. Searches file contents using regular expressions. Supports full regex syntax. Filter files by pattern with the include parameter.",
  parameters: {
    pattern: { type: "string", description: "The regex pattern to search for in file contents", required: true },
    path: { type: "string", description: "The directory to search in. Defaults to current working directory." },
    include: { type: "string", description: "File pattern to include (e.g. '*.ts', '*.{ts,tsx}')" },
  },
  async execute(args, ctx) {
    const pattern = args.pattern as string;
    const searchPath = args.path ? resolve(ctx.cwd, args.path as string) : ctx.cwd;
    const include = args.include as string | undefined;

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "i");
    } catch {
      return { content: "", error: `Invalid regex pattern: ${pattern}` };
    }

    const files: string[] = [];
    await walkFiles(searchPath, include, files);

    const allMatches: string[] = [];
    for (const file of files.slice(0, 500)) {
      const matches = await grepFile(file, regex);
      allMatches.push(...matches);
      if (allMatches.length > 200) break;
    }

    const content = allMatches.length > 0
      ? allMatches.join("\n")
      : `No matches found for: ${pattern}`;

    return {
      title: `Grep: ${pattern}`,
      content: `${allMatches.length} matches\n\n${content}`,
    };
  },
};
