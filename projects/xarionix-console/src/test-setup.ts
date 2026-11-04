// DOM-only platform shims. No ERP services, providers or storage namespaces.
class ConsoleTestStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new ConsoleTestStorage(),
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: new ConsoleTestStorage(),
});
if (!globalThis.matchMedia)
  globalThis.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
    }) as MediaQueryList;
if (!globalThis.ResizeObserver)
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
