export const todowriteTool = {
    name: "todowrite",
    description: "Create and maintain a structured task list for the current coding session. Tracks progress, organizes multi-step work, and surfaces status. Use proactively for 3+ distinct steps.",
    parameters: {
        todos: {
            type: "array",
            description: "The updated todo list",
            required: true,
            items: { type: "string" },
        },
    },
    async execute(args, _ctx) {
        const todos = args.todos;
        if (!todos || todos.length === 0) {
            return { content: "Todo list cleared." };
        }
        const lines = todos.map((t) => {
            const icon = t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○";
            return `${icon} [${t.priority || "medium"}] ${t.content}`;
        });
        return { title: `Todo: ${todos.length} items`, content: lines.join("\n") };
    },
};
