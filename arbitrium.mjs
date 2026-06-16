#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, "dist/index.js");

import(entry).catch((err) => {
  console.error("Arbitrium failed to start:", err.message);
  process.exit(1);
});
