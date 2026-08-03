// node components/ui/markdown-text.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./markdown-text.tsx", import.meta.url), "utf8");
const body = src.match(/export function cleanMarkdown[\s\S]*?\n}/)[0];
const js = body.replace("export ", "").replace("(source: string): string", "(source)");
const cleanMarkdown = new Function(`${js}; return cleanMarkdown;`)();

// The case from credit_bureau.md that leaked into the source viewer.
assert.equal(
  cleanMarkdown("high risk individuals.[\\[3\\]](#cite_note-3) Lenders use this"),
  "high risk individuals.[3] Lenders use this",
);
assert.equal(cleanMarkdown("see [the policy](https://x.test/a_b) now"), "see the policy now");
assert.equal(cleanMarkdown("![chart](img.png) follows"), "chart follows");
assert.equal(cleanMarkdown("a \\* literal star and \\_underscore\\_"), "a * literal star and _underscore_");
// Bare brackets and unpaired parens must survive untouched.
assert.equal(cleanMarkdown("array[0] and (note) stay"), "array[0] and (note) stay");
assert.equal(cleanMarkdown("DTI 40% (see [table](#t))"), "DTI 40% (see table)");

console.log("cleanMarkdown OK");
