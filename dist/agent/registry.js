import { readTool } from "./tools/read.js";
import { writeTool } from "./tools/write.js";
import { editTool } from "./tools/edit.js";
import { bashTool } from "./tools/bash.js";
import { globTool } from "./tools/glob.js";
import { grepTool } from "./tools/grep.js";
import { todowriteTool } from "./tools/todowrite.js";
import { questionTool } from "./tools/question.js";
import { closeAllShellBridges } from "./tools/bash.js";
const ALL_TOOLS = [
    readTool,
    writeTool,
    editTool,
    bashTool,
    globTool,
    grepTool,
    todowriteTool,
    questionTool,
];
export function getTools() {
    return ALL_TOOLS;
}
export function getTool(name) {
    return ALL_TOOLS.find((t) => t.name === name);
}
/** Dispose of any resources held by tools (e.g. persistent shells). */
export function disposeTools() {
    closeAllShellBridges();
}
export function toolsToOpenAIFormat() {
    return ALL_TOOLS.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: {
                type: "object",
                properties: Object.fromEntries(Object.entries(t.parameters).map(([key, param]) => [
                    key,
                    {
                        type: param.type,
                        description: param.description,
                        ...(param.enum ? { enum: param.enum } : {}),
                        ...(param.items ? { items: param.items } : {}),
                    },
                ])),
                required: Object.entries(t.parameters).filter(([, p]) => p.required).map(([k]) => k),
                additionalProperties: false,
            },
        },
    }));
}
