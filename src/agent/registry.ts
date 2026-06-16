import type { ToolDef, ToolParam } from "./types.js";
import { readTool } from "./tools/read.js";
import { writeTool } from "./tools/write.js";
import { editTool } from "./tools/edit.js";
import { bashTool } from "./tools/bash.js";
import { globTool } from "./tools/glob.js";
import { grepTool } from "./tools/grep.js";
import { todowriteTool } from "./tools/todowrite.js";
import { questionTool } from "./tools/question.js";

const ALL_TOOLS: ToolDef[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
  todowriteTool,
  questionTool,
];

export function getTools(): ToolDef[] {
  return ALL_TOOLS;
}

export function getTool(name: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function toolsToOpenAIFormat(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return ALL_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          (Object.entries(t.parameters) as [string, ToolParam][]).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
              ...(param.items ? { items: param.items } : {}),
            },
          ])
        ),
        required: (Object.entries(t.parameters) as [string, ToolParam][]).filter(([, p]) => p.required).map(([k]) => k),
        additionalProperties: false,
      },
    },
  }));
}
