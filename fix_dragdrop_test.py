#!/usr/bin/env python3
"""Update obsolete address DnD ghost regression test for non-overlay target highlighting.

Run from xarionix-web repo root:
  python3 ./fix_dragdrop_test.py --check
  python3 ./fix_dragdrop_test.py
"""
from pathlib import Path
import argparse
import shutil
import sys

OLD_NAME = "should show a ghost only for the active drop target and reveal drag handles on hover"
NEW_NAME = "should highlight only the active drop target without an overlapping ghost and reveal drag handles on hover"
OLD_EXPECT = '''        const ghosts = fixture.nativeElement.querySelectorAll('[data-testid^="drop-ghost-"]');
        expect(ghosts).toHaveLength(1);
        expect(ghosts[0].getAttribute('data-testid')).toBe(`drop-ghost-${targetStreet.id}`);
        expect(ghosts[0].textContent).toContain('Переместить в ул. Гагарина');'''
NEW_EXPECT = '''        const activeTargets = fixture.nativeElement.querySelectorAll(
            '.address-drop-zone.address-drop-target-active',
        );
        expect(activeTargets).toHaveLength(1);
        expect(activeTargets[0].querySelector(
            `[data-testid="address-object-${targetStreet.id}"]`,
        )).not.toBeNull();
        expect(fixture.nativeElement.querySelector(
            '[data-testid^="drop-ghost-"]',
        )).toBeNull();'''
OLD_CLEAR = '''        component.clearTreeDropTarget(target.key);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid^="drop-ghost-"]')).toBeNull();'''
NEW_CLEAR = '''        component.clearTreeDropTarget(target.key);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll(
            '.address-drop-zone.address-drop-target-active',
        )).toHaveLength(0);'''

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('repo', nargs='?', type=Path, default=Path.cwd())
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    root = args.repo.resolve()
    f = root / 'src/app/pages/addresses/addresses.spec.ts'
    if not f.exists():
        ap.error(f'File not found: {f}')
    src = f.read_text(encoding='utf-8-sig')
    if NEW_NAME in src:
        print('Already updated; no changes needed.')
        return 0
    for key, text in [('test name', OLD_NAME), ('ghost assertion', OLD_EXPECT), ('cleanup assertion', OLD_CLEAR)]:
        if src.count(text) != 1:
            raise ValueError(f'Expected one {key}; found {src.count(text)}. File differs; no changes made.')
    patched = src.replace(OLD_NAME, NEW_NAME, 1).replace(OLD_EXPECT, NEW_EXPECT, 1).replace(OLD_CLEAR, NEW_CLEAR, 1)
    if args.check:
        print('OK: matching obsolete test found; ready to update.')
        return 0
    backup = f.with_name(f.name + '.before-dnd-test-fix.bak')
    if not backup.exists():
        shutil.copy2(f, backup)
    f.write_text(patched, encoding='utf-8', newline='\n')
    print('Updated:', f)
    print('Backup:', backup)
    print('Run: npx ng test --include="src/app/pages/addresses/addresses.spec.ts" --watch=false')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError) as exc:
        print('ERROR:', exc, file=sys.stderr)
        sys.exit(1)
