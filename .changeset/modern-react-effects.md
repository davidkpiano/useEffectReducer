---
'use-effect-reducer': minor
---

Fix the effect lifecycle under StrictMode and `<Activity>`, add an `AbortSignal` to effects, and publish as ESM only.

- Fix: running effects (including initial effects) are resumed after StrictMode's simulated unmount/remount and when an `<Activity>` boundary becomes visible again. Previously they were stopped and never restarted. Resumed effects receive the latest state.
- Fix: an effect stopped via `exec.stop(entity)` in the same reducer call that queued it no longer starts.
- Fix: effects queued by a synchronous dispatch from inside an effect are no longer dropped under StrictMode.
- `dispatch` passed to effect implementations now accepts string events, like the hook's `dispatch`.
- `EffectEntity['status']` is now `'idle' | 'started' | 'stopped'` (was a non-exported numeric enum). `Dispatch` and `EntityStatus` types are exported.
- Lazy initialization uses `useReducer`'s `init` argument instead of reading a ref during render (React Compiler friendly).
- Effect implementations receive a 4th argument, `{ signal }`: an `AbortSignal` aborted when the effect stops. Effects may be `async`.
- Effects-map implementations are looked up when an effect starts (or resumes), so they see the latest props.
- `exec.stop(entity)` accepts `undefined`.
- Types: string events are only accepted for events without required payload; `exec`/`dispatch` in the initial state getter are fully typed.
- Packaging: the package is ESM-only. CommonJS consumers can `require()` it on Node.js 20.19+ and 22.12+, which `engines.node` now requires.
