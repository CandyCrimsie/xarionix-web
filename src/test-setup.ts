if (
    typeof window !== 'undefined'
    && typeof window.matchMedia
    !== 'function'
) {
    Object.defineProperty(
        window,
        'matchMedia',
        {
            configurable:
                true,

            writable:
                true,

            value:
                (
                    query:
                        string,
                ): MediaQueryList =>
                    ({
                        matches:
                            false,

                        media:
                            query,

                        onchange:
                            null,

                        addListener:
                            () => {
                                // Legacy API.
                            },

                        removeListener:
                            () => {
                                // Legacy API.
                            },

                        addEventListener:
                            () => {
                                // No-op for jsdom tests.
                            },

                        removeEventListener:
                            () => {
                                // No-op for jsdom tests.
                            },

                        dispatchEvent:
                            () =>
                                false,
                    }) as MediaQueryList,
        },
    );
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverMock implements ResizeObserver {
        observe(): void {
            // No layout observation is needed in jsdom tests.
        }

        unobserve(): void {
            // No layout observation is needed in jsdom tests.
        }

        disconnect(): void {
            // No layout observation is needed in jsdom tests.
        }
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: ResizeObserverMock,
    });
}

if (
    typeof Element !== 'undefined'
    && typeof Element.prototype.scrollIntoView !== 'function'
) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: () => {
            // jsdom does not calculate scroll positions.
        },
    });
}
