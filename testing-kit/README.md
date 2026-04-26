# testing-kit

Shared, **fully dynamic** testing kit for every project in this monorepo. One folder, one bootstrap command, every project gets the right pipeline for its stack — Vitest + Playwright for Node/React, pytest for Python.

The kit auto-detects everything per project: language, framework, source folder, path alias, and a **unique HTTP port** so multiple projects can run E2E in parallel without colliding.

## What's inside

```
testing-kit/
├── bootstrap.mjs              # one-command setup — fully dynamic
├── lib/
│   └── detect.mjs             # language/framework/port detection
├── configs/
│   ├── vitest.config.ts       # createVitestConfig({ ... })  (auto-reads tsconfig paths)
│   ├── playwright.config.ts   # createPlaywrightConfig({ ... })
│   └── pytest.ini             # pytest defaults for Python projects
├── setup/
│   ├── test-setup.ts          # Notification + AudioContext + matchMedia + Canvas stubs
│   └── conftest.py            # pytest fixtures (env isolation, fixed_now, tmp_workdir)
├── helpers/
│   ├── factories.ts           # nextId, isoOffset, buildMany, snapshotLengths, waitFor
│   └── factories.py           # Python equivalents
└── templates/
    ├── unit.test.template.ts
    ├── component.test.template.tsx
    ├── e2e.smoke.template.spec.ts
    ├── unit.test.template.py
    └── api.test.template.py    # FastAPI TestClient pattern
```

## Quick start

### Bootstrap a single project

```bash
node testing-kit/bootstrap.mjs <project-folder>
```

### Bootstrap **every** project in the monorepo at once

```bash
node testing-kit/bootstrap.mjs --all
```

### Preview without writing anything

```bash
node testing-kit/bootstrap.mjs --all --dry-run
```

### Skip dependency install (just write configs)

```bash
node testing-kit/bootstrap.mjs <project> --no-install
```

## What "fully dynamic" means

When you run the bootstrap, the kit detects per-project:

| Aspect             | How it decides                                                                            |
|--------------------|--------------------------------------------------------------------------------------------|
| **Language**        | `package.json` → Node, `requirements.txt` / `pyproject.toml` → Python                     |
| **JS framework**    | `next` / `vite` / `@remix-run/react` / `react-scripts` / `astro` / `express` deps         |
| **Python framework**| `fastapi` / `flask` / `streamlit` / `django` in requirements                              |
| **Source root**     | first that exists: `src/` → `app/` → repo root                                            |
| **Path alias**      | first `paths` key in `tsconfig.json` (e.g. `"@/*": ["./src/*"]` → alias `@`)              |
| **E2E port**        | scans every `playwright.config.ts` in the monorepo, picks the lowest unused ≥ 3100        |
| **Web-server cmd**  | `next start` / `vite preview` / `npm start` / `npx serve` based on framework + scripts    |
| **Test framework**  | Vitest + Playwright for Node, pytest (+ `pytest-asyncio`) for Python                      |
| **React stubs**     | only loaded when `react` is a dep (skipped for plain-Node projects)                       |

## What gets generated

### For a Node project

1. Installs `vitest`, `jsdom`, `@vitejs/plugin-react`, `@playwright/test` — and RTL only if React is detected
2. Writes `vitest.config.ts` re-exporting the kit factory (with detected `srcAlias` + `srcRoot`)
3. Writes `playwright.config.ts` with the auto-picked port and the right web-server command
4. Creates `tests/starter.test.ts` and `e2e/starter.spec.ts` from templates
5. Adds npm scripts: `test`, `test:watch`, `test:e2e`, `test:e2e:ui`, `test:all`, `typecheck`

### For a Python project

1. Installs `pytest`, `pytest-asyncio` (and `httpx` if FastAPI is detected)
2. Writes `pytest.ini` with strict markers + asyncio auto-mode
3. Creates `tests/conftest.py` (env isolation, `fixed_now`, `tmp_workdir` fixtures)
4. Creates `tests/test_starter.py` from the unit template
5. For FastAPI projects: also creates `tests/test_api_starter.py` (TestClient pattern)

## Idempotent

Re-running `bootstrap.mjs` on a project that's already been set up is safe — files that already exist are skipped, and only missing npm scripts are added. You can re-run after adding new projects to the monorepo without disturbing existing ones.

## Manual integration

If you don't want to use the bootstrap, just point at the kit factories:

```ts
// vitest.config.ts
import { createVitestConfig } from '../testing-kit/configs/vitest.config';
export default createVitestConfig();   // auto-detects everything
```

```ts
// playwright.config.ts
import { createPlaywrightConfig } from '../testing-kit/configs/playwright.config';
export default createPlaywrightConfig({
  port: 3101,
  command: 'npx next start -p 3101',
});
```

```ini
# pytest.ini — copy from testing-kit/configs/pytest.ini
```

## What the shared `setup/test-setup.ts` gives you for free (Node)

- **`Notification` API stub** with `Notification.permission` controllable per-test, captures every notification fired in `Notification.instances`
- **`AudioContext` / `webkitAudioContext` stub** so audio code doesn't blow up jsdom
- **`matchMedia` stub** so `useMediaQuery` and theme detection work
- **`HTMLCanvasElement.getContext` + `toDataURL` stub** so favicon/dynamic-icon code works
- **`localStorage` + `sessionStorage` cleared** before each test
- **`vi.useRealTimers()`** restored after each test
- **`@testing-library/jest-dom/vitest`** matchers (`toBeInTheDocument`, `toHaveClass`, etc.)

## What `setup/conftest.py` gives you for free (Python)

- **Env isolation** — each test runs with a clean `os.environ` overlay (`ENV=test`, `TZ=UTC`)
- **`fixed_now`** fixture — stable `datetime` for time-dependent tests
- **`tmp_workdir`** fixture — a temp dir auto-cd'd-into for the test
- **`project_root`** fixture — `Path` to your project root
- **Auto sys.path injection** — `from app.foo import bar` works without `pip install -e .`

## Helper utilities

```ts
// Node — helpers/factories.ts
import { nextId, isoOffset, FIXED_NOW, buildMany, cycle, snapshotLengths } from '../../testing-kit/helpers/factories';

const tasks = buildMany(50, (i) => ({
  id: nextId('task'),
  title: `Task ${i}`,
  scheduledAt: isoOffset(FIXED_NOW, i * 60_000),
  priority: cycle(['low', 'medium', 'high', 'urgent'], i),
}));
```

```py
# Python — helpers/factories.py
from testing_kit.helpers.factories import next_id, FIXED_NOW, build_many, snapshot_lengths

tasks = build_many(50, lambda i: {
    "id": next_id("task"),
    "title": f"Task {i}",
})
```

## Project status (current monorepo)

| Project          | Language | Framework  | Status                              |
|------------------|----------|------------|-------------------------------------|
| `task-manager`   | Node     | Next.js    | bootstrapped — 194 unit + 15 E2E    |
| `email-blaster`  | Node     | Next.js    | bootstrapped                        |
| `beat-stream`    | Node     | Next.js    | ready to bootstrap                  |
| `agentca`        | Python   | FastAPI    | already has pytest tests            |
| `full_automation`| Python   | Streamlit  | ready to bootstrap                  |

To set them all up consistently in one go:

```bash
node testing-kit/bootstrap.mjs --all --dry-run    # preview
node testing-kit/bootstrap.mjs --all              # do it
```

## Updating the kit

Edit a kit file and **every project that imports from it gets the change next test run** — no per-project sync needed. Test changes in `task-manager` first since it has the highest coverage.
