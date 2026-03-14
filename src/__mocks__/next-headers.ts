// Mock for "next/headers" — provides a basic cookies() stub for tests
export function cookies() {
    const store = new Map<string, string>();
    return {
        get: (name: string) => store.has(name) ? { name, value: store.get(name)! } : undefined,
        set: (name: string, value: string) => { store.set(name, value); },
        delete: (name: string) => { store.delete(name); },
        getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
        has: (name: string) => store.has(name),
    };
}

export function headers() {
    return new Headers();
}
