# testing-kit

Shared, **fully dynamic** testing kit for every project in this monorepo. One folder, one bootstrap command, every project gets a comprehensive set of tests for its stack — Vitest + Playwright for Node/React, pytest for Python.

The kit auto-detects everything per project: language, framework, source folder, path alias, and a **unique HTTP port** so multiple projects can run E2E in parallel without colliding.

## What's inside

```
testing-kit/
├── bootstrap.mjs              # one-command setup — fully dynamic
├── lib/
│   └── detect.mjs             # language / framework / port / alias detection
├── configs/
│   ├── vitest.config.ts       # createVitestConfig() — auto-reads tsconfig paths
│   ├── playwright.config.ts   # createPlaywrightConfig({ ... })
│   └── pytest.ini             # pytest defaults (strict markers, asyncio auto)
├── setup/
│   ├── test-setup.ts          # 12+ jsdom stubs: matchMedia, Notification, AudioContext,
│   │                          # Canvas, ResizeObserver, IntersectionObserver, IndexedDB,
│   │                          # BroadcastChannel, clipboard, scrollTo, randomUUID, etc.
│   └── conftest.py            # pytest fixtures: env isolation, fixed_now, tmp_workdir
├── helpers/
│   ├── factories.ts           # nextId, isoOffset, buildMany, snapshotLengths, waitFor
│   ├── network.ts             # mockFetch / sequencedFetch / jsonResponse
│   ├── a11y.ts                # quickAxe — common a11y checks without axe-core
│   ├── timing.ts              # withFakeTimers, until, deferred, freezeTime
│   ├── factories.py           # Python equivalents of factories.ts
│   ├── network.py             # patched_requests, fail_on, make_async_mock
│   ├── db.py                  # sqlite_memory, seed, count, fetch_all
│   └── mock.py                # patch_many, freeze_attr, call_log
└── templates/                 # 21 ready-to-edit test templates
    ├── unit.test.template.ts            ├── e2e.smoke.template.spec.ts
    ├── component.test.template.tsx      ├── e2e.auth.template.spec.ts
    ├── hook.test.template.tsx           ├── e2e.form.template.spec.ts
    ├── store.test.template.ts           ├── e2e.a11y.template.spec.ts
    ├── api-route.test.template.ts       ├── e2e.persistence.template.spec.ts
    ├── async.test.template.ts           ├── e2e.keyboard.template.spec.ts
    ├── form.test.template.tsx           ├── e2e.mobile.template.spec.ts
    ├── error-boundary.test.template.tsx ├── e2e.upload.template.spec.ts
    ├── snapshot.test.template.tsx       ├── unit.test.template.py
    ├── network-mock.test.template.ts    ├── api.test.template.py
    ├── parametrized.test.template.ts    ├── test_async.template.py
    ├── test_mock.template.py            ├── test_parametrized.template.py
    ├── test_pydantic.template.py        ├── test_flask.template.py
    ├── test_db.template.py              └── test_hypothesis.template.py
```

## Quick start

```bash
# Bootstrap a single project
node testing-kit/bootstrap.mjs <project-folder>

# Bootstrap every project in the monorepo at once
node testing-kit/bootstrap.mjs --all

# Preview without writing anything
node testing-kit/bootstrap.mjs --all --dry-run

# Skip dependency install (just write configs/templates)
node testing-kit/bootstrap.mjs <project> --no-install
```

## What the bootstrap copies — per framework

| Project type            | tests/ gets…                                                                                              | e2e/ gets…                                                                  |
|-------------------------|------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Any Node                | `starter`, `async`, `parametrized`, `network-mock`                                                         | `starter`, `auth`, `form`, `a11y`, `persistence`, `keyboard`, `mobile`, `upload` |
| + React                 | also `components`, `hooks`, `form`, `error-boundary`, `snapshot`                                           | (same)                                                                       |
| + Next.js               | also `api-route`, `store`                                                                                  | (same)                                                                       |
| Any Python              | `test_starter`, `test_async`, `test_mock`, `test_parametrized`, `conftest.py`                              | n/a                                                                          |
| + FastAPI               | also `test_api_starter`, `test_pydantic`, `test_db`                                                        | n/a                                                                          |
| + Flask                 | also `test_flask_app`, `test_db`                                                                           | n/a                                                                          |
| + Django                | also `test_db`                                                                                             | n/a                                                                          |

Every template is a *starter* — it has working demo code so the test runner is green out of the box. Replace the demo with your real imports as you build out the project.

