import test from 'ava';

import { MultiIndex, NonuniqueIndexError } from '..';

interface Obj {
  n: number;
  s: string;
}

const indexTypes = {
  num: { getter: ({ n }: Obj) => n, unique: true },
  str: { getter: ({ s }: Obj) => s },
};

test('MultiIndex adds and looks up unique', (t) => {
  const mi = new MultiIndex<Obj>(indexTypes);
  mi.add({ n: 1, s: 'a' });
  t.deepEqual(mi.by('num').get(1), { n: 1, s: 'a' });
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
