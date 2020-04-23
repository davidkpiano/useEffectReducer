---
'use-effect-reducer': minor
---

Effects can now be managed and stopped via "effect entities", which are special objects returned from `exec(effect)`:

```js
const someEntity = exec(someEffect);
```

Having a reference to the effect entity allows you to stop the effect by calling `exec.stop(someEntity)`, and even replace it with a new effect entity by calling `exec.replace(someEntity, effect)`.

All running effects in a component are now properly disposed when the component unmounts.
