import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ToolDef, ToolContext, ToolResult } from "../types.js";

export const editTool: ToolDef = {
  name: "edit",
  description: "Performs exact string replacements in files. Use replaceAll to replace all occurrences. Fails if oldString is not found or found multiple times without enough context.",
  parameters: {
    filePath: { type: "string", description: "Absolute path to the file to modify", required: true },
    oldString: { type: "string", description: "The text to replace", required: true },
    newString: { type: "string", description: "The text to replace it with (must be different from oldString)", required: true },
    replaceAll: { type: "boolean", description: "Replace all occurrences of oldString (default false)" },
  },
  async execute(args, ctx) {
    const filePath = resolve(ctx.cwd, args.filePath as string);
    const oldStr = args.oldString as string;
    const newStr = args.newString as string;
    const replaceAll = args.replaceAll as boolean;

    try {
      const content = await readFile(filePath, "utf8");
      if (!content.includes(oldStr)) {
        return { content: "", error: `oldString not found in ${relative(ctx.cwd, filePath)}` };
      }

      const count = content.split(oldStr).length - 1;
      if (count > 1 && !replaceAll) {
        return { content: "", error: `Found ${count} matches for oldString. Provide more surrounding context or use replaceAll.` };
      }

      const newContent = replaceAll ? content.replaceAll(oldStr, newStr) : content.replace(oldStr, newStr);
      await writeFile(filePath, newContent, "utf8");
      return {
        title: `Edited: ${relative(ctx.cwd, filePath)}`,
        content: `Replaced ${replaceAll ? count : 1} occurrence(s) in ${relative(ctx.cwd, filePath)}`,
      };
    } catch (e: any) {
      return { content: "", error: `Cannot edit ${filePath}: ${e.message}` };
    }
  },
};
