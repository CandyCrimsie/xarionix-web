// There is no runtime loader. A module entry can only target a reviewed, compiled implementation.
export interface ModuleNavigation {
  moduleId: string;
  label: string;
  icon: 'package' | 'activity' | 'server';
  path: string;
  permission: string;
}
const icons = new Set(['package', 'activity', 'server']);
export function moduleNavigation(
  value: unknown,
  compiled: ReadonlyMap<string, string>,
  permissions: ReadonlySet<string>,
): ModuleNavigation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['moduleId', 'label', 'icon', 'permission'].includes(key)))
    return null;
  if (
    typeof v['moduleId'] !== 'string' ||
    typeof v['label'] !== 'string' ||
    !v['label'].trim() ||
    v['label'].length > 80 ||
    typeof v['icon'] !== 'string' ||
    !icons.has(v['icon']) ||
    typeof v['permission'] !== 'string' ||
    !permissions.has(v['permission'])
  )
    return null;
  const path = compiled.get(v['moduleId']);
  if (!path || !/^\/modules\/[a-z][a-z0-9-]{1,62}$/.test(path)) return null;
  return {
    moduleId: v['moduleId'],
    label: v['label'],
    icon: v['icon'] as ModuleNavigation['icon'],
    path,
    permission: v['permission'],
  };
}
