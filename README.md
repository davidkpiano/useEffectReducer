# useEffectReducer

A [React hook](https://reactjs.org/docs/hooks-intro.html) for managing side-effects in your reducers.

If you know how to [`useReducer`](https://reactjs.org/docs/hooks-reference.html#usereducer), you already know how to `useEffectReducer`.

## Installation

```bash
npm install use-effect-reducer
```

## Usage

An "effect reducer" takes 3 arguments:

1. `state` - the current state
2. `event` - the event that was dispatched to the reducer
3. `exec` - a function that captures effects to be executed.

```js
import { useEffectReducer } from 'use-effect-reducer';

// Sigh, I know, yet another counter example
const countReducer = (state, event, exec) => {
  switch (event.type) {
    case 'ADD':
      // "Execute" a side-effect
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

  return <div>Count: {state.count}</div>;
};
```
