---
'use-effect-reducer': patch
---

An edge-case where effects that are queued before unconditional flushing are lost has been fixed by tracking the actual number of effects that should be flushed. #3
