export interface CoordinatePair {
    latitude: string;
    longitude: string;
}


const COORDINATE_SCALAR = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const DOT_DECIMAL_SCALAR = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const COMMA_PAIR = new RegExp(
    `^(${DOT_DECIMAL_SCALAR}),\\s*(${DOT_DECIMAL_SCALAR})$`,
);


export function normalizeCoordinateScalar(value: string): string | null {
    const normalized = value.trim();
    if (!COORDINATE_SCALAR.test(normalized)) {
        return null;
    }
    return normalized.replace(',', '.');
}


export function parseCoordinatePair(value: string): CoordinatePair | null {
    const normalized = value.trim();
    let parts: string[] | null = null;

    if (/[;\r\n]/.test(normalized)) {
        parts = normalized.split(/[;\r\n]+/).map(item => item.trim());
    } else {
        const commaPair = COMMA_PAIR.exec(normalized);
        if (commaPair) {
            parts = [commaPair[1], commaPair[2]];
        } else {
            const whitespaceParts = normalized.split(/\s+/);
            if (whitespaceParts.length === 2) {
                parts = whitespaceParts;
            }
        }
    }

    if (!parts || parts.length !== 2) {
        return null;
    }
    const latitude = normalizeCoordinateScalar(parts[0]);
    const longitude = normalizeCoordinateScalar(parts[1]);
    if (latitude === null || longitude === null) {
        return null;
    }
    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    if (
        !Number.isFinite(latitudeValue)
        || !Number.isFinite(longitudeValue)
        || latitudeValue < -90
        || latitudeValue > 90
        || longitudeValue < -180
        || longitudeValue > 180
    ) {
        return null;
    }
    return { latitude, longitude };
}
