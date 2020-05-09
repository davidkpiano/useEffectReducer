# useEffectReducer

A [React hook](https://reactjs.org/docs/hooks-intro.html) for managing side-effects in your reducers.

Inspired by the [`useReducerWithEmitEffect` hook idea](https://gist.github.com/sophiebits/145c47544430c82abd617c9cdebefee8) by [Sophie Alpert](https://twitter.com/sophiebits).

If you know how to [`useReducer`](https://reactjs.org/docs/hooks-reference.html#usereducer), you already know how to `useEffectReducer`.

[💻 CodeSandbox example: Dog Fetcher with `useEffectReducer`](https://codesandbox.io/s/dog-fetcher-with-useeffectreducer-g192g)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Quick Start](#quick-start)
- [Named Effects](#named-effects)
- [Effect Implementations](#effect-implementations)
- [Initial Effects](#initial-effects)
- [Effect Entities](#effect-entities)
- [Effect Cleanup](#effect-cleanup)
- [Replacing Effects](#replacing-effects)
- [String Events](#string-events)
- [API](#api)
  - [`useEffectReducer` hook](#useeffectreducer-hook)
  - [`exec(effect)`](#execeffect)
  - [`exec.stop(entity)`](#execstopentity)
- [`exec.replace(entity, effect)`](#execreplaceentity-effect)
- [TypeScript](#typescript)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

Install it:

```bash
npm install use-effect-reducer
```

Import it:

```js
import { useEffectReducer } from 'use-effect-reducer';
```

Create an effect reducer:

```js
const someEffectReducer = (state, event, exec) => {
  // execute effects like this:
  exec(() => {/* ... */});

  // or parameterized (better):
  exec({ type: 'fetchUser', user: event.user });

  // and treat this like a normal reducer!
  // ...

  return state;
});
```

[Use it:](#quick-start)

```js
// ...
const [state, dispatch] = useEffectReducer(someEffectReducer, initialState, {
  // implementation of effects
});

// Just like useReducer:
dispatch({ type: 'FETCH', user: 'Sophie' });
```

## Quick Start

An "effect reducer" takes 3 arguments:

1. `state` - the current state
2. `event` - the event that was dispatched to the reducer
3. `exec` - a function that captures effects to be executed and returns an [effect entity](#effect-entities) that allows you to control the effect

```js
import { useEffectReducer } from 'use-effect-reducer';

// I know, I know, yet another counter example
const countReducer = (state, event, exec) => {
  switch (event.type) {
    case 'INC':
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

  return (
    <div>
      <output>Count: {state.count}</output>
      <button onClick={() => dispatch('INC')}>Increment</button>
    </div>
  );
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

const initialState = { status: 'idle', user: undefined };

const fetchFromAPIEffect = (_, effect, dispatch) => {
  fetch(`/api/users/${effect.user}`)
    .then(res => res.json())
    .then(data => {
      dispatch({
        type: 'RESOLVE',
        data,
      });
    });
};

const Fetcher = () => {
  const [state, dispatch] = useEffectReducer(fetchEffectReducer, initialState, {
    // Specify how effects are implemented
    fetchFromAPI: fetchFromAPIEffect,
  });

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

## Effect Implementations

An effect implementation is a function that takes 3 arguments:

1. The `state` at the time the effect was executed with `exec(effect)`
2. The `event` object that triggered the effect
3. The effect reducer's `dispatch` function to dispatch events back to it. This enables dispatching within effects in the `effectMap` if it is written outside of the scope of your component. If your effects require access to variables and functions in the scope of your component, write your `effectMap` there.

The effect implementation should return a disposal function that cleans up the effect:

```js
// Effect defined inline
exec(() => {
  const id = setTimeout(() => {
    // do some delayed side-effect
  }, 1000);

  // disposal function
  return () => {
    clearTimeout(id);
  };
});
```

```js
// Parameterized effect implementation
// (in the effect reducer)
exec({ type: 'doDelayedEffect' });

// ...

// (in the component)
const [state, dispatch] = useEffectReducer(someReducer, initialState, {
  doDelayedEffect: () => {
    const id = setTimeout(() => {
      // do some delayed side-effect
    }, 1000);

    // disposal function
    return () => {
      clearTimeout(id);
    };
  },
});
```

## Initial Effects

The 2nd argument to `useEffectReducer(state, initialState)` can either be a static `initialState` or a function that takes in an effect `exec` function and returns the `initialState`:

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

## Effect Entities

The `exec(effect)` function returns an **effect entity**, which is a special object that represents the running effect. These objects can be stored directly in the reducer's state:

```js
const someReducer = (state, event, exec) => {
  // ...

  return {
    ...state,
    // state.someEffect is now an effect entity
    someEffect: exec(() => {
      /* ... */
    }),
  };
};
```

The advantage of having a reference to the effect (via the returned effect `entity`) is that you can explicitly [stop those effects](#effect-cleanup):

```js
const someReducer = (state, event, exec) => {
  // ...

  // Stop an effect entity
  exec.stop(state.someEffect);

  return {
    ...state,
    // state.someEffect is no longer needed
    someEffect: undefined,
  };
};
```

## Effect Cleanup

Instead of implicitly relying on arbitrary values in a dependency array changing to stop an effect (as you would with `useEffect`), effects can be explicitly stopped using `exec.stop(entity)`, where `entity` is the effect entity returned from initially calling `exec(effect)`:

```js
const timerReducer = (state, event, exec) => {
  if (event.type === 'START') {
    return {
      ...state,
      timer: exec(() => {
        const id = setTimeout(() => {
          // Do some delayed effect
        }, 1000);

        // Disposal function - will be called when
        // effect entity is stopped
        return () => {
          clearTimeout(id);
        };
      }),
    };
  } else if (event.type === 'STOP') {
    // Stop the effect entity
    exec.stop(state.timer);

    return state;
  }

  return state;
};
```

All running effect entities will automatically be stopped when the component unmounts.

## Replacing Effects

If you want to replace an effect with another (likely similar) effect, instead of calling `exec.stop(entity)` and calling `exec(effect)` to manually replace an effect, you can call `exec.replace(entity, effect)` as a shorthand:

```js
const doSomeDelay = () => {
  const id = setTimeout(() => {
    // do some delayed effect
  }, delay);

  return () => {
    clearTimeout(id);
  };
};

const timerReducer = (state, event, exec) => {
  if (event.type === 'START') {
    return {
      ...state,
      timer: exec(() => doSomeDelay()),
    };
  } else if (event.type === 'LAP') {
    // Replace the currently running effect represented by `state.timer`
    // with a new effect
    return {
      ...state,
      timer: exec.replace(state.timer, () => doSomeDelay()),
    };
  } else if (event.type === 'STOP') {
    // Stop the effect entity
    exec.stop(state.timer);

    return state;
  }

  return state;
};
```

## String Events

The events handled by the effect reducers are intended to be event objects with a `type` property; e.g., `{ type: 'FETCH', other: 'data' }`. For events without payload, you can dispatch the event type alone, which will be converted to an event object inside the effect reducer:

```js
// dispatched as `{ type: 'INC' }`
// and is the same as `dispatch({ type: 'INC' })`
dispatch('INC');
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

The 2nd argument to `useEffectReducer(...)` can either be a static `initialState` or a function that takes in `exec` and returns an `initialState` (with executed initial effects). See [Initial Effects](#initial-effects) for more information.

```js
const SomeComponent = () => {
  const [state, dispatch] = useEffectReducer(
    someEffectReducer,
    exec => {
      exec({ type: 'someEffect' });
      return someInitialState;
    },
    {
      someEffect(state, effect) {
        // ...
      },
    }
  );

  // ...
};
```

Additionally, the `useEffectReducer` hook takes a 3rd argument, which is the implementation details for [named effects](#named-effects):

```js
const SomeComponent = () => {
  const [state, dispatch] = useEffectReducer(someEffectReducer, initialState, {
    log: (state, effect, dispatch) => {
      console.log(state);
    },
  });

  // ...
};
```

### `exec(effect)`

Used in an effect reducer, `exec(effect)` queues the `effect` for execution and returns an [effect entity](#effect-entities).

The `effect` can either be an effect object:

```js
// ...
const entity = exec({
  type: 'alert',
  message: 'hello',
});
```

Or it can be an inline effect implementation:

```js
// ...
const entity = exec(() => {
  alert('hello');
});
```

### `exec.stop(entity)`

Used in an effect reducer, `exec.stop(entity)` stops the effect represented by the `entity`. Returns `void`.

```js
// Queues the effect entity for disposal
exec.stop(someEntity);
```

## `exec.replace(entity, effect)`

Used in an effect reducer, `exec.replace(entity, effect)` does two things:

1. Queues the `entity` for disposal (same as calling `exec.stop(entity)`)
2. Returns a new [effect entity](#effect-entities) that represents the `effect` that replaces the previous `entity`.

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
