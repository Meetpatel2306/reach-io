# testing-kit

Shared testing setup for every project in this monorepo (`task-manager`, `email-blaster`, future apps). One folder, one bootstrap command, every project gets the same fast unit + E2E pipeline.

## What's inside

```
testing-kit/
├── bootstrap.mjs              # one-command setup for any project
├── configs/
│   ├── vitest.config.ts       # createVitestConfig({ ... })
│   └── playwright.config.ts   # createPlaywrightConfig({ ... })
├── setup/
│   └── test-setup.ts          # Notification + AudioContext + matchMedia + Canvas stubs
├── helpers/
│   └── factories.ts           # nextId, isoOffset, buildMany, snapshotLengths, waitFor
└── templates/
    ├── unit.test.template.ts
    ├── component.test.template.tsx
    └── e2e.smoke.template.spec.ts
```

## Quick start — bootstrap a new project

From the monorepo root:

```bash
node testing-kit/bootstrap.mjs <project-folder>
```

**Example** — set up a fresh project named `my-app`:

```bash
node testing-kit/bootstrap.mjs my-app
cd my-app
npx playwright install chromium    # one-time, ~110MB
npm test                            # unit tests
npm run test:e2e                    # browser tests
npm run test:all                    # everything
```

The script:

1. Installs vitest, RTL, jsdom, @vitejs/plugin-react, @playwright/test as devDeps in the target project
2. Writes `vitest.config.ts` and `playwright.config.ts` that re-export the shared kit configs (so you only edit kit configs once and every project picks it up)
3. Creates `tests/starter.test.ts` and `e2e/starter.spec.ts` from the templates
4. Adds these npm scripts (only if not already present): `test`, `test:watch`, `test:e2e`, `test:e2e:ui`, `test:all`, `typecheck`

## Manual integration (if you don't want the bootstrap)

`vitest.config.ts` in your project:

```ts
import { createVitestConfig } from '../testing-kit/configs/vitest.config';
export default createVitestConfig({ srcAlias: '@', srcRoot: 'src', testsDir: 'tests' });
```

`playwright.config.ts` in your project:

```ts
import { createPlaywrightConfig } from '../testing-kit/configs/playwright.config';
export default createPlaywrightConfig({
  port: 3100,
  command: 'npx next start -p 3100',
});
```

Then add scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:all": "vitest run && playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

## Writing your first test

Copy the relevant template into your project:

| Want to test... | Copy template | Put it in |
| --- | --- | --- |
| A pure function or module | `templates/unit.test.template.ts` | `tests/your-thing.test.ts` |
| A React component | `templates/component.test.template.tsx` | `tests/components.test.tsx` |
| An end-to-end user flow | `templates/e2e.smoke.template.spec.ts` | `e2e/your-flow.spec.ts` |

## What the shared `setup/test-setup.ts` gives you for free

When you import from this kit, every test file automatically gets:

- **`Notification` API stub** with `Notification.permission` controllable per-test, captures every notification fired in `Notification.instances`
- **`AudioContext` / `webkitAudioContext` stub** so audio code doesn't blow up jsdom
- **`matchMedia` stub** so `useMediaQuery` and theme detection work
- **`HTMLCanvasElement.getContext` + `toDataURL` stub** so favicon/dynamic-icon code works
- **`localStorage` + `sessionStorage` cleared** before each test
- **`vi.useRealTimers()`** restored after each test
- **`@testing-library/jest-dom/vitest`** matchers (`toBeInTheDocument`, `toHaveClass`, etc.)

## Helper utilities (`helpers/factories.ts`)

```ts
import { nextId, isoOffset, FIXED_NOW, buildMany, cycle, snapshotLengths } from '../../testing-kit/helpers/factories';

const tasks = buildMany(50, (i) => ({
  id: nextId('task'),
  title: `Task ${i}`,
  scheduledAt: isoOffset(FIXED_NOW, i * 60_000),
  priority: cycle(['low', 'medium', 'high', 'urgent'], i),
}));

const before = snapshotLengths(useStore.getState());
// ... do stuff
const after = snapshotLengths(useStore.getState());
expect(after).toEqual(before); // verify no side effects
```

## Reference implementation

The `task-manager` project ships with **194 unit tests + 15 E2E tests** built on top of this exact setup. Browse [`task-manager/tests/`](../task-manager/tests/) and [`task-manager/e2e/`](../task-manager/e2e/) for real working examples.

## When NOT to use this kit

- **Python / non-JS projects** — this kit is JS/TS only
- **Vue / Svelte / Solid** — replace the React plugin in `configs/vitest.config.ts`
- **Projects without a build server** — Playwright's webServer expects a startable HTTP server. For static sites use `npx serve -l 3100 .` as the command.

## Updating

Edit a kit file and **every project that imports from it gets the change next test run** — no per-project sync. Test the change in `task-manager` first since it has the highest coverage.
