# useEffectReducer

A [React hook](https://reactjs.org/docs/hooks-intro.html) for managing side-effects in your reducers.

If you know how to [`useReducer`](https://reactjs.org/docs/hooks-reference.html#usereducer), you already know how to `useEffectReducer`.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Named Effects](#named-effects)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

1. Install it:

```bash
npm install use-effect-reducer
```

2. Import it:

```js
import { useEffectReducer } from 'use-effect-reducer';
```

3. [Use it:](#quick-start)

```js
// ...
const [state, dispatch] = useEffectReducer(someEffectReducer, initialState, {
  // effects implementation
});

// Just like useReducer:
dispatch({ type: 'FETCH', user: 'David' });
```

## Quick Start

An "effect reducer" takes 3 arguments:

1. `state` - the current state
2. `event` - the event that was dispatched to the reducer
3. `exec` - a function that captures effects to be executed.

```js
import { useEffectReducer } from 'use-effect-reducer';

// I know, I know, yet another counter example
const countReducer = (state, event, exec) => {
  switch (event.type) {
    case 'ADD':
      exec(() => {
        // "Execute" a side-effect here
        console.log('Going up!');
      });

      return {
        ...state,
        count: state.count + 1,
      };

    default:
      return state;
  }
};

const App = () => {
  const [state, dispatch] = useEffectReducer(countReducer, { count: 0 });

  return <div>Count: {state.count}</div>;
};
```

## Named Effects

A better way to make reusable effect reducers is to have effects that are **named** and **parameterized**. This is done by running `exec(...)` an effect object (instead of a function) and specifying that named effect's implementation as the 3rd argument to `useEffectReducer(reducer, initial, effectMap)`.

```js
const fetchEffectReducer = (state, event, exec) => {
  switch (event.type) {
    case 'FETCH':
      // Capture a named effect to be executed
      exec({ type: 'fetchFromAPI', user: event.user });

      return {
        ...state,
        status: 'fetching',
      };
    case 'RESOLVE':
      return {
        status: 'fulfilled',
        user: event.data,
      };
    default:
      return state;
  }
};

const Fetcher = () => {
  const [state, dispatch] = useEffectReducer(
    fetchEffectReducer,
    { status: 'idle', user: undefined },
    {
      // Specify how effects are implemented
      fetchFromAPI(_, effect) {
        fetch(`/api/users/${effect.user}`)
          .then(res => res.json())
          .then(data => {
            dispatch({
              type: 'RESOLVE',
              data,
            });
          });
      },
    }
  );

  return (
    <button
      onClick={() => {
        dispatch({ type: 'FETCH', user: 42 });
      }}
    >
      Fetch user
    </div>
  );
};
```

## API

### `useEffectReducer` hook

The `useEffectReducer` hook takes the same first 2 arguments as the built-in `useReducer` hook, and returns the current `state` returned from the effect reducer, as well as a `dispatch` function for sending events to the reducer.

```js
const SomeComponent = () => {
  const [state, dispatch] = useEffectReducer(someEffectReducer, initialState);

  // ...
};
```

Additionally, the `useEffectReducer` hook takes a 3rd argument, which is the implementation details for [named effects](#named-effects):

```js
const SomeComponent = () => {
  const [state, dispatch] = useEffectReducer(someEffectReducer, initialState, {
    log: (state, effect) => {
      console.log(state);
    },
  });

  // ...
};
```

## TypeScript

The effect reducer can be specified as an `EffectReducer<TState, TEvent, TEffect>`, where the generic types are:

- The `state` type returned from the reducer
- The `event` object type that can be dispatched to the reducer
- The `effect` object type that can be executed

```ts
import { useEffectReducer, EffectReducer } from 'use-effect-reducer';

interface User {
  name: string;
}

type FetchState =
  | {
      status: 'idle';
      user: undefined;
    }
  | {
      status: 'fetching';
      user: User | undefined;
    }
  | {
      status: 'fulfilled';
      user: User;
    };

type FetchEvent =
  | {
      type: 'FETCH';
      user: string;
    }
  | {
      type: 'RESOLVE';
      data: User;
    };

type FetchEffect = {
  type: 'fetchFromAPI';
  user: string;
};

const fetchEffectReducer: EffectReducer<FetchState, FetchEvent, FetchEffect> = (
  state,
  event,
  exec
) => {
  switch (event.type) {
    case 'FETCH':
    // State, event, and effect types will be inferred!

    // Also you should probably switch on
    // `state.status` first ;-)

    // ...

    default:
      return state;
  }
};
```
