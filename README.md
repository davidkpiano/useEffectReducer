# useEffectReducer

A React hook for managing side effects in reducers.

Inspired a looooong time ago by the [`useReducerWithEmitEffect` hook idea](https://gist.github.com/sophiebits/145c47544430c82abd617c9cdebefee8) by Sophie Alpert.

## Install

```bash
npm install use-effect-reducer
```

## Quick start

An effect reducer is a reducer with a third argument, `exec`. Call `exec(effect)` to queue an effect. Effects run after React commits the new state.

```jsx
import { useEffectReducer } from 'use-effect-reducer';

function searchReducer(state, event, exec) {
  switch (event.type) {
    case 'SEARCH':
      return {
        status: 'loading',
        results: state.results,
        request: exec.replace(state.request, {
          type: 'fetchResults',
          query: event.query,
        }),
      };
    case 'RESOLVE':
      return { status: 'idle', results: event.results };
    case 'REJECT':
      return { status: 'error', results: [] };
    default:
      return state;
  }
}

function Search() {
  const [state, dispatch] = useEffectReducer(
    searchReducer,
    { status: 'idle', results: [] },
    {
      async fetchResults(state, effect, dispatch, { signal }) {
        try {
          const res = await fetch(`/api/search?q=${effect.query}`, { signal });
          dispatch({ type: 'RESOLVE', results: await res.json() });
        } catch (error) {
          if (!signal.aborted) dispatch({ type: 'REJECT' });
        }
      },
    }
  );

  return (
    <>
      <input
        onChange={e => dispatch({ type: 'SEARCH', query: e.target.value })}
      />
      <ul>
        {state.results.map(result => (
          <li key={result.id}>{result.title}</li>
        ))}
      </ul>
    </>
  );
}
```

Each `SEARCH` event stops the previous request and starts a new one. Stopping an effect aborts its `signal`, which cancels the previous `fetch`.

## API

### `useEffectReducer(reducer, initialState, effects?)`

```js
const [state, dispatch] = useEffectReducer(reducer, initialState, effects);
```

- `reducer`: `(state, event, exec) => nextState`
- `initialState`: the initial state, or a function `exec => initialState` that can queue effects on mount
- `effects`: an optional object that maps effect types to [effect implementations](#effect-implementations)

`dispatch` accepts an event object or, for events without a payload, the event type as a string. `dispatch('RESET')` is the same as `dispatch({ type: 'RESET' })`.

### `exec(effect)`

Queues an effect and returns an **effect entity**. Store the entity in state to stop or replace the effect later.

An effect is either an object with a `type` that matches a key in `effects`, or an inline effect implementation:

```js
exec({ type: 'fetchResults', query: 'react' });
exec(() => console.log('searching'));
```

### `exec.stop(entity)`

Stops the effect: aborts its `signal` and calls its cleanup function. Does nothing if `entity` is `undefined`.

### `exec.replace(entity, effect)`

Stops `entity` (if defined) and queues `effect`. Returns the new entity.

### Effect implementations

```js
(state, effect, dispatch, { signal }) => cleanup | void
```

- `state`: the state returned by the reducer call that queued the effect
- `effect`: the effect object
- `dispatch`: the same `dispatch` that the hook returns
- `signal`: an `AbortSignal` that is aborted when the effect stops

An implementation can return a cleanup function, which runs when the effect stops. Implementations can be `async`.

Effects stop when the component unmounts. When a component inside `<Activity>` is hidden and shown again, or when StrictMode remounts it, running effects stop and then start again with the latest state.

Implementations in `effects` are looked up when the effect starts, so they read the latest props.

## TypeScript

Type the reducer with `EffectReducer<State, Event, Effect>`. `exec`, `dispatch`, and the `effects` object are then type-checked against `Event` and `Effect`.

```ts
import { useEffectReducer, type EffectReducer } from 'use-effect-reducer';

type State = { status: 'idle' | 'loading'; results: string[] };
type Event =
  | { type: 'SEARCH'; query: string }
  | { type: 'RESOLVE'; results: string[] };
type Effect = { type: 'fetchResults'; query: string };

const searchReducer: EffectReducer<State, Event, Effect> = (
  state,
  event,
  exec
) => {
  switch (event.type) {
    case 'SEARCH':
      exec({ type: 'fetchResults', query: event.query });
      return { ...state, status: 'loading' };
    case 'RESOLVE':
      return { status: 'idle', results: event.results };
  }
};
```
