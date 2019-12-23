export type Scalar = string | number; // TypeScript can't handle symbol keys,
                                      // Microsoft/TypeScript#1863

type IndexReturnType<T, Unique extends boolean> = Unique extends true ? T : ReadonlySet<T>;

export abstract class IndexError extends Error {}

export class NonuniqueIndexError<T, K> extends IndexError {
  constructor(public value: T, public key: K, public indexName?: string) {
    super(`Nonunique key value ${key}${indexName ? `on index ${indexName}` : ''}`);
  }
}

// An index of type K on values T.
export interface Index<T, K, Unique extends boolean> {
  // Sets up to index container.
  on(container: Container<T>): ReadonlyMap<K, IndexReturnType<T, Unique>>;

  // Readonly access to container through this index.
  getAccess(): ReadonlyMap<K, IndexReturnType<T, Unique>>;
}

// Maintain index up-to-date with a container on values T.  For
// TypeScriptish reasons cannot know the type K, but all keys are
// opaque and round-tripped: implementor can rely on this.
export abstract class IndexKeeper<T> {
  public abstract computeKey(value: T): any;

  // Throws an instance of IndexError if value cannot be added to the
  // container.  On such failure that error is presented to the
  // caller.  On return, an immediate call to add(value) *must*
  // succeed.
  public prepareAdd(_key: any, _value: T): void {}

  // Indexes value.
  public abstract add(key: any, value: T): void;

  // Throws an Error (not necessarily an IndexError) if value cannot
  // be deleted from container.  For debugging only; this is not
  // guaranteed to be called.
  public prepareDelete(_key: any, _value: T): void {}

  // Deletes value.
  public abstract delete(key: any, value: T): void;
}

class UniqueIndex<T, K extends string | number> extends IndexKeeper<T> implements Index<T, K, true> {
  protected access = new Map<K, T>();

  constructor(public computeKey: (value: T) => K, public name?: string) {
    super();
  }

  public on(c: Container<T>) {
    c.use(this);
    return this.getAccess();
  }

  public getAccess(): ReadonlyMap<K, T> { return this.access; }

  public prepareAdd(key: K, value: T): void {
    if (this.access.has(key)) throw new NonuniqueIndexError(value, key, this.name);
  }

  public add(key: K, value: T): void {
    this.access.set(key, value);
  }

  public prepareDelete(key: K, value: T): void {
    if (!this.access.has(key)) throw new Error(`Missing key ${key} for ${value}`);
  }

  public delete(key: K): void {
    this.access.delete(key);
  }
}

export function uniqueIndex<T, K extends string | number>(
  computeKey: (value: T) => K, name?: string
): Index<T, K, true> {
  return new UniqueIndex(computeKey, name);
}

class NonuniqueIndex<T, K extends string | number> extends IndexKeeper<T> implements Index<T, K, false> {
  protected access = new Map<K, Set<T>>();

  constructor(public computeKey: (value: T) => K, public name?: string) {
    super();
  }

  public on(c: Container<T>) {
    c.use(this);
    return this.getAccess();
  }

  public getAccess(): ReadonlyMap<K, ReadonlySet<T>> { return this.access; }

  public add(key: K, value: T): void {
    let values = this.access.get(key);
    if (!values) this.access.set(key, values = new Set());
    values.add(value);
  }

  public prepareDelete(key: K, value: T): void {
    const values = this.access.get(key);
    if (!values) throw new Error(`Missing key ${key} for ${value}`);
    if (!values.has(value)) throw new Error(`Missing ${value} in elements for ${key}`);
  }

  public delete(key: K, value: T): void {
    const values = this.access.get(key)!;
    values.delete(value);
    if (values.size === 0) this.access.delete(key);
  }
}

export function nonuniqueIndex<T, K extends string | number>(
  computeKey: (value: T) => K,
  name?: string,
): Index<T, K, false> {
  return new NonuniqueIndex(computeKey, name);
}

export class Container<T> {
  private readonly objects = new Set<T>();
  private readonly index: Array<IndexKeeper<T>> = [];

  // Starts maintaining index.
  public use(index: IndexKeeper<T>): void {
    for (const value of this.objects.keys()) {
      const key = index.computeKey(value);
      index.prepareAdd(key, value);
      index.add(key, value);
    }
    // Now index is consistent with objects, safe to add to indices.
    this.index.push(index);
  }

  /**
   * Add value to the container and all its indices.
   */
  public add(value: T): void {
    const key = this.index.map((index) => index.computeKey(value));
    for (let i = 0; i < this.index.length; i++) {
      this.index[i].prepareAdd(key[i], value);
    }
    for (let i = 0; i < this.index.length; i++) {
      this.index[i].add(key[i], value);
    }
    this.objects.add(value);
  }

  /**
   * Remove value from the container and all its indices.
   */
  public delete(value: T) {
    const key = this.index.map((index) => index.computeKey(value));
    for (let i = 0; i < this.index.length; i++) {
      this.index[i].prepareDelete(key[i], value);
    }
    for (let i = 0; i < this.index.length; i++) {
      this.index[i].delete(key[i], value);
    }
    this.objects.delete(value);
  }
}
