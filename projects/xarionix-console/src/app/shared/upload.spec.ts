import { packageFileError } from './package-upload';
describe('package upload preflight', () => {
  it('accepts a non-empty bounded .xpkg', () =>
    expect(packageFileError({ name: 'module.xpkg', size: 100 }, 100)).toBeNull());
  it.each([
    { name: 'module.zip', size: 100 },
    { name: 'module.xpkg', size: 0 },
    { name: 'module.xpkg', size: 101 },
  ])('rejects invalid file metadata', (file) => expect(packageFileError(file, 100)).not.toBeNull());
});
