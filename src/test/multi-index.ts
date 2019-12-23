import test from 'ava';

import { Container, NonuniqueIndexError, uniqueIndex, nonuniqueIndex } from '..';

interface Obj {
  n: number;
  s: string;
}

function make() {
  const container = new Container<Obj>();
  const byNumber = uniqueIndex(({ n }: Obj) => n, 'by n').on(container);
  const byString = nonuniqueIndex(({ s }: Obj) => s, 'by s').on(container);
  return { container, byNumber, byString };
}

test('Container adds and looks up unique', (t) => {
  const { container, byNumber } = make();
  container.add({ n: 1, s: 'a' });
  container.add({ n: 2, s: 'b' });
  t.deepEqual(byNumber.get(1), { n: 1, s: 'a' });
  t.deepEqual(byNumber.get(2), { n: 2, s: 'b' });
});

test('Container adds and looks up nonunique', (t) => {
  const { container, byString } = make();
  container.add({ n: 1, s: 'a' });
  t.deepEqual(byString.get('a'), new Set([{ n: 1, s: 'a' }]));
  container.add({ n: 2, s: 'a' });
  t.deepEqual(byString.get('a'), new Set([{ n: 1, s: 'a' }, { n: 2, s: 'a' }]));
});

test('Container refuses to overwrite value in unique index', (t) => {
  const { container } = make();
  container.add({ n: 1, s: 'a' });
  t.throws(
    () => container.add({ n: 1, s: 'b' }),
    NonuniqueIndexError,
  );
});

test('Container deletes on unique index', (t) => {
  const { container, byNumber, byString } = make();
  const a = { n: 1, s: 'a' };
  container.add(a);
  container.delete(a);
  t.is(byNumber.get(1), undefined);
  t.is(byString.get('a'), undefined);
  container.add({ n: 1, s: 'b' });
  t.deepEqual(byNumber.get(1), { n: 1, s: 'b' });
  t.deepEqual(byString.get('b'), new Set([{ n: 1, s: 'b'}]));
});

test('Container deletes on nonunique index', (t) => {
  const { container, byNumber, byString } = make();
  const a = { n: 1, s: 'a' };
  container.add(a);
  const b = { n: 2, s: 'a' };
  container.add(b);
  container.delete(a);
  t.is(byNumber.get(1), undefined);
  t.deepEqual(byNumber.get(2), b);
  t.deepEqual(byString.get('a'), new Set([b]));
});
