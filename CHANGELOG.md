# use-effect-reducer

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
