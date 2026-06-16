export const questionTool = {
    name: "question",
    description: "Ask the user a question to gather preferences, clarify ambiguous instructions, or get decisions on implementation choices.",
    parameters: {
        questions: {
            type: "array",
            description: "Questions to ask the user",
            required: true,
            items: { type: "string" },
        },
    },
    async execute(args, ctx) {
        const questions = args.questions;
        if (!questions || questions.length === 0) {
            return { content: "No questions provided." };
        }
        const lines = [];
        for (const q of questions) {
            lines.push(`\n❓ ${q.header}: ${q.question}`);
            if (q.options) {
                for (const opt of q.options) {
                    lines.push(`  [ ] ${opt.label} — ${opt.description}`);
                }
            }
        }
        return { title: `Questions (${questions.length})`, content: lines.join("\n") + "\n\nReply with your answers." };
    },
};
