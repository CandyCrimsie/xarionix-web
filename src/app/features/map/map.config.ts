export const MAP_SOURCE_ID = 'yandex-map';
export const MAP_BUILDINGS_SOURCE_ID = 'xarionix-buildings';

// Neutral overview used only until an address object with coordinates is
// selected. Business locations are never hardcoded here.
export const DEFAULT_MAP_CENTER: [number, number] = [90, 60];
export const DEFAULT_MAP_ZOOM = 2;
export const MAP_VIEWPORT_DEBOUNCE_MS = 300;
export const MAP_SESSION_REFRESH_MARGIN_SECONDS = 60;

export const YANDEX_MAPS_URL = 'https://yandex.ru/maps/';
export const YANDEX_MAPS_TERMS_URL = 'https://yandex.ru/legal/maps_termsofuse/';
// Unmodified Russian logo from the official Yandex Tiles API logo pack.
export const YANDEX_LOGO_URL = '/yandex-logo-ru.svg';
