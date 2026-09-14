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