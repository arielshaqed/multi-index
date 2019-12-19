import * as R from 'ramda';

export type Scalar = string | number; // TypeScript can't handle symbol keys,
                                      // Microsoft/TypeScript#1863

export class NonuniqueIndexError extends Error {
  constructor(public element: any, public key: Scalar, public indexName: string) {
    super(`Nonunique key value ${key} on index ${indexName}`);
  }
}

export type ScalarTypeName = 'string' | 'number';

interface NumberIndexType<T> {
  getter: (t: T) => number;
  type: 'number';
}

interface StringIndexType<T> {
  getter: (t: T) => string;
  type?: 'string';        // (default).
}

export type IndexType<T> = {
  // TODO(ariels): Add ordered, indexed, etc. index types
  unique?: boolean;
} & (NumberIndexType<T> | StringIndexType<T>);

type UniqueMap<T> = Map<Scalar, T>;
type MultiMap<T> = Map<Scalar, Set<T>>;

interface Access<T> {
  access: { u?: UniqueMap<T>, m?: MultiMap<T> };
}

type Index<T> = IndexType<T> & Access<T>;

export class MultiIndex<T> {
  private readonly objects = new Set<any>(); // TODO(ariels): for iteration
  private readonly index: Map<string, Index<T>>;
  public readonly access = {
    // Keys: s/n string/number, 1/9 unique/nonunique
    s1: new Map<string, Map<string, T>>(),
    s9: new Map<string, Map<string, Set<T>>>(),
    n1: new Map<string, Map<number, T>>(),
    n9: new Map<string, Map<number, Set<T>>>(),
  };

  constructor(indexTypes: { [ik: string]: IndexType<T> }) {
    this.index = new Map(Object.entries(
      R.map(
        (it) => ({
          ...it,
          type: it.type || 'string',
          access: it.unique ? { u: new Map() } : { m: new Map() },
        }),
        indexTypes,
      )));
    for (const [k, i] of this.index.entries()) {
      switch (i.type) {
      case 'string': case undefined:
        if (i.unique) {
          this.access.s1.set(k, i.access.u! as Map<string, T>);
        } else {
          this.access.s9.set(k, i.access.m! as Map<string, Set<T>>);
        }
        break;
      case 'number':
        if (i.unique) {
          this.access.n1.set(k, i.access.u! as Map<number, T>);
        } else {
          this.access.n9.set(k, i.access.m! as Map<number, Set<T>>);
        }
      }
    }
  }

  protected forEachIndex(fn: (index: Index<T>, ik: string) => any) {
    this.index.forEach(
      (index, ik) => {
        if (typeof ik === 'number') return;
        return fn(index, ik);
      },
    );
  }

  protected prepareToUpdate(o: T) {
    this.forEachIndex(
      (index, ik) => {
        const k = index.getter(o);
        if (index.unique && index.access.u!.has(k)) {
          throw new NonuniqueIndexError(o, k, ik);
        }
        if (!index.unique && !index.access.m!.has(k)) index.access.m!.set(k, new Set());
      }
    );
  }

  // TODO(ariels): Allow disabling this test.
  protected checkConsistentIndices(o: T) {
    this.forEachIndex(
      (index, ik) => {
        if (typeof ik === 'number') return;
        const k = index.getter(o);
        if (index.unique) {
          if (!index.access.u!.has(k)) {
            throw new Error(`Internal: No key ${k} found on index ${ik}`);
          }
          if (!Object.is(index.access.u!.get(k), o)) {
            throw new Error(`Internal: Mismatched objects for key ${ik} on index ${ik}`);
          }
        } else {
          if (!(index.access.m!.has(k))) {
            throw new Error(`Internal: No key ${k} found on index ${ik}`);
          }
          if (!index.access.m!.get(k)!.has(o)) {
            throw new Error(`Internal: Mismatched objects for key ${ik} on index ${ik}`);
          }
        }
      }
    );
  }

  /**
   * Adds o to the index.  Throws if an object with the same index as
   * o already appears in a unique field.
   */
  public add(o: T) {
    this.prepareToUpdate(o);

    // Now o can safely be added to all indices (no overwrite is
    // possible!)
    this.forEachIndex((index) => {
      const k = index.getter(o);
      if (index.unique) {
        index.access.u!.set(k, o);
        return;
      }
      index.access.m!.get(k)?.add(o);
    });
    
    this.objects.add(o);
  }

  /**
   * Remove o from the index.
   */
  public delete(o: T) {
    this.checkConsistentIndices(o);

    this.forEachIndex((index) => {
      const k = index.getter(o);
      if (index.unique) {
        index.access.u!.delete(k);
        return;
      }
      const s = index.access.m!.get(k);
      s!.delete(o);
      if (s!.size === 0) index.access.m!.delete(k);
    });
    this.objects.delete(o);
  }

  public by(ik: string, unique: true, typeName: 'string'): ReadonlyMap<string, T>;
  public by(ik: string, unique: false, typeName: 'string'): ReadonlyMap<string, ReadonlySet<T>>;
  public by(ik: string, unique: true, typeName: 'number'): ReadonlyMap<number, T>;
  public by(ik: string, unique: false, typeName: 'number'): ReadonlyMap<number, ReadonlySet<T>>;

  // Type-unsafe, but requires the least specification.
  public by(
    ik: string,
    unique?: boolean,
    typeName?: ScalarTypeName,
  ): ReadonlyMap<Scalar, T> | ReadonlyMap<Scalar, ReadonlySet<T>>;

  public by(ik: string, unique?: boolean, typeName?: ScalarTypeName): any {
    if (!this.index.has(ik)) throw new Error(`Unknown index ${ik}`);
    const index = this.index.get(ik)!;
    if (unique !== undefined && unique !== index.unique) {
      throw new Error(`Expected ${index.unique ? '' : 'non-'}-unique index ${ik}`);
    }
    if (typeName !== undefined && typeName !== index.type) {
      throw new Error(`Expected ${typeName} index ${ik}`);
    }
    return index!.unique ? index!.access.u! : index!.access.m!;
  }
}
