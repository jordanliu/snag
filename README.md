# Snag Monorepo

Single-extension Turborepo built around a WXT app and a shared UI package.

## Workspace

- `apps/wxt`: the browser extension app
- `@repo/ui`: shared React components plus shared Tailwind-ready base styles
- `@repo/eslint-config`: reusable ESLint configs for the repo
- `@repo/typescript-config`: shared TypeScript config presets

## Commands

```sh
pnpm dev
pnpm build
pnpm check-types
```

Run the extension directly with:

```sh
pnpm --filter wxt dev
pnpm --filter wxt build
pnpm --filter wxt zip
```
