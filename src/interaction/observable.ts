type Listener<T> = (value: T) => void;

export class Observable<T> {
  private value: T;
  private listeners = new Set<Listener<T>>();

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }

  set(value: T) {
    if (Object.is(value, this.value)) {
      return;
    }
    this.value = value;
    this.listeners.forEach((listener) => listener(value));
  }

  onChange(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
