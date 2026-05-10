declare module 'bun:test' {
    export function describe(name: string, fn: () => void): void;
    export function it(name: string, fn: (done?: any) => unknown): void;

    export function expect<T = any>(actual: T): Expectation<T>;

    interface Expectation<T = any> {
        toBe(expected: any): void;
        toEqual(expected: any): void;
        toThrow(): void;
        toBeTruthy(): void;
        toBeFalsy(): void;
        not: ExpectationNegated;
    }

    interface ExpectationNegated {
        toBe(expected: any): void;
        toEqual(expected: any): void;
    }
}

declare module 'bun' {
    // Minimal placeholder if other bun modules are imported elsewhere
    export = globalThis;
}
