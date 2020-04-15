import { useReducer, useEffect } from 'react';

type EffectFunction<TState> = (
  state: TState,
  effect: EffectObject<TState>
) => void;

interface EffectObject<TState> {
  [key: string]: any;
  type: string;
  exec?: EffectFunction<TState>;
}

type Effect<TState> = EffectObject<TState> | EffectFunction<TState>;

type StateEffectTuple<TState> =
  | [TState, Effect<TState>[] | undefined]
  | [TState];

type AggregatedEffectsState<TState> = [TState, StateEffectTuple<TState>[]];

export type EffectReducer<TState, TEvent = any> = (
  state: TState,
  event: TEvent,
  exec: (effect: Effect<TState>) => void
) => TState;

const flushEffectsSymbol = Symbol();

export function toEffect<TState>(exec: EffectFunction<TState>): Effect<TState> {
  return {
    type: exec.name,
    exec,
  };
}

interface EffectsMap<TState> {
  [key: string]: EffectFunction<TState>;
}

export function useEffectReducer<TState, TEvent>(
  effectReducer: EffectReducer<TState, TEvent>,
  initialState: TState,
  effectsMap?: EffectsMap<TState>
): [TState, React.Dispatch<TEvent>] {
  const wrappedReducer = (
    [state, effects]: AggregatedEffectsState<TState>,
    event: TEvent | typeof flushEffectsSymbol
  ): AggregatedEffectsState<TState> => {
    const nextEffects: Array<Effect<TState>> = [];

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

  return [state, dispatch];
}
