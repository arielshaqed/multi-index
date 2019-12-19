import test from 'ava';

import { MultiIndex, NonuniqueIndexError } from '..';

interface Obj {
  n: number;
  s: string;
}

const indexTypes = {
  str: { getter: ({ s }: Obj) => s, type: 'string' as const },
  num: { getter: ({ n }: Obj) => n, unique: true, type: 'number' as const },
};

// Compilation test
(m: MultiIndex<Obj>) => {
  const sui: ReadonlyMap<string, Obj> = m.by('str', true, 'string');
  const smi: ReadonlyMap<string, ReadonlySet<Obj>> = m.by('xyzzy', false, 'string');
  const nui: ReadonlyMap<number, Obj> = m.by('quux', true, 'number');
  const nmi: ReadonlyMap<number, ReadonlySet<Obj>> = m.by('num', false, 'number');
  return [sui, smi, nui, nmi];
};

test('MultiIndex adds and looks up unique', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  mi.add({ n: 1, s: 'a' });
  t.deepEqual(mi.by('num', true, 'number').get(1), { n: 1, s: 'a' });
});

test('MultiIndex adds and looks up nonunique', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  mi.add({ n: 1, s: 'a' });
  t.deepEqual(mi.by('str').get('a'), new Set([{ n: 1, s: 'a' }]));
  mi.add({ n: 2, s: 'a' });
  t.deepEqual(mi.by('str').get('a'), new Set([{ n: 1, s: 'a' }, { n: 2, s: 'a' }]));
});

test('MultiIndex refuses to overwrite value in unique index', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  mi.add({ n: 1, s: 'a' });
  t.throws(
    () => mi.add({ n: 1, s: 'b' }),
    NonuniqueIndexError,
  );
});

test('MultiIndex deletes on unique index', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  const a = { n: 1, s: 'a' };
  mi.add(a);
  mi.delete(a);
  mi.add({ n: 1, s: 'b' });
  t.deepEqual(mi.by('num').get(1), { n: 1, s: 'b' });
});

test('MultiIndex deletes on nonunique index', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  const a = { n: 1, s: 'a' };
  mi.add(a);
  const b = { n: 2, s: 'a' };
  mi.add(b);
  mi.delete(a);
  t.deepEqual(mi.by('str').get('a'), new Set([b]));
});

test('MultiIndex updates all indexes', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  const a = { n: 1, s: 'a' };
  const b = { n: 2, s: 'a' };
  mi.add(a);
  mi.add(b);

  mi.delete(a);
  t.deepEqual(mi.by('num').get(1), undefined);
});
