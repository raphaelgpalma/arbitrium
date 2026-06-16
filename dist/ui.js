import chalk from "chalk";
/**
 * Shared UI theme + helpers for the Arbitrium CLI.
 * Centralizes colors, banner, dividers and the spinner so every command
 * renders with a consistent look.
 */
export const theme = {
    primary: (s) => chalk.hex("#6d28d9")(s),
    primaryBold: (s) => chalk.hex("#7c3aed").bold(s),
    accent: (s) => chalk.hex("#06b6d4")(s),
    dim: (s) => chalk.gray(s),
    ok: (s) => chalk.green(s),
    warn: (s) => chalk.yellow(s),
    err: (s) => chalk.red(s),
    text: (s) => chalk.white(s),
    label: (s) => chalk.bold.hex("#7c3aed")(s),
};
// Dark-purple gradient (top -> bottom).
const GRADIENT = ["#3b0764", "#4c1d95", "#5b21b6", "#6024c0", "#6d28d9", "#5b21b6"];
const ART = [
    " █████╗ ██████╗ ██████╗ ██╗████████╗██████╗ ██╗██╗   ██╗███╗   ███╗",
    "██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██╔══██╗██║██║   ██║████╗ ████║",
    "███████║██████╔╝██████╔╝██║   ██║   ██████╔╝██║██║   ██║██╔████╔██║",
    "██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══██╗██║██║   ██║██║╚██╔╝██║",
    "██║  ██║██║  ██║██████╔╝██║   ██║   ██║  ██║██║╚██████╔╝██║ ╚═╝ ██║",
    "╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝     ╚═╝",
];
export function banner() {
    const art = ART.map((line, i) => chalk.hex(GRADIENT[i % GRADIENT.length])(line)).join("\n");
    const tag = theme.dim("      ☉ Cognition without control.");
    return `\n${art}\n${tag}\n`;
}
/** A full-width rule, optionally with a centered label. */
export function divider(label, width = 64) {
    const bar = "━";
    if (!label)
        return theme.primary(bar.repeat(width));
    const text = ` ${label} `;
    const side = Math.max(2, Math.floor((width - text.length) / 2));
    const left = theme.primary(bar.repeat(side));
    const right = theme.primary(bar.repeat(Math.max(2, width - side - text.length)));
    return `${left}${theme.label(text)}${right}`;
}
/** A boxed section header used to introduce command output. */
export function header(label) {
    return `\n${theme.primary("☉")} ${theme.label(label)}\n${divider()}`;
}
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
/**
 * Lightweight spinner. Renders to stderr so it never contaminates stdout
 * (important when the user pipes command output elsewhere).
 */
export function spinner(initial) {
    let text = initial;
    let frame = 0;
    const stream = process.stderr;
    const tty = stream.isTTY;
    let timer = null;
    if (tty) {
        stream.write("\x1b[?25l"); // hide cursor
        timer = setInterval(() => {
            frame = (frame + 1) % FRAMES.length;
            stream.write(`\r\x1b[K${theme.primary(FRAMES[frame])} ${theme.dim(text)}`);
        }, 80);
    }
    else {
        stream.write(`${text}\n`);
    }
    return {
        update(next) {
            text = next;
        },
        stop(final) {
            if (timer)
                clearInterval(timer);
            if (tty) {
                stream.write("\r\x1b[K"); // clear the spinner line
                stream.write("\x1b[?25h"); // restore cursor
            }
            if (final)
                stream.write(`${final}\n`);
        },
    };
}
