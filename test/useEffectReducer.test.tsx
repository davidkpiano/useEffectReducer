import * as React from 'react';
import { useEffect } from 'react';

import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

import {
  useEffectReducer,
  EffectReducer,
  EffectEntity,
  InitialEffectStateGetter,
} from '../src';

// have to add this because someone made a breaking change somewhere...
class MutationObserver {
  public observe() {}
  public disconnect() {}
}
(global as any).MutationObserver = MutationObserver;

describe('useEffectReducer', () => {
  afterEach(cleanup);

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

    // Should be less than number of side-effects due to batching
    expect(renderCount).toBeLessThan(sideEffectCapture.length);
  });

  it('supports queueing effects during commit phase', () => {
    let effectCount = 0;

    const Thing = () => {
      const [hasClicked, setHasClicked] = React.useState(false);
      const [count, dispatch] = useEffectReducer((state, _event, exec) => {
        exec(() => {
          effectCount += 1;
        });
        return state + 1;
      }, 0);

      React.useLayoutEffect(() => {
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
    // @ts-ignore
    let started = false;
    // @ts-ignore
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
      const [hidden, setHidden] = React.useState(false);

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

    setTimeout(() => {
      fireEvent.click(goodbyeButton);
    }, 30);

    await waitFor(() => {
      // If the first timer effect isn't replaced (disposed),
      // delayedResults will be ['hello', 'goodbye']
      expect(delayedResults).toEqual(['goodbye']);
    });
  });

  it('should allow for initial effects', async () => {
    interface FetchState {
      data: null | string;
    }

    type FetchEvent = {
      type: 'RESOLVE';
      data: string;
    };

    type FetchEffects = {
      type: 'fetchData';
      data: string;
    };

    const fetchReducer: EffectReducer<FetchState, FetchEvent, FetchEffects> = (
      state,
      event
    ) => {
      if (event.type === 'RESOLVE') {
        return {
          ...state,
          data: event.data,
        };
      }

      return state;
    };

    const getInitialState: InitialEffectStateGetter<
      FetchState,
      FetchEffects
    > = exec => {
      exec({ type: 'fetchData', data: 'secret' });

      return { data: null };
    };

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
        }
      );

      return <div data-testid="result">{state.data || '--'}</div>;
    };

    const { getByTestId } = render(<App />);
    const result = getByTestId('result');

    expect(result.textContent).toEqual('--');

    await waitFor(() => {
      expect(result.textContent).toEqual('SECRET');
    });
  });
});
