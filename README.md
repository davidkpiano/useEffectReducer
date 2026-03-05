# useEffectReducer

A React hook for managing side-effects in your reducers.

Inspired a looooong time ago by the [`useReducerWithEmitEffect` hook idea](https://gist.github.com/sophiebits/145c47544430c82abd617c9cdebefee8) by Sophie Alpert.

If you know how to `useReducer`, you already know how to `useEffectReducer`.

## Table of Contents

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

## Installation

```bash
npm install use-effect-reducer
```

```js
import { useEffectReducer } from 'use-effect-reducer';
```

## Quick Start

An effect reducer takes 3 arguments:

1. `state` - the current state
2. `event` - the event that was dispatched
3. `exec` - a function that captures effects to be executed and returns an [effect entity](#effect-entities)

```js
import { useEffectReducer } from 'use-effect-reducer';

const countReducer = (state, event, exec) => {
  switch (event.type) {
    case 'INC':
      exec(() => {
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

## How It Works

Internally, `useEffectReducer` abstracts this pattern:

```js
const myReducer = ([state], event) => {
  const effects = [];
  const exec = (effect) => effects.push(effect);
  const nextState = // calculate next state
  return [nextState, effects];
};

const [[state, effects], dispatch] = useReducer(myReducer);

useEffect(() => {
  effects.forEach((effect) => {
    // execute the effect
  });
}, [effects]);
```

Instead of being implicit about which effects are executed and when, you make this explicit in the effect reducer with `exec`. The hook then properly executes pending effects within `useEffect()`.

## Named Effects

A better way to make reusable effect reducers is to use **named, parameterized effects**. Pass an effect object to `exec(...)` and specify the implementation as the 3rd argument to `useEffectReducer`:

```js
const fetchEffectReducer = (state, event, exec) => {
  switch (event.type) {
    case 'FETCH':
      exec({ type: 'fetchFromAPI', user: event.user });
      return { ...state, status: 'fetching' };
    case 'RESOLVE':
      return { status: 'fulfilled', user: event.data };
    default:
      return state;
  }
};

const Fetcher = () => {
  const [state, dispatch] = useEffectReducer(
    fetchEffectReducer,
    { status: 'idle', user: undefined },
    {
      fetchFromAPI: (_, effect, dispatch) => {
        fetch(`/api/users/${effect.user}`)
          .then((res) => res.json())
          .then((data) => {
            dispatch({ type: 'RESOLVE', data });
          });
      },
    }
  );

  // ...
};
```

## Effect Implementations

An effect implementation receives 3 arguments:

1. `state` - the state at the time `exec(effect)` was called
2. `effect` - the effect object
3. `dispatch` - the dispatch function for sending events back to the reducer

Return a cleanup function to dispose of the effect:

```js
exec(() => {
  const id = setTimeout(() => {
    // do some delayed side-effect
  }, 1000);

  return () => {
    clearTimeout(id);
  };
});
```

## Initial Effects

The 2nd argument can be a function that receives `exec` and returns initial state:

```js
const getInitialState = (exec) => {
  exec({ type: 'fetchData', query: '*' });
  return { data: null };
};

const [state, dispatch] = useEffectReducer(fetchReducer, getInitialState, {
  fetchData(_, { query }, dispatch) {
    fetch(`/api?${query}`)
      .then((res) => res.json())
      .then((data) => dispatch({ type: 'RESOLVE', data }));
  },
});
```

## Effect Entities

`exec(effect)` returns an **effect entity** representing the running effect. Store it in state to control the effect later:

```js
const someReducer = (state, event, exec) => {
  return {
    ...state,
    someEffect: exec(() => {
      /* ... */
    }),
  };
};
```

## Effect Cleanup

Effects can be explicitly stopped using `exec.stop(entity)`:

```js
const timerReducer = (state, event, exec) => {
  if (event.type === 'START') {
    return {
      ...state,
      timer: exec(() => {
        const id = setTimeout(() => {
          // delayed effect
        }, 1000);

        return () => clearTimeout(id);
      }),
    };
  } else if (event.type === 'STOP') {
    exec.stop(state.timer);
    return state;
  }

  return state;
};
```

All running effects are automatically cleaned up when the component unmounts.

## Replacing Effects

Use `exec.replace(entity, effect)` to stop an existing effect and start a new one:

```js
const timerReducer = (state, event, exec) => {
  if (event.type === 'START') {
    return {
      ...state,
      timer: exec(() => doSomeDelay()),
    };
  } else if (event.type === 'LAP') {
    return {
      ...state,
      timer: exec.replace(state.timer, () => doSomeDelay()),
    };
  } else if (event.type === 'STOP') {
    exec.stop(state.timer);
    return state;
  }

  return state;
};
```

## String Events

For events without payload, you can dispatch the type string directly:

```js
// Same as dispatch({ type: 'INC' })
dispatch('INC');
```

## API

### `useEffectReducer` hook

```js
const [state, dispatch] = useEffectReducer(effectReducer, initialState);
const [state, dispatch] = useEffectReducer(effectReducer, initialState, effectsMap);
const [state, dispatch] = useEffectReducer(effectReducer, initFunction, effectsMap);
```

### `exec(effect)`

Queues an effect for execution. Returns an [effect entity](#effect-entities).

```js
const entity = exec({ type: 'alert', message: 'hello' });

// or inline:
const entity = exec(() => alert('hello'));
```

### `exec.stop(entity)`

Stops the effect represented by the entity and runs its cleanup function.

```js
exec.stop(someEntity);
```

### `exec.replace(entity, effect)`

Stops the existing entity and queues a new effect. Returns a new effect entity.

```js
const newEntity = exec.replace(oldEntity, newEffect);
```

## TypeScript

The effect reducer can be typed with `EffectReducer<TState, TEvent, TEffect>`:

```ts
import { useEffectReducer, EffectReducer } from 'use-effect-reducer';

interface User {
  name: string;
}

type FetchState =
  | { status: 'idle'; user: undefined }
  | { status: 'fetching'; user: User | undefined }
  | { status: 'fulfilled'; user: User };

type FetchEvent =
  | { type: 'FETCH'; user: string }
  | { type: 'RESOLVE'; data: User };

type FetchEffect = {
  type: 'fetchFromAPI';
  user: string;
};

const fetchEffectReducer: EffectReducer<
  FetchState,
  FetchEvent,
  FetchEffect
> = (state, event, exec) => {
  switch (event.type) {
    case 'FETCH':
      exec({ type: 'fetchFromAPI', user: event.user });
      return { ...state, status: 'fetching' };
    case 'RESOLVE':
      return { status: 'fulfilled', user: event.data };
    default:
      return state;
  }
};
```
