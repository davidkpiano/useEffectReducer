import * as React from 'react';
import { useEffect } from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEffectReducer, toEffect } from '../src';

describe('useEffectReducer', () => {
  afterEach(cleanup);

  it('handles batched dispatch calls', () => {
    const sideEffectCapture: any[] = [];
    let renderCount = 0;

    const Thing = () => {
      const [state, dispatch] = useEffectReducer(
        (state: { count: number }, event: any, exec) => {
          if (event.type === 'INC') {
            exec(
              toEffect(s => {
                sideEffectCapture.push(s.count);
              })
            );
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
});
