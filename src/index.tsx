import {
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useInsertionEffect,
} from 'react';

type CleanupFunction = () => void;

/** Event types that can be dispatched as a string (no required payload) */
type PayloadlessEventType<TEvent extends EventObject> = TEvent extends any
  ? { type: TEvent['type'] } extends TEvent
    ? TEvent['type']
    : never
  : never;

export type Dispatch<TEvent extends EventObject> = (
  event: TEvent | PayloadlessEventType<TEvent>
) => void;

export interface EffectContext {
  /** Aborted when the effect is stopped */
  signal: AbortSignal;
}

export type EffectFunction<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> = (
  state: TState,
  effect: TEffect,
  dispatch: Dispatch<TEvent>,
  context: EffectContext
) => CleanupFunction | void | Promise<void>;

export interface EffectObject<TState, TEvent extends EventObject> {
  [key: string]: any;
  type: string;
  exec?: EffectFunction<TState, TEvent, any>;
}

export type Effect<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> = TEffect | EffectFunction<TState, TEvent, TEffect>;

type EntityTuple<TState, TEvent extends EventObject> = [
  TState,
  InternalEffectEntity<TState, TEvent>[]
];

type AggregatedEffectsState<TState, TEvent extends EventObject> = [
  TState,
  EntityTuple<TState, TEvent>[],
  EffectEntity<TState, TEvent>[]
];

export interface EventObject {
  type: string;
  [key: string]: any;
}

export type EntityStatus = 'idle' | 'started' | 'stopped';

export interface EffectEntity<TState, TEvent extends EventObject> {
  type: string;
  status: EntityStatus;
  start: (state: TState, dispatch: Dispatch<TEvent>) => void;
  stop: () => void;
}

interface InternalEffectEntity<TState, TEvent extends EventObject>
  extends EffectEntity<TState, TEvent> {
  /** Restarts an entity that was stopped by an unmount (StrictMode, Activity) */
  resume: (state: TState) => void;
}

function createEffectEntity<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
>(
  effect: TEffect,
  resolveExec: () => EffectFunction<TState, TEvent, TEffect> | undefined
): InternalEffectEntity<TState, TEvent> {
  let effectCleanup: ReturnType<EffectFunction<TState, TEvent, TEffect>>;
  let controller: AbortController | undefined;
  let startArgs: [TState, Dispatch<TEvent>] | undefined;

  const run = () => {
    const [state, dispatch] = startArgs!;
    controller = new AbortController();
    effectCleanup = resolveExec()?.(state, effect, dispatch, {
      signal: controller.signal,
    });
    entity.status = 'started';
  };

  const entity: InternalEffectEntity<TState, TEvent> = {
    type: effect.type,
    status: 'idle',
    start: (state, dispatch) => {
      if (entity.status !== 'idle') return;
      startArgs = [state, dispatch];
      run();
    },
    stop: () => {
      if (entity.status === 'started') {
        controller?.abort();
        if (typeof effectCleanup === 'function') effectCleanup();
      }
      effectCleanup = undefined;
      entity.status = 'stopped';
    },
    resume: state => {
      if (entity.status === 'stopped' && startArgs) {
        startArgs[0] = state;
        run();
      }
    },
  };

  return entity;
}

export interface EffectReducerExec<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> {
  (effect: TEffect | EffectFunction<TState, TEvent, TEffect>): EffectEntity<
    TState,
    TEvent
  >;
  stop: (entity: EffectEntity<TState, TEvent> | undefined) => void;
  replace: (
    entity: EffectEntity<TState, TEvent> | undefined,
    effect: TEffect | EffectFunction<TState, TEvent, TEffect>
  ) => EffectEntity<TState, TEvent>;
}

export type EffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent> = EffectObject<TState, TEvent>
> = (
  state: TState,
  event: TEvent,
  exec: EffectReducerExec<TState, TEvent, TEffect>
) => TState;

const flushEffectsSymbol = Symbol();

interface FlushEvent<TState, TEvent extends EventObject> {
  type: typeof flushEffectsSymbol;
  tuples: EntityTuple<TState, TEvent>[];
}

export function toEffect<TState, TEvent extends EventObject>(
  exec: EffectFunction<TState, TEvent, any>
): Effect<TState, TEvent, any> {
  return {
    type: exec.name,
    exec,
  };
}

export type EffectsMap<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> = {
  [key in TEffect['type']]: EffectFunction<
    TState,
    TEvent,
    Extract<TEffect, { type: key }>
  >;
};

const toEventObject = <TEvent extends EventObject>(
  event: TEvent['type'] | TEvent
): TEvent => {
  if (typeof event === 'string') {
    return { type: event } as TEvent;
  }

  return event;
};

const toEffectObject = <
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
>(
  effect: TEffect | EffectFunction<TState, TEvent, TEffect>
): TEffect => {
  const type = typeof effect === 'function' ? effect.name : effect.type;
  const exec = typeof effect === 'function' ? effect : effect.exec;
  const other = typeof effect === 'function' ? {} : effect;

  return { ...other, type, exec } as TEffect;
};

export type InitialEffectStateGetter<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> = (
  exec: (
    effect: TEffect | EffectFunction<TState, TEvent, TEffect>
  ) => EffectEntity<TState, TEvent>
) => TState;

