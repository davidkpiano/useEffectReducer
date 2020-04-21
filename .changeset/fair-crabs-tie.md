---
'use-effect-reducer': minor
---

The effect implementation now takes a 3rd parameter: `dispatch`. This allows you to define effects that dispatch events back to the effect reducer _outside_ of the component:

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
