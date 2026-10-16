---
'use-effect-reducer': minor
---

- Fix: running effects (including initial effects) are resumed after StrictMode's simulated unmount/remount and when an `<Activity>` boundary becomes visible again. Previously they were stopped and never restarted.
- Fix: an effect stopped via `exec.stop(entity)` in the same reducer call that queued it no longer starts.
- Fix: effects queued by a synchronous dispatch from inside an effect are no longer dropped under StrictMode.
- `dispatch` passed to effect implementations now accepts string events, like the hook's `dispatch`.
- `EffectEntity['status']` is now `'idle' | 'started' | 'stopped'` (was a non-exported numeric enum). `Dispatch` and `EntityStatus` types are exported.
- Lazy initialization uses `useReducer`'s `init` argument instead of reading a ref during render (React Compiler friendly).
