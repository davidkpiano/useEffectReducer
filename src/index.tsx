import { useReducer, useEffect } from 'react';

type EffectExecutor<TState> = (state: TState) => void;

interface Effect<TState> {
  [key: string]: any;
  exec: (state: TState) => void;
}

type StateEffectTuple<TState> =
  | [TState, Effect<TState>[] | undefined]
  | [TState];

type AggregatedEffectsState<TState> =
  | [TState, StateEffectTuple<TState>[]]
  | [TState];

type EffectReducer<TState, TEvent> = (
  state: TState,
  event: TEvent
) => StateEffectTuple<TState>;

const flushEffectsSymbol = Symbol();

export function toEffect<TState>(exec: EffectExecutor<TState>): Effect<TState> {
  return {
    type: exec.name,
    exec,
  };
}

export function useEffectReducer<TState, TEvent>(
  effectReducer: EffectReducer<TState, TEvent>,
  initialState: TState
): [TState, React.Dispatch<TEvent>] {
  // const effectsRef = useRef<StateEffectTuple<TState>[]>([]);

  const wrappedReducer = (
    [state, prevEffectStates]: AggregatedEffectsState<TState>,
    event: TEvent | typeof flushEffectsSymbol
  ): AggregatedEffectsState<TState> => {
    if (event === flushEffectsSymbol) {
      // Record that effects have already been executed
      return [state];
    }

    const [nextState, nextEffects] = effectReducer(state, event);

    return [
      nextState,
      prevEffectStates
        ? [...prevEffectStates, [nextState, nextEffects]]
        : [[nextState, nextEffects]],
    ];
  };

  const [[state, effectStates], dispatch] = useReducer(wrappedReducer, [
    initialState,
  ]);

  useEffect(() => {
    if (effectStates) {
      effectStates.forEach(([stateForEffect, effects]) => {
        effects?.forEach(effect => {
          effect.exec(stateForEffect);
        });
      });

      dispatch(flushEffectsSymbol);
    }
  }, [effectStates]);

  return [state, dispatch];
}