export function useEffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent> = EffectObject<TState, TEvent>
>(
  effectReducer: EffectReducer<TState, TEvent, TEffect>,
  initialState: TState | InitialEffectStateGetter<TState, TEvent, TEffect>,
  effectsMap?: EffectsMap<TState, TEvent, TEffect>
): [TState, Dispatch<TEvent>] {
  // Entities that have been started and not yet explicitly stopped
  const runningRef = useRef(new Set<InternalEffectEntity<TState, TEvent>>());

  // Effect implementations are looked up when an effect starts, so they
  // always see the latest props (like useEffectEvent)
  const effectsMapRef = useRef(effectsMap);
  useInsertionEffect(() => {
    effectsMapRef.current = effectsMap;
  });

  const createEntity = (
    effect: TEffect | EffectFunction<TState, TEvent, TEffect>
  ) => {
    const effectObject = toEffectObject(effect);
    return createEffectEntity<TState, TEvent, TEffect>(
      effectObject,
      () =>
        (effectsMapRef.current?.[effectObject.type as TEffect['type']] as
          | EffectFunction<TState, TEvent, TEffect>
          | undefined) ?? effectObject.exec
    );
  };

  const wrappedReducer = (
    [state, stateEffectTuples, entitiesToStop]: AggregatedEffectsState<
      TState,
      TEvent
    >,
    event: TEvent | FlushEvent<TState, TEvent>
  ): AggregatedEffectsState<TState, TEvent> => {
    const nextEffectEntities: Array<InternalEffectEntity<TState, TEvent>> = [];
    const nextEntitiesToStop: Array<EffectEntity<TState, TEvent>> = [];

    if (event.type === flushEffectsSymbol) {
      // Remove executed tuples by identity so that flushing is idempotent
      // (StrictMode re-runs effects, which would flush twice)
      const flushed = event.tuples;
      return [
        state,
        stateEffectTuples.filter(tuple => !flushed.includes(tuple)),
        nextEntitiesToStop,
      ];
    }

    const exec = (
      effect: TEffect | EffectFunction<TState, TEvent, TEffect>
    ) => {
      const effectEntity = createEntity(effect);
      nextEffectEntities.push(effectEntity);

      return effectEntity;
    };

    exec.stop = (entity: EffectEntity<TState, TEvent> | undefined) => {
      if (entity) {
        nextEntitiesToStop.push(entity);
      }
    };

    exec.replace = (
      entity: EffectEntity<TState, TEvent> | undefined,
      effect: TEffect | EffectFunction<TState, TEvent, TEffect>
    ) => {
      if (entity) {
        nextEntitiesToStop.push(entity);
      }
      return exec(effect);
    };

    const nextState = effectReducer(
      state,
      event,
      exec as EffectReducerExec<TState, TEvent, TEffect>
    );

    return [
      nextState,
      nextEffectEntities.length
        ? [...stateEffectTuples, [nextState, nextEffectEntities]]
        : stateEffectTuples,
      entitiesToStop.length
        ? [...entitiesToStop, ...nextEntitiesToStop]
        : nextEntitiesToStop,
    ];
  };

  const [
    [state, effectStateEntityTuples, entitiesToStop],
    dispatch,
  ] = useReducer(
    wrappedReducer,
    initialState,
    (initialState): AggregatedEffectsState<TState, TEvent> => {
      if (typeof initialState !== 'function') {
        return [initialState, [], []];
      }

      const initialEffectEntities: Array<InternalEffectEntity<
        TState,
        TEvent
      >> = [];
      const resolvedInitialState = (initialState as InitialEffectStateGetter<
        TState,
        TEvent,
        TEffect
      >)(effect => {
        const effectEntity = createEntity(effect);
        initialEffectEntities.push(effectEntity);
        return effectEntity;
      });

      return [
        resolvedInitialState,
        [[resolvedInitialState, initialEffectEntities]],
        [],
      ];
    }
  );

  const wrappedDispatch: Dispatch<TEvent> = useCallback(
    event => dispatch(toEventObject<TEvent>(event)),
    []
  );

  // First, stop all effects marked for disposal
  useEffect(() => {
    entitiesToStop.forEach(entity => {
      entity.stop();
      runningRef.current.delete(entity as InternalEffectEntity<TState, TEvent>);
    });
  }, [entitiesToStop]);

  // Then, execute all effects queued for execution
  useEffect(() => {
    if (effectStateEntityTuples.length) {
      effectStateEntityTuples.forEach(([effectState, effectEntities]) => {
        effectEntities.forEach(entity => {
          if (entity.status !== 'idle') return;

          runningRef.current.add(entity);
          entity.start(effectState, wrappedDispatch);
        });
      });

      // Optimization: flush effects that have been executed
      // so that they no longer need to be iterated through
      dispatch({ type: flushEffectsSymbol, tuples: effectStateEntityTuples });
    }
  }, [effectStateEntityTuples]);

  // Resumed effects receive the latest committed state
  const stateRef = useRef(state);
  useInsertionEffect(() => {
    stateRef.current = state;
  });

  // Stop all running effects on unmount. If the same instance remounts
  // (StrictMode, <Activity>), resume the effects that the unmount stopped.
  useEffect(() => {
    const running = runningRef.current;
    running.forEach(entity => entity.resume(stateRef.current));

    return () => {
      running.forEach(entity => entity.stop());
    };
  }, []);

  return [state, wrappedDispatch];
}
