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
  container.add({ n: 1, s: 'a' }).add({ n: 2, s: 'b' });
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
  const nie: NonuniqueIndexError<Obj, number> = t.throws(
    () => container.add({ n: 1, s: 'b' }),
    { instanceOf: NonuniqueIndexError },
  );
  t.assert(nie.key === 1);
  t.deepEqual(nie.value, { n: 1, s: 'b' });
});

test('Container deletes on unique index', (t) => {
  const { container, byNumber, byString } = make();
  const a = { n: 1, s: 'a' };
  container.add(a);
  t.true(container.delete(a));
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
  t.true(container.delete(a));
  t.is(byNumber.get(1), undefined);
  t.deepEqual(byNumber.get(2), b);
  t.deepEqual(byString.get('a'), new Set([b]));
});

test('Indexes can be added after-the-fact', (t) => {
  const { container, byNumber, byString } = make();
  for (const n of [1, 2, 3]) container.add({ n, s: 'a' });
  const byNumber2 = uniqueIndex(({ n }: Obj) => n, 'by n again').on(container);
  const byString2 = nonuniqueIndex(({ s }: Obj) => s, 'by s again').on(container);

  t.deepEqual(byNumber, byNumber2);
  t.deepEqual(byString, byString2);

  container.add({ n: 99, s: 'z' });
  t.deepEqual(byNumber, byNumber2);
  t.deepEqual(byString, byString2);
});

test('Indexes can fail to be added after-the-fact', (t) => {
  const { container } = make();
  container.add({ n: 1, s: 'a' });
  container.add({ n: 2, s: 'a' });
  container.add({ n: 3, s: 'a' });
  const nie: NonuniqueIndexError<Obj, number> = t.throws(
    () => uniqueIndex(({ n }: Obj) => n % 2, 'by n even').on(container),
    { instanceOf: NonuniqueIndexError },
  );
  t.assert(nie.key === 1);
  // This relied on implementation: objects Set in actual
  // implementation is ordered by insertion time, so we know which
  // element could not be added here!
  t.deepEqual(nie.value, { n: 3, s: 'a' });
});

test('Container deletes the right object', (t) => {
  const container = new Container<Obj>();
  const byNumber = uniqueIndex(({ n }: Obj) => n, 'by n').on(container);
  container.add({ n: 1, s: 'a' });
  t.false(container.delete({ n: 1, s: 'some completely different object' }));
  t.deepEqual(byNumber.get(1), { n: 1, s: 'a' });
});
