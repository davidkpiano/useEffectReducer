# use-effect-reducer

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
