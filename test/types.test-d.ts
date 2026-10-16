import { useEffectReducer, EffectReducer, EffectEntity } from '../src';

interface State { n: number; e?: EffectEntity<State, Ev> }
interface Inc { type: 'INC' }
type Ev = Inc | { type: 'DEC'; by: number };
type Fx = { type: 'log'; msg: string } | { type: 'save'; n: number };

const r: EffectReducer<State, Ev, Fx> = (s, e, exec) => {
  exec({ type: 'log', msg: 'x' });
  // @ts-expect-error unknown effect type
  exec({ type: 'nope' });
  // @ts-expect-error wrong payload
  exec({ type: 'log', n: 1 });
  // @ts-expect-error missing payload
  exec({ type: 'save' });
  exec.stop(s.e);
  return s;
};

export function C() {
  const [, dispatch] = useEffectReducer(r, { n: 0 }, {
    log: (_, fx) => { const m: string = fx.msg; void m; },
    save: (_, fx, d) => { const k: number = fx.n; void k; d('INC'); d({ type: 'DEC', by: 1 });
      // @ts-expect-error bad event
      d('NOPE');
    },
  });
  dispatch('INC');
  // @ts-expect-error missing payload
  dispatch('DEC');
  // @ts-expect-error unknown
  dispatch('X');
  // @ts-expect-error missing effect impl
  useEffectReducer(r, { n: 0 }, { log: () => {} });
}

export function D() {
  useEffectReducer(r, exec => {
    // @ts-expect-error unknown effect type
    exec({ type: 'nope' });
    exec((_s, _fx, d) => {
      // @ts-expect-error bad event
      d('NOPE');
    });
    return { n: 0 };
  }, { log: () => {}, save: () => {} });
}
