import { useReducer, useEffect, useCallback } from 'react';

type CleanupFunction = () => void;

export type EffectFunction<TState, TEvent> = (
  state: TState,
  effect: EffectObject<TState, TEvent>,
  dispatch: React.Dispatch<TEvent>
) => CleanupFunction | void;

export interface EffectObject<TState, TEvent> {
  [key: string]: any;
  type: string;
  exec?: EffectFunction<TState, TEvent>;
}

export type Effect<
  TState,
  TEvent,
  TEffect extends EffectObject<TState, TEvent>
> = TEffect | EffectFunction<TState, TEvent>;

type StateEffectTuple<TState, TEvent extends EventObject> = [
  TState,
  EffectEntity<TState, TEvent>[]
];

type AggregatedEffectsState<TState, TEvent extends EventObject> = [
  TState,
  StateEffectTuple<TState, TEvent>[],
  EffectEntity<TState, TEvent>[]
];

export interface EventObject {
  type: string;
  [key: string]: any;
}

export interface EffectEntity<TState, TEvent extends EventObject> {
  type: string;
  start: (state: TState, dispatch: React.Dispatch<TEvent>) => void;
  stop: () => void;
}

function createEffectEntity<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
>(effect: TEffect): EffectEntity<TState, TEvent> {
  let effectCleanup: CleanupFunction | void;

  return {
    type: effect.type,
    start: (state, dispatch) => {
      if (effect.exec) {
        effectCleanup = effect.exec(state, effect, dispatch);
      }
    },
    stop: () => {
      if (effectCleanup && typeof effectCleanup === 'function') {
        effectCleanup();
      }
    },
  };
}

export interface EffectReducerExec<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent>
> {
  (effect: TEffect | EffectFunction<TState, TEvent>): EffectEntity<
    TState,
    TEvent
  >;
  stop: (entity: EffectEntity<TState, TEvent>) => void;
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

// 🚽
interface FlushEvent {
  type: typeof flushEffectsSymbol;
  count: number;
}

export function toEffect<TState, TEvent>(
  exec: EffectFunction<TState, TEvent>
): Effect<TState, TEvent, any> {
  return {
    type: exec.name,
    exec,
  };
}

interface EffectsMap<TState, TEvent> {
  [key: string]: EffectFunction<TState, TEvent>;
}

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
  effect: TEffect | EffectFunction<TState, TEvent>,
  effectsMap?: EffectsMap<TState, TEvent>
): TEffect => {
  const type = typeof effect === 'function' ? effect.name : effect.type;
  const customExec = effectsMap ? effectsMap[type] : undefined;
  const exec =
    customExec || (typeof effect === 'function' ? effect : effect.exec);
  const other = typeof effect === 'function' ? {} : effect;

  return { ...other, type, exec } as TEffect;
};

export function useEffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent> = EffectObject<TState, TEvent>
>(
  effectReducer: EffectReducer<TState, TEvent, TEffect>,
  initialState: TState,
  effectsMap?: EffectsMap<TState, TEvent>
): [TState, React.Dispatch<TEvent | TEvent['type']>] {
  const wrappedReducer = (
    [state, stateEffectTuples, entitiesToStop]: AggregatedEffectsState<
      TState,
      TEvent
    >,
    event: TEvent | FlushEvent
  ): AggregatedEffectsState<TState, TEvent> => {
    const nextEffectEntities: Array<EffectEntity<TState, TEvent>> = [];
    const nextEntitiesToStop: Array<EffectEntity<TState, TEvent>> = [];

    if (event.type === flushEffectsSymbol) {
      // Record that effects have already been executed
      return [state, stateEffectTuples.slice(event.count), nextEntitiesToStop];
    }

    const exec = (effect: TEffect) => {
      const effectObject = toEffectObject(effect, effectsMap);
      const effectEntity = createEffectEntity<TState, TEvent, TEffect>(
        effectObject
      );
      nextEffectEntities.push(effectEntity);

      return effectEntity;
    };

    exec.stop = (entity: EffectEntity<TState, TEvent>) => {
      nextEntitiesToStop.push(entity);
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
  ] = useReducer(wrappedReducer, [initialState, [], []]);

  const wrappedDispatch = useCallback((event: TEvent | TEvent['type']) => {
    dispatch(toEventObject(event));
  }, []);

  useEffect(() => {
    // perform cleanup first
    if (entitiesToStop.length) {
      entitiesToStop.forEach(entity => {
        entity.stop();
      });
    }
  }, [entitiesToStop]);

  useEffect(() => {
    if (effectStateEntityTuples.length) {
      effectStateEntityTuples.forEach(([effectState, effectEntities]) => {
        effectEntities.forEach(effectEntity => {
          effectEntity.start(effectState, dispatch);
        });
      });

      dispatch({
        type: flushEffectsSymbol,
        count: effectStateEntityTuples.length,
      });
    }
  }, [effectStateEntityTuples]);

  return [state, wrappedDispatch];
}
