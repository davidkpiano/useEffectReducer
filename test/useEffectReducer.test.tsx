import { useState, useEffect, useLayoutEffect, StrictMode } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  useEffectReducer,
  EffectReducer,
  EffectEntity,
  InitialEffectStateGetter,
} from '../src';

describe('useEffectReducer', () => {
  it('basic example', async () => {
    interface User {
      name: string;
    }

    type FetchState =
      | {
          status: 'idle';
          user: undefined;
        }
      | {
          status: 'fetching';
          user: User | undefined;
        }
      | {
          status: 'fulfilled';
          user: User;
        };

    type FetchEvent =
      | {
          type: 'FETCH';
          user: string;
        }
      | {
          type: 'RESOLVE';
          data: User;
        };

    type FetchEffect = {
      type: 'fetchFromAPI';
      user: string;
    };

    const fetchEffectReducer: EffectReducer<
      FetchState,
      FetchEvent,
      FetchEffect
    > = (state, event, exec) => {
      switch (event.type) {
        case 'FETCH':
          exec({ type: 'fetchFromAPI', user: event.user });
          return {
            ...state,
            status: 'fetching',
          };
        case 'RESOLVE':
          return {
            status: 'fulfilled',
            user: event.data,
          };
        default:
          return state;
      }
    };

    const Fetcher = () => {
      const [state, dispatch] = useEffectReducer(
        fetchEffectReducer,
        { status: 'idle', user: undefined },
        {
          fetchFromAPI(_, effect) {
            setTimeout(() => {
              dispatch({
                type: 'RESOLVE',
                data: { name: effect.user },
              });
            }, 100);
          },
        }
      );

      return (
        <div
          onClick={() => dispatch({ type: 'FETCH', user: '42' })}
          data-testid="result"
        >
          {state.user ? state.user.name : '--'}
        </div>
      );
    };

    const { getByTestId } = render(<Fetcher />);

    const resultEl = getByTestId('result');

    expect(resultEl.textContent).toEqual('--');

    fireEvent.click(resultEl);

    await waitFor(() => {
      expect(resultEl.textContent).toEqual('42');
    });
  });

  it('third argument dispatch', async () => {
    interface User {
      name: string;
    }

    type FetchState =
      | {
          status: 'idle';
          user: undefined;
        }
      | {
          status: 'fetching';
          user: User | undefined;
        }
      | {
          status: 'fulfilled';
          user: User;
        };

    type FetchEvent =
      | {
          type: 'FETCH';
          user: string;
        }
      | {
          type: 'RESOLVE';
          data: User;
        };

    type FetchEffect = {
      type: 'fetchFromAPI';
      user: string;
    };

    const fetchEffectReducer: EffectReducer<
      FetchState,
      FetchEvent,
      FetchEffect
    > = (state, event, exec) => {
      switch (event.type) {
        case 'FETCH':
          exec({ type: 'fetchFromAPI', user: event.user });
          return {
            ...state,
            status: 'fetching',
          };
        case 'RESOLVE':
          return {
            status: 'fulfilled',
            user: event.data,
          };
        default:
          return state;
      }
    };

    const Fetcher = () => {
      const [state, dispatch] = useEffectReducer(
        fetchEffectReducer,
        { status: 'idle', user: undefined },
        {
          fetchFromAPI(_, effect, _dispatch) {
            setTimeout(() => {
              _dispatch({
                type: 'RESOLVE',
                data: { name: effect.user },
              });
            }, 100);
          },
        }
      );

      return (
        <div
          onClick={() => dispatch({ type: 'FETCH', user: '42' })}
          data-testid="result"
        >
          {state.user ? state.user.name : '--'}
        </div>
      );
    };

    const { getByTestId } = render(<Fetcher />);

    const resultEl = getByTestId('result');

    expect(resultEl.textContent).toEqual('--');

    fireEvent.click(resultEl);

    await waitFor(() => {
      expect(resultEl.textContent).toEqual('42');
    });
  });

  it('handles batched dispatch calls', () => {
    interface ThingContext {
      count: number;
    }

    type ThingEvent = {
      type: 'INC';
    };

    const sideEffectCapture: any[] = [];
    let renderCount = 0;

    const Thing = () => {
      const [state, dispatch] = useEffectReducer<ThingContext, ThingEvent>(
        (state, event, exec) => {
          if (event.type === 'INC') {
            exec(s => {
              sideEffectCapture.push(s.count);
            });
            return { ...state, count: state.count + 1 };
          }

          return state;
        },
        { count: 0 }
      );

      // just for tracking renders
      renderCount++;

      useEffect(() => {
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
      }, []);

      return <div data-testid="count">{state.count}</div>;
    };

    const { getByTestId } = render(<Thing />);

    expect(getByTestId('count').textContent).toEqual('5');

    expect(sideEffectCapture).toEqual([1, 2, 3, 4, 5]);
  });

  it('supports queueing effects during commit phase', () => {
    let effectCount = 0;

    const Thing = () => {
      const [hasClicked, setHasClicked] = useState(false);
      const [count, dispatch] = useEffectReducer((state, _event, exec) => {
        exec(() => {
          effectCount += 1;
        });
        return state + 1;
      }, 0);

      useLayoutEffect(() => {
        if (hasClicked) dispatch({ type: 'foo' });
      }, [hasClicked, dispatch]);

      function handleClick() {
        setHasClicked(true);
        dispatch({ type: 'foo' });
      }

      return (
        <>
          <div data-testid="count">{count}</div>
          <button data-testid="button" onClick={handleClick} />
        </>
      );
    };

    const { getByTestId } = render(<Thing />);

    expect(getByTestId('count').textContent).toEqual('0');

    const buttonEl = getByTestId('button');
    fireEvent.click(buttonEl);

    expect(getByTestId('count').textContent).toEqual('2');
    expect(effectCount).toEqual(2);
  });

  it('should run cleanup when effectEntity.stop() is called', async () => {
    interface ThingContext {
      count: number;
      entity?: any;
    }

    type ThingEvent =
      | {
          type: 'INC';
        }
      | { type: 'STOP' };

    let started = false;
    let stopped = false;

    const Thing = () => {
      const [state, dispatch] = useEffectReducer<ThingContext, ThingEvent>(
        (state, event, exec) => {
          if (event.type === 'INC') {
            if (state.count === 0) {
              return {
                count: 1,
                entity: exec(() => {
                  started = true;

                  return () => {
                    stopped = true;
                  };
                }),
              };
            }

            return { ...state, count: state.count + 1 };
          }

          if (event.type === 'STOP') {
            exec.stop(state.entity!);

            return state;
          }

          return state;
        },
        { count: 0 }
      );

      useEffect(() => {
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });

        setTimeout(() => {
          dispatch({ type: 'STOP' });
        }, 10);
      }, []);

      return <div data-testid="count">{state.count}</div>;
    };

    const { getByTestId } = render(<Thing />);

    expect(getByTestId('count').textContent).toEqual('5');

    expect(started).toBeTruthy();
    expect(stopped).toBeFalsy();

    await waitFor(() => {
      expect(stopped).toBeTruthy();
    });
  });

  it('should run cleanup when the component is unmounted', () => {
    let started = false;
    let stopped = false;

    const reducer: EffectReducer<{ status: string }, { type: 'START' }> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'START') {
        exec(() => {
          started = true;

          return () => {
            stopped = true;
          };
        });

        return {
          status: 'started',
        };
      }

      return state;
    };

    const Thing = () => {
      const [state, dispatch] = useEffectReducer(reducer, { status: 'idle' });

      return (
        <div
          data-testid="status"
          onClick={() => {
            dispatch('START');
          }}
        >
          {state.status}
        </div>
      );
    };

    const App = () => {
      const [hidden, setHidden] = useState(false);

      return hidden ? null : (
        <div>
          <button data-testid="hide" onClick={() => setHidden(true)}></button>
          <Thing />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    const statusEl = getByTestId('status');
    const buttonEl = getByTestId('hide');

    expect(statusEl.textContent).toEqual('idle');
    expect(started).toBeFalsy();

    fireEvent.click(statusEl);

    expect(started).toBeTruthy();
    expect(stopped).toBeFalsy();

    expect(statusEl.textContent).toEqual('started');

    fireEvent.click(buttonEl);

    expect(stopped).toBeTruthy();
  });

  it('exec.replace() should replace an effect', async () => {
    vi.useFakeTimers();
    const delayedResults: string[] = [];

    type TimerEvent = {
      type: 'START';
      delayedMessage: string;
    };

    interface TimerState {
      timer?: EffectEntity<TimerState, TimerEvent>;
    }

    const timerReducer: EffectReducer<TimerState, TimerEvent> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'START') {
        return {
          ...state,
          timer: exec.replace(state.timer, () => {
            const id = setTimeout(() => {
              delayedResults.push(event.delayedMessage);
            }, 100);

            return () => {
              clearTimeout(id);
            };
          }),
        };
      }

      return state;
    };

    const App = () => {
      const [, dispatch] = useEffectReducer(timerReducer, {});

      return (
        <div>
          <button
            data-testid="send-hello"
            onClick={() => dispatch({ type: 'START', delayedMessage: 'hello' })}
          ></button>
          <button
            data-testid="send-goodbye"
            onClick={() =>
              dispatch({ type: 'START', delayedMessage: 'goodbye' })
            }
          ></button>
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    const helloButton = getByTestId('send-hello');
    const goodbyeButton = getByTestId('send-goodbye');

    fireEvent.click(helloButton);

    // Advance past the first click but not far enough for timer to fire
    await act(async () => {
      vi.advanceTimersByTime(30);
    });

    fireEvent.click(goodbyeButton);

    // Advance past the second timer
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // If the first timer effect isn't replaced (disposed),
    // delayedResults will be ['hello', 'goodbye']
    expect(delayedResults).toEqual(['goodbye']);

    vi.useRealTimers();
  });

  it('should allow for initial effects', async () => {
    interface FetchState {
      data: null | string;
      effect: EffectEntity<FetchState, FetchEvent>;
    }

    type FetchEvent = {
      type: 'RESOLVE';
      data: string;
    };

    type FetchEffects =
      | {
          type: 'fetchData';
          data: string;
        }
      | {
          type: 'effect';
        };

    const fetchReducer: EffectReducer<FetchState, FetchEvent, FetchEffects> = (
      state,
      event
    ) => {
      if (event.type === 'RESOLVE') {
        state.effect.stop();
        return {
          ...state,
          data: event.data,
        };
      }

      return state;
    };

    const getInitialState: InitialEffectStateGetter<
      FetchState,
      FetchEvent,
      FetchEffects
    > = exec => {
      exec({ type: 'fetchData', data: 'secret' });
      const effect = exec({ type: 'effect' });

      return { data: null, effect };
    };

    let started = false;
    let stopped = false;

    const App = () => {
      const [state, dispatch] = useEffectReducer(
        fetchReducer,
        getInitialState,
        {
          fetchData(_, { data }) {
            setTimeout(() => {
              dispatch({ type: 'RESOLVE', data: data.toUpperCase() });
            }, 20);
          },
          effect() {
            started = true;

            return () => {
              stopped = true;
            };
          },
        }
      );

      return <div data-testid="result">{state.data || '--'}</div>;
    };

    const { getByTestId } = render(<App />);
    expect(started).toBeTruthy();
    const result = getByTestId('result');

    expect(result.textContent).toEqual('--');

    await waitFor(() => {
      expect(result.textContent).toEqual('SECRET');
      expect(stopped).toBeTruthy();
    });
  });

  // --- Edge case tests ---

  it('should handle stop on already-stopped entity without error', async () => {
    interface TestState {
      entity?: EffectEntity<TestState, { type: 'START' } | { type: 'STOP' }>;
    }

    let cleanupCount = 0;

    const reducer: EffectReducer<
      TestState,
      { type: 'START' } | { type: 'STOP' }
    > = (state, event, exec) => {
      if (event.type === 'START') {
        return {
          entity: exec(() => {
            return () => {
              cleanupCount++;
            };
          }),
        };
      }
      if (event.type === 'STOP') {
        if (state.entity) {
          exec.stop(state.entity);
        }
        return state;
      }
      return state;
    };

    const App = () => {
      const [, dispatch] = useEffectReducer(reducer, {});

      return (
        <div>
          <button
            data-testid="start"
            onClick={() => dispatch({ type: 'START' })}
          />
          <button
            data-testid="stop"
            onClick={() => dispatch({ type: 'STOP' })}
          />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    fireEvent.click(getByTestId('start'));
    fireEvent.click(getByTestId('stop'));

    await waitFor(() => {
      expect(cleanupCount).toBe(1);
    });

    // Stop again — should not error or double-cleanup
    fireEvent.click(getByTestId('stop'));

    // Cleanup should still be 1
    expect(cleanupCount).toBe(1);
  });

  it('should handle exec.replace with undefined entity', () => {
    let effectRan = false;

    const reducer: EffectReducer<
      { timer?: EffectEntity<any, any> },
      { type: 'GO' }
    > = (state, event, exec) => {
      if (event.type === 'GO') {
        return {
          timer: exec.replace(undefined, () => {
            effectRan = true;
          }),
        };
      }
      return state;
    };

    const App = () => {
      const [, dispatch] = useEffectReducer(reducer, {});
      return (
        <button
          data-testid="go"
          onClick={() => dispatch({ type: 'GO' })}
        />
      );
    };

    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('go'));

    expect(effectRan).toBeTruthy();
  });

  it('should handle dispatch from within an effect callback', async () => {
    const reducer: EffectReducer<
      number,
      { type: 'START' } | { type: 'EFFECT_DONE' }
    > = (state, event, exec) => {
      if (event.type === 'START') {
        exec((_state, _effect, dispatch) => {
          dispatch({ type: 'EFFECT_DONE' });
        });
        return state;
      }
      if (event.type === 'EFFECT_DONE') {
        return state + 1;
      }
      return state;
    };

    const App = () => {
      const [count, dispatch] = useEffectReducer(reducer, 0);
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="start"
            onClick={() => dispatch({ type: 'START' })}
          />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('count').textContent).toEqual('0');

    fireEvent.click(getByTestId('start'));

    await waitFor(() => {
      expect(getByTestId('count').textContent).toEqual('1');
    });
  });

  it('should execute multiple effects queued in a single dispatch', () => {
    const effectLog: string[] = [];

    const reducer: EffectReducer<number, { type: 'GO' }> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'GO') {
        exec(() => {
          effectLog.push('effect1');
        });
        exec(() => {
          effectLog.push('effect2');
        });
        exec(() => {
          effectLog.push('effect3');
        });
        return state + 1;
      }
      return state;
    };

    const App = () => {
      const [count, dispatch] = useEffectReducer(reducer, 0);
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="go"
            onClick={() => dispatch({ type: 'GO' })}
          />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    fireEvent.click(getByTestId('go'));

    expect(getByTestId('count').textContent).toEqual('1');
    expect(effectLog).toEqual(['effect1', 'effect2', 'effect3']);
  });

  it('should cleanup all started effects on unmount', () => {
    const cleanupLog: string[] = [];

    const reducer: EffectReducer<number, { type: 'ADD' }> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'ADD') {
        exec(() => {
          return () => {
            cleanupLog.push(`cleanup-${state + 1}`);
          };
        });
        return state + 1;
      }
      return state;
    };

    const Thing = () => {
      const [count, dispatch] = useEffectReducer(reducer, 0);

      useEffect(() => {
        dispatch({ type: 'ADD' });
        dispatch({ type: 'ADD' });
        dispatch({ type: 'ADD' });
      }, []);

      return <div data-testid="count">{count}</div>;
    };

    const App = () => {
      const [show, setShow] = useState(true);
      return (
        <div>
          {show && <Thing />}
          <button data-testid="hide" onClick={() => setShow(false)} />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('count').textContent).toEqual('3');
    expect(cleanupLog).toEqual([]);

    fireEvent.click(getByTestId('hide'));

    expect(cleanupLog).toEqual(['cleanup-1', 'cleanup-2', 'cleanup-3']);
  });

  it('should work correctly with StrictMode', async () => {
    let effectRunCount = 0;

    const reducer: EffectReducer<number, { type: 'INC' }> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'INC') {
        exec(() => {
          effectRunCount++;
        });
        return state + 1;
      }
      return state;
    };

    const App = () => {
      const [count, dispatch] = useEffectReducer(reducer, 0);
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="inc"
            onClick={() => dispatch({ type: 'INC' })}
          />
        </div>
      );
    };

    const { getByTestId } = render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    expect(getByTestId('count').textContent).toEqual('0');

    fireEvent.click(getByTestId('inc'));

    await waitFor(() => {
      expect(getByTestId('count').textContent).toEqual('1');
    });

    // In StrictMode, effects may run twice (mount/unmount/remount).
    // The important thing is that the state is correct
    // and effects are not duplicated in the committed output.
    expect(effectRunCount).toBeGreaterThanOrEqual(1);
  });

  it('should handle rapid dispatch before effects commit', () => {
    const effectStates: number[] = [];

    const reducer: EffectReducer<number, { type: 'INC' }> = (
      state,
      event,
      exec
    ) => {
      if (event.type === 'INC') {
        const nextState = state + 1;
        exec(s => {
          effectStates.push(s);
        });
        return nextState;
      }
      return state;
    };

    const App = () => {
      const [count, dispatch] = useEffectReducer(reducer, 0);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="rapid"
            onClick={() => {
              dispatch({ type: 'INC' });
              dispatch({ type: 'INC' });
              dispatch({ type: 'INC' });
            }}
          />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    fireEvent.click(getByTestId('rapid'));

    expect(getByTestId('count').textContent).toEqual('3');
    // Each effect should receive the state snapshot at the time it was queued
    expect(effectStates).toEqual([1, 2, 3]);
  });
});
