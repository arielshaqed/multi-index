[![Build status](https://github.com/binaris/multi-index/workflows/Node%20CI/badge.svg)](https://github.com/binaris/multi-index/actions)
[![Coverage Status](https://coveralls.io/repos/github/binaris/multi-index/badge.svg?branch=cover)](https://coveralls.io/github/binaris/multi-index?branch=cover)

# Multi-Index: Containers with more than one index

Multi-index separates container _storage_ from _indexing_.  You store
a set of objects and access them using any key you can compute from
those objects.

## Containers

Create a container:
```ts
import { Container, uniqueIndex, nonuniqueIndex } from 'multi-index';

interface Contact {
  id: string; // unique
  name: string;
  nickname: string;
  phone?: string;
}

const c = new Container<Contact>();
```

Everything works if you're using JavaScript, you'll just not bother with types:
```js
const { Container, uniqueIndex, nonuniqueIndex } = require('multi-index');

const c = new Container();
```

Usually you'd [add some indexes](#Indexes), but you can already add objects to
that container:

```ts
const joeBloggs = { id: 17, name: 'Joe Bloggs', nickname: 'joe', phone: '+972-99-555-6666' };
c.add(joeBloggs)
 .add({ id: 19, name: 'Ariel Shaqed (Scolnicov)', nickname: 'ariels', phone: '+972-99-666-5555', })
 .add({ id: 23, name: 'Joseph', nickname: 'joe', });
```

You can also delete, but it has to be the _same_ object you added:
```ts
c.delete(joeBloggs);
```

But let's keep Mr. Bloggs in there so we can look at indices...
```ts
c.add(joeBloggs);
```

## Indices

Add a few indices:
```ts
const byId = uniqueIndex({ id }: Contact => id, 'by id').on(c);
const byNickname = nonuniqueIndex({ nickname }: Contact => nickname, 'by nickname').on(c);
```

Or in JavaScript, just don't add types to the functions:
```js
const byId = uniqueIndex({ id } => id, 'by id').on(c);
const byNickname = nonuniqueIndex({ nickname } => nickname, 'by nickname').on(c);
```

Unique indices won't let you add the same element twice:
```ts
c.add({ id: 19, name: 'Impostor', nickname: 'ariels' });  // throws NonuniqueIndexError
```

(They also test for uniqueness if you add them to a container with
existing indexes, so `byNickname` above could _not_ be unique.)

Now you can look up elements:
```ts
byId.get(23);  // returns { id: 23, name: 'Joseph', nickname: 'joe' }
byNickname.get('joe');  // returns Set([{ id: 23, name: 'Joseph', nickname: 'joe' }, joeBloggs])
```

# Related projects

* [indexify](https://www.npmjs.com/package/indexify): A similar
  lightweight package, supports containers with multiple indexes.  API
  is not type-safe for TypeScript.  Less extensible.
* [bimap](https://www.npmjs.com/package/bimap): A specific container
  with 2 indices.  You could implement a bidirectional map using a
  multi-index container.
* [bim](https://www.npmjs.com/package/bim): Another bidirectional map.
* [mnemonist](https://www.npmjs.com/package/mnemonist): A variety of
  lower-level data structures.  Unfortunately does not include
  multi-indexed containers.
* [Boost
  multi_index](https://www.boost.org/doc/libs/1_72_0/libs/multi_index/doc/tutorial/index.html):
  the ultimate multi-indexed container, for C++; highly performant.
