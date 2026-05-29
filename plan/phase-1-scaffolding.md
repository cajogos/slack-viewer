# Phase 1 — Scaffolding

Set up the project skeleton so that TypeScript compiles cleanly and the CLI entry point is runnable.

## Goals

- [x] `package.json` created with correct ESM config, bin entry, and all dependencies listed
- [x] `package.json` has `engines: { "node": ">=24", "pnpm": ">=9" }` matching `.nvmrc` (v24.16.0)
- [x] `package.json` has a `typecheck` script (`tsc --noEmit`) for catching TS errors without building
- [x] `dotenv` is NOT in dependencies — tokens come from `workspaces.json`, not `.env`
- [x] `tsconfig.json` configured for `NodeNext` module resolution and strict mode
- [x] `.gitignore` excludes `node_modules/`, `dist/`, `workspaces.json`, `.env`, `exports/`
- [x] `workspaces.json.example` committed as a reference template
- [x] `pnpm install` completes without errors
- [x] `pnpm build` exits 0 and produces `dist/`
- [x] `pnpm typecheck` exits 0
- [x] `pnpm dev` runs the stub entry point without errors
- [x] `README.md` — Requirements and Installation sections reflect Node 24 and pnpm 9
- [x] `CLAUDE.md` — Phase 1 marked `complete` in the Build Status table; Running the Project commands verified

## Files to Create

```
package.json
tsconfig.json
.gitignore
.env.example
workspaces.json.example
src/index.ts              ← stub entry point
```

## .nvmrc

Already present at the project root with `v24.16.0`. Node 24 is an LTS release — use it for all development. `engines` in `package.json` should match.

## package.json

Key fields:

```json
{
  "name": "slack-viewer",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=24",
    "pnpm": ">=9"
  },
  "bin": { "slack-viewer": "./dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@inquirer/prompts": "^7",
    "@slack/web-api": "^7",
    "chalk": "^5",
    "ora": "^8"
  },
  "devDependencies": {
    "@types/node": "^24",
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

`dotenv` is intentionally absent. Tokens live in `workspaces.json`, not `.env`. Node 24 has native `node:util` `parseArgs` so no CLI framework is needed for flag parsing either.

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Note: `NodeNext` module resolution is required for ESM-compatible packages like `chalk` and `ora`.

`declaration` is intentionally omitted — this is a CLI app, not a library; nothing imports its `.d.ts`, so emitting them only slows the build.

## .gitignore

Must exclude:
- `node_modules/`
- `dist/`
- `workspaces.json` (contains real tokens)
- `.env` (if used)
- `*.json.local`

## workspaces.json.example

```json
{
  "workspace-name": "xoxp-your-token-here"
}
```

Multiple workspaces:

```json
{
  "my-company": "xoxp-...",
  "side-project": "xoxp-..."
}
```

## src/index.ts (stub)

Minimal entry point that prints a startup message — proves the build pipeline works end-to-end before real logic is added.

**Shebang:** the first line must be `#!/usr/bin/env node` so the compiled `dist/index.js` is directly executable as the `slack-viewer` bin. `tsc` preserves a leading shebang in its output. The `bin` field works via `node dist/index.js` regardless; the shebang only matters if the binary is invoked directly (e.g. after `pnpm link`), in which case the file also needs the execute bit (`chmod +x dist/index.js`).

## Web UI Compatibility

The directory layout established in this phase is the right foundation for a future Web UI. No changes are needed to the structure — the separation between `src/api/`, `src/cli/`, `src/export/`, and `src/config/` means the CLI layer can be replaced by an HTTP server layer without touching anything else.

One constraint to enforce from the start: **`src/api/`, `src/config/`, `src/export/`, and `src/utils/` must never import from `src/cli/`**. The CLI is a consumer of those layers, not a dependency. A linter rule or just discipline during code review is sufficient — there is no tooling to add now.

## Verification

```bash
pnpm install           # no errors
pnpm build             # tsc exits 0, dist/ created
pnpm dev               # prints startup message

# Confirm sensitive files are gitignored
touch workspaces.json && git status   # must show as untracked (not staged)
touch .env && git status              # must show as untracked (not staged)
git check-ignore -v workspaces.json   # must print the matching .gitignore rule
git check-ignore -v .env              # must print the matching .gitignore rule
rm workspaces.json .env               # clean up test files
```

## Developer Checkpoint

Before marking Phase 1 complete, hand the scaffold back to the developer (see the policy in `overview.md`):

- Show `git diff --stat` so they can review every created file.
- Have them run `pnpm install && pnpm build && pnpm dev` and confirm the stub startup message prints.
- Walk through the gitignore proof from **Verification** (`git check-ignore -v workspaces.json`) so they can see secrets are excluded *before* any real token exists on disk.
- Pause for sign-off before starting Phase 2.

## Testing

**Framework setup** — the test infrastructure is established in this phase so it's available from Phase 2 onward.

**Additional devDependencies:**
```json
"vitest": "^3",
"@vitest/coverage-v8": "^3"
```

**Additional scripts in `package.json`:**
```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

**New file — `vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,   // Phase 1 has no tests yet; without this vitest exits 1
  },
})
```

**Update `tsconfig.json`:** add `"tests"` to the `include` array so test files are type-checked by `pnpm typecheck`.

**Verification:** `pnpm test` exits 0 (passes vacuously — requires `passWithNoTests: true`; vitest exits 1 on "no test files found" without it). `pnpm typecheck` exits 0.
