# Phase 1 — Scaffolding

Set up the project skeleton so that TypeScript compiles cleanly and the CLI entry point is runnable.

## Goals

- [ ] `package.json` created with correct ESM config, bin entry, and all dependencies listed
- [ ] `tsconfig.json` configured for `NodeNext` module resolution and strict mode
- [ ] `.gitignore` excludes `node_modules/`, `dist/`, `workspaces.json`, `.env`
- [ ] `workspaces.json.example` committed as a reference template
- [ ] `.env.example` committed
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` exits 0 and produces `dist/`
- [ ] `pnpm dev` runs the stub entry point without errors
- [ ] `README.md` — Requirements and Installation sections are accurate and complete
- [ ] `CLAUDE.md` — Phase 1 marked `complete` in the Build Status table; Running the Project commands verified

## Files to Create

```
package.json
tsconfig.json
.gitignore
.env.example
workspaces.json.example
src/index.ts              ← stub entry point
```

## package.json

Key fields:

```json
{
  "name": "slack-viewer",
  "version": "0.1.0",
  "type": "module",
  "bin": { "slack-viewer": "./dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@inquirer/prompts": "^7",
    "@slack/web-api": "^7",
    "chalk": "^5",
    "dotenv": "^16",
    "ora": "^8"
  },
  "devDependencies": {
    "@types/node": "^22",
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

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
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Note: `NodeNext` module resolution is required for ESM-compatible packages like `chalk` and `ora`.

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

## Verification

```bash
pnpm install           # no errors
pnpm build             # tsc exits 0, dist/ created
pnpm dev               # prints startup message
```
