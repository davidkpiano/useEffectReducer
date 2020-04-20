import { useReducer, useEffect, useCallback } from 'react';

export type EffectFunction<TState> = (
  state: TState,
  effect: EffectObject<TState>
) => void;

export interface EffectObject<TState> {
  [key: string]: any;
  type: string;
  exec?: EffectFunction<TState>;
}

export type Effect<TState, TEffect extends EffectObject<TState>> =
  | TEffect
  | EffectFunction<TState>;

type StateEffectTuple<TState, TEffect extends EffectObject<TState>> =
  | [TState, Effect<TState, TEffect>[] | undefined]
  | [TState];

type AggregatedEffectsState<TState, TEffect extends EffectObject<TState>> = [
  TState,
  StateEffectTuple<TState, TEffect>[]
];

export interface EventObject {
  type: string;
  [key: string]: any;
}

export type EffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState> = EffectObject<TState>
> = (
  state: TState,
  event: TEvent,
  exec: (effect: TEffect | EffectFunction<TState>) => void
) => TState;

const flushEffectsSymbol = Symbol();

export function toEffect<TState>(
  exec: EffectFunction<TState>
): Effect<TState, any> {
  return {
    type: exec.name,
    exec,
  };
}

interface EffectsMap<TState> {
  [key: string]: EffectFunction<TState>;
}

const toEventObject = <TEvent extends EventObject>(
  event: TEvent['type'] | TEvent
): TEvent => {
  if (typeof event === 'string') {
    return { type: event } as TEvent;
  }

  return event;
};

export function useEffectReducer<
  TState,
  TEvent extends EventObject,
  TEffect extends EffectObject<TState> = EffectObject<TState>
>(
  effectReducer: EffectReducer<TState, TEvent, TEffect>,
  initialState: TState,
  effectsMap?: EffectsMap<TState>
): [TState, React.Dispatch<TEvent | TEvent['type']>] {
  const wrappedReducer = (
    [state, effects]: AggregatedEffectsState<TState, TEffect>,
    event: TEvent | typeof flushEffectsSymbol
  ): AggregatedEffectsState<TState, TEffect> => {
    const nextEffects: Array<Effect<TState, TEffect>> = [];

    if (event === flushEffectsSymbol) {
      // Record that effects have already been executed
      return [state, []];
    }

    const nextState = effectReducer(state, event, effect => {
      nextEffects.push(effect);
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
          let effectImplementation: EffectFunction<TState> | undefined;
          if (typeof effect === 'object' && 'type' in effect) {
            if (effectsMap && effectsMap[effect.type]) {
              effectImplementation = effectsMap[effect.type] || effect.exec;
            } else {
              effectImplementation = effect.exec;
            }
          } else if (typeof effect === 'function') {
            effectImplementation = effect;
          }

          if (effectImplementation) {
            effectImplementation(
              stateForEffect,
              typeof effect === 'object' ? effect : { type: effect.name }
            );
          }
        });
      });

      dispatch(flushEffectsSymbol);
    }
  }, [stateEffectTuples]);

  return [state, wrappedDispatch];
}
