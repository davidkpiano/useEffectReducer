---
'use-effect-reducer': minor
---

Added support for initial effects, via the 2nd argument to `useEffectReducer`, which can either be a static `initialState` or a function that takes in `exec` and returns an initial state as well as executing initial effects:

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
