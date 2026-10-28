# use-effect-reducer

## 0.8.0

### Minor Changes

- 5a68cd0: Fix the effect lifecycle under StrictMode and `<Activity>`, add an `AbortSignal` to effects, and publish as ESM only.

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

### Patch Changes

- 608692b: The hook passes the React Compiler lint rules (`eslint-plugin-react-hooks` recommended config). The effects map is now read only from effects, never during render.

## 0.7.0

### Minor Changes

- 7ec8494: Initial effects now support cleanup, just like normal effects. https://github.com/davidkpiano/useEffectReducer/pull/20

## 0.6.1

### Patch Changes

- Fixed the `module` entry in `package.json`.
- Fixed the `module` entry in `package.json`

## 0.6.0

### Minor Changes

- b1c53b2: Added support for initial effects, via the 2nd argument to `useEffectReducer`, which can either be a static `initialState` or a function that takes in `exec` and returns an initial state as well as executing initial effects:

  ```js
  const fetchReducer = (state, event) => {
    if (event.type === 'RESOLVE') {
      return {
        ...state,
        data: event.data,
      };
    }

    return state;
  };

  const getInitialState = exec => {
    exec({ type: 'fetchData', someQuery: '*' });

    return { data: null };
  };

  // (in the component)
  const [state, dispatch] = useEffectReducer(fetchReducer, getInitialState, {
    fetchData(_, { someQuery }) {
      fetch(`/some/api?${someQuery}`)
        .then(res => res.json())
        .then(data => {
          dispatch({
            type: 'RESOLVE',
            data,
          });
        });
    },
  });
  ```

## 0.5.0

### Minor Changes

- 209ec4d: The effect implementation now takes a 3rd parameter: `dispatch`. This allows you to define effects that dispatch events back to the effect reducer _outside_ of the component:

  ```js
  const fetchUserEffect = (state, effect, dispatch) => {
    fetch(/* ... */)
      .then(res => res.json())
      .then(data => {
        dispatch({
          type: 'RESOLVE',
          data,
        });
      });
  };

  // ...

  const App = () => {
    const [state, dispatch] = useEffectReducer(effectReducer, initialState, {
      // Externally defined!
      fetchUser: fetchUserEffect,
    });

    // ...
  };
  ```

- 968f8cc: Effects can now be managed and stopped via "effect entities", which are special objects returned from `exec(effect)`:

  ```js
  const someEntity = exec(someEffect);
  ```

  Having a reference to the effect entity allows you to stop the effect by calling `exec.stop(someEntity)`, and even replace it with a new effect entity by calling `exec.replace(someEntity, effect)`.

  All running effects in a component are now properly disposed when the component unmounts.

## 0.4.1

### Patch Changes

- 3317c0b: An edge-case where effects that are queued before unconditional flushing are lost has been fixed by tracking the actual number of effects that should be flushed. #3
