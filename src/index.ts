import * as R from 'ramda';

export type Scalar = string | number; // TypeScript can't handle symbol keys,
                                      // Microsoft/TypeScript#1863

export class NonuniqueIndexError extends Error {
  constructor(public element: any, public key: Scalar, public indexName: string) {
    super(`Nonunique key value ${key} on index ${indexName}`);
  }
}

export interface IndexType<T> {
  // TODO(ariels): Add ordered, indexed, etc. index types
  unique?: boolean;
  getter: (t: T) => Scalar;
}

type UniqueMap<T> = Map<Scalar, T>;
type MultiMap<T> = Map<Scalar, Set<T>>;

interface Index<T> extends IndexType<T> {
  access: { u?: UniqueMap<T>, m?: MultiMap<T> };
}

export class MultiIndex<T> {
  private readonly objects = new Set<any>();
  private readonly index: Map<string, Index<T>>;

  constructor(indexTypes: { [ik: string]: IndexType<T> }) {
    this.index = new Map(Object.entries(
      R.map(
        (it) => ({ ...it, access: it.unique ? { u: new Map() } : { m: new Map() } }),
        indexTypes,
      )));
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

  // TODO(ariels): improve type-safety!  (Probably requires a harder
  //     type for the object, meaning a factory function etc.
  public by(ik: string): ReadonlyMap<Scalar, Readonly<T>> | ReadonlyMap<Scalar, Readonly<Set<Readonly<T>>>> {
    if (!this.index.has(ik)) throw new Error(`Unknown index ${ik}`);
    const index = this.index.get(ik);
    return index!.unique ? index!.access.u! : index!.access.m!;
  }
}