## What "fully dynamic" means

| Aspect             | How the kit decides                                                                       |
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

## What the shared `setup/test-setup.ts` gives you for free (Node)

Every Vitest test file inherits all of these without explicit imports:

- **`Notification` API stub** — `Notification.permission` controllable per-test, captured in `Notification.instances`
- **`AudioContext` / `webkitAudioContext` stub** — audio code doesn't blow up jsdom
- **`matchMedia` stub** — `useMediaQuery` and theme detection work
- **`HTMLCanvasElement` stub** — `getContext`, `toDataURL`, `toBlob`, full 2D API surface
- **`ResizeObserver`, `IntersectionObserver`, `MutationObserver` stubs** — Radix UI, charts, virtualization, "in-view" hooks
- **`scrollTo`, `scrollIntoView` stubs** — jsdom doesn't implement these natively
- **`navigator.clipboard` stub** — capturable copies via `getClipboardCalls()`
- **`indexedDB` minimal stub** — for richer behavior swap in `fake-indexeddb`
- **`BroadcastChannel` stub** — service-worker-style cross-tab comms
- **`URL.createObjectURL` / `revokeObjectURL`** — file uploads, blob preview
- **`crypto.randomUUID` polyfill** — for older jsdom builds
- **`localStorage` + `sessionStorage` cleared** before each test
- **`vi.useRealTimers()`** + **`vi.restoreAllMocks()`** restored after each test
- **`@testing-library/jest-dom/vitest`** matchers (`toBeInTheDocument`, `toHaveClass`, etc.)

## What `setup/conftest.py` gives you for free (Python)

Every pytest test inherits:

- **Env isolation** — `os.environ` reset between tests, `ENV=test`, `TZ=UTC`
- **`fixed_now`** fixture — stable `datetime` for time-dependent tests
- **`tmp_workdir`** fixture — temp dir auto-`chdir`'d into for the test
- **`project_root`** fixture — `Path` to the project root
- **Auto sys.path injection** — `from app.foo import bar` works without `pip install -e .`

## Helper utilities

```ts
// Node — helpers/factories.ts
import { nextId, isoOffset, FIXED_NOW, buildMany, cycle, snapshotLengths } from '../../testing-kit/helpers/factories';

// helpers/network.ts — quick fetch mocking without msw
import { mockFetch, jsonResponse } from '../../testing-kit/helpers/network';
const fetch = mockFetch();
fetch.next({ id: 'u-1' });
fetch.fail(new Error('offline'));
fetch.restore();

// helpers/timing.ts
import { withFakeTimers, until, deferred, freezeTime } from '../../testing-kit/helpers/timing';
const restore = freezeTime(new Date('2026-01-01'));
// …
restore();

// helpers/a11y.ts — quick a11y checks on a rendered tree
import { quickAxe } from '../../testing-kit/helpers/a11y';
expect(quickAxe(container)).toEqual([]);   // no issues
```

```py
# Python — helpers/factories.py
from testing_kit.helpers.factories import next_id, FIXED_NOW, build_many, snapshot_lengths

# helpers/network.py — patch external HTTP cleanly
from testing_kit.helpers.network import patched_requests, json_response
with patched_requests("app.api.requests.get", [json_response({"ok": True})]):
    ...

# helpers/db.py — fast sqlite scratch DBs
from testing_kit.helpers.db import sqlite_memory, seed, count
with sqlite_memory("CREATE TABLE x (id INT)") as db:
    seed(db, "x", [{"id": 1}, {"id": 2}])
    assert count(db, "x") == 2

# helpers/mock.py — sugar over unittest.mock
from testing_kit.helpers.mock import patch_many, freeze_attr, call_log
with patch_many({"app.foo.bar": 1, "app.foo.baz": 2}) as mocks:
    ...
```

## Manual integration (if you skip the bootstrap)

```ts
// vitest.config.ts
import { createVitestConfig } from '../testing-kit/configs/vitest.config';
export default createVitestConfig();   // auto-detects everything

// playwright.config.ts
import { createPlaywrightConfig } from '../testing-kit/configs/playwright.config';
export default createPlaywrightConfig({ port: 3101, command: 'npx next start -p 3101' });
```

```ini
# pytest.ini — copy from testing-kit/configs/pytest.ini
```

## Idempotent

Re-running `bootstrap.mjs` on a project that's already been set up is safe — files that already exist are skipped, and only missing npm scripts are added. You can re-run after adding new projects, or after the kit gains new templates, without disturbing existing tests.

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
