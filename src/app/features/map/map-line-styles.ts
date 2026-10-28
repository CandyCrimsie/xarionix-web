import type { InstallationMethod } from './models/map.models';

// MapLibre dash units are multiples of the line width. SVG previews use the
// very same values multiplied by their sample's actual stroke width.
export const CONNECTION_COLORS = { fiber: '#4F9DD9', utp: '#D6A66B' } as const;
export const CONNECTION_SELECTED_COLOR = '#EAF4FF';
export const CONNECTION_STATUSES = [
  { value: 'planned', label: 'Планируется', opacity: 0.5, width: 2.7 },
  { value: 'construction', label: 'Строится', opacity: 0.8, width: 3 },
  { value: 'active', label: 'Активно', opacity: 1, width: 2.7 },
  { value: 'inactive', label: 'Неактивно', opacity: 0.28, width: 2.7 },
] as const;
export const INSTALLATION_STYLES: readonly {
  value: InstallationMethod;
  label: string;
  dash: number[] | null;
  width: number;
}[] = [
  { value: 'unknown', label: 'Не указан', dash: null, width: 2.7 },
  { value: 'aerial', label: 'Воздушная', dash: null, width: 2.7 },
  { value: 'duct', label: 'В кабельной канализации', dash: [3, 1.8], width: 2.7 },
  { value: 'direct_buried', label: 'Непосредственно в грунте', dash: [0.35, 1.8], width: 2.7 },
  { value: 'facade', label: 'По фасаду здания', dash: [5, 1.5, 0.5, 1.5], width: 2.7 },
  { value: 'indoor', label: 'Внутри здания', dash: null, width: 1.8 },
];
export const installationLabel = (value: InstallationMethod) =>
  INSTALLATION_STYLES.find((style) => style.value === value)?.label ?? '';
export const svgDash = (style: { dash: readonly number[] | null; width: number }) =>
  style.dash?.map((length) => Number((length * style.width).toFixed(4))).join(' ') ?? null;
export function installationMethods(
  vertices: unknown[],
  methods?: InstallationMethod[],
): InstallationMethod[] {
  return methods?.length === vertices.length + 1
    ? [...methods]
    : Array<InstallationMethod>(vertices.length + 1).fill('unknown');
}

/** Deleting a boundary with different methods requires an explicit choice. */
export function removeRouteVertex<T>(
  vertices: T[],
  methods: InstallationMethod[],
  index: number,
  mergedMethod?: InstallationMethod,
) {
  const before = methods[index],
    after = methods[index + 1];
  if (before !== after && !mergedMethod) return null;
  return {
    vertices: vertices.filter((_, i) => i !== index),
    installation_methods: [
      ...methods.slice(0, index),
      mergedMethod ?? before,
      ...methods.slice(index + 2),
    ],
  };
}
