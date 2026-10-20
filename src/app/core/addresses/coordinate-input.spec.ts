import { describe, expect, it } from 'vitest';

import {
    normalizeCoordinateScalar,
    parseCoordinatePair,
} from './coordinate-input';


describe('coordinate input', () => {
    it('parses comma-separated dot-decimal pairs with or without spaces', () => {
        expect(parseCoordinatePair('55.577276, 38.245099')).toEqual({
            latitude: '55.577276',
            longitude: '38.245099',
        });
        expect(parseCoordinatePair('55.577276,38.245099')).toEqual({
            latitude: '55.577276',
            longitude: '38.245099',
        });
    });


    it('parses signed decimal-comma pairs with an unambiguous separator', () => {
        expect(parseCoordinatePair('-55,577276; -38,245099')).toEqual({
            latitude: '-55.577276',
            longitude: '-38.245099',
        });
    });


    it('normalizes a single decimal comma without treating it as a pair', () => {
        expect(normalizeCoordinateScalar('55,577276')).toBe('55.577276');
        expect(parseCoordinatePair('55,577276')).toBeNull();
    });


    it('rejects ambiguous and out-of-range coordinate pairs', () => {
        expect(parseCoordinatePair('55,577276, 38,245099')).toBeNull();
        expect(parseCoordinatePair('91, 38')).toBeNull();
        expect(parseCoordinatePair('55, 181')).toBeNull();
    });
});
