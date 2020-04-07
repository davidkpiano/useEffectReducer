import * as React from 'react';
import { useEffect } from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEffectReducer, toEffect } from '../src';

describe('it', () => {
  afterEach(cleanup);

  it('renders without crashing', () => {
    const Thing = () => {
      const [state, dispatch] = useEffectReducer(
        (state: { count: number }, event: any) => {
          if (event.type === 'INC') {
            return [
              { ...state, count: state.count + 1 },
              [
                toEffect(s => {
                  console.log('yeah', s);
                }),
              ],
            ];
          }

          return [state];
        },
        { count: 0 }
      );

      console.log(state);

      useEffect(() => {
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
        dispatch({ type: 'INC' });
      }, []);

      return null;
    };

    render(<Thing />);
  });
});
