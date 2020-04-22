import { useReducer, useEffect, useCallback } from 'react';

export type EffectFunction<TState, TEvent> = (
  state: TState,
  effect: EffectObject<TState, TEvent>,
  dispatch: React.Dispatch<TEvent>
) => void;

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

type StateEffectTuple<
  TState,
  TEvent,
  TEffect extends EffectObject<TState, TEvent>
> = [TState, TEffect[] | undefined] | [TState];

type AggregatedEffectsState<
  TState,
  TEvent,
  TEffect extends EffectObject<TState, TEvent>
> = [TState, StateEffectTuple<TState, TEvent, TEffect>[]];

export interface EventObject {
  type: string;
  [key: string]: any;
}

export type EffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState, TEvent> = EffectObject<TState, TEvent>
> = (
  state: TState,
  event: TEvent,
  exec: (effect: TEffect | EffectFunction<TState, TEvent>) => void
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
  effect: TEffect | EffectFunction<TState, TEvent>
): TEffect => {
  if (typeof effect === 'function') {
    return {
      type: effect.name,
      exec: effect,
    } as TEffect;
  }

  return effect;
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
    [state, effects]: AggregatedEffectsState<TState, TEvent, TEffect>,
    event: TEvent | FlushEvent
  ): AggregatedEffectsState<TState, TEvent, TEffect> => {
    const nextEffects: Array<TEffect> = [];

    if (event.type === flushEffectsSymbol) {
      // Record that effects have already been executed
      return [state, effects.slice(event.count)];
    }

    const nextState = effectReducer(state, event, effect => {
      nextEffects.push(toEffectObject(effect));
    });

    return [
      nextState,
      nextEffects.length ? [...effects, [nextState, nextEffects]] : effects,
    ];
  };

  const [[state, stateEffectTuples], dispatch] = useReducer(wrappedReducer, [
    initialState,
    [],
  ]);

  const wrappedDispatch = useCallback((event: TEvent | TEvent['type']) => {
    dispatch(toEventObject(event));
  }, []);

  useEffect(() => {
    if (stateEffectTuples.length) {
      stateEffectTuples.forEach(([stateForEffect, effects]) => {
        effects?.forEach(effect => {
          let effectImplementation: EffectFunction<TState, TEvent> | undefined;

          if (effectsMap && effectsMap[effect.type]) {
            effectImplementation = effectsMap[effect.type] || effect.exec;
          } else {
            effectImplementation = effect.exec;
          }

          if (effectImplementation) {
            effectImplementation(stateForEffect, effect, dispatch);
          }
        });
      });

      dispatch({ type: flushEffectsSymbol, count: stateEffectTuples.length });
    }
  }, [stateEffectTuples]);

  return [state, wrappedDispatch];
}
