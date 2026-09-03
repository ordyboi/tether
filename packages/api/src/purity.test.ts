import { globSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Anchored on cwd (the package root vitest runs from), not import.meta.url — this file also
// runs from dist/purity.test.js after a build, where sibling .ts sources don't exist.
const srcDir = join(process.cwd(), "src");

function sourceFiles() {
  return globSync("**/*.ts", { cwd: srcDir })
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => join(srcDir, file));
}

describe("packages/api purity", () => {
  it("never references Buffer or a node: specifier", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const content = readFileSync(file, "utf-8");
      if (/\bBuffer\b/.test(content) || /['"]node:/.test(content)) {
        offenders.push(relative(srcDir, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps zod unreachable from src/client/index.ts via value imports", () => {
    const entry = resolve(srcDir, "client/index.ts");
    const visited = new Set<string>();
    const stack = [entry];

    while (stack.length > 0) {
      const file = stack.pop();
      if (!file || visited.has(file)) continue;
      visited.add(file);

      const content = readFileSync(file, "utf-8");
      const importRegex = /^import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["'];?/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content))) {
        const [, isTypeOnly, specifier] = match;
        if (isTypeOnly || !specifier?.startsWith(".")) continue;
        if (specifier === "zod") {
          throw new Error(`zod reachable via value import from ${relative(srcDir, file)}`);
        }
        stack.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
      }
    }

    expect(visited.size).toBeGreaterThan(0);
  });
});
