import type { MapPointType } from './models/map.models';

export const ROUTE_NODE_OPTIONS = [
  {
    type: 'splice',
    icon: 'splice',
    label: 'Оптическая муфта',
    description: 'Соединить кабель в новом узле',
  },
  {
    type: 'fiber_box',
    icon: 'fiber-box',
    label: 'Оптический бокс',
    description: 'Распределение и оконцевание кабеля',
  },
  {
    type: 'odf',
    icon: 'odf',
    label: 'Оптический кросс',
    description: 'Оконцевание кабеля в кроссе',
  },
  {
    type: 'network_node',
    icon: 'network-node',
    label: 'Узел связи',
    description: 'Новый конец двух участков кабеля',
  },
  {
    type: 'cabinet',
    icon: 'cabinet',
    label: 'Шкаф',
    description: 'Соединение или размещение оборудования',
  },
] as const;
export const ROUTE_PASS_OPTIONS = [
  {
    type: 'chamber',
    icon: 'chamber',
    label: 'Кабельный колодец',
    description: 'Кабель проходит через объект без разрыва',
  },
  {
    type: 'pole',
    icon: 'pole',
    label: 'Опора',
    description: 'Подвес кабеля без разделения соединения',
  },
  {
    type: 'transition',
    icon: 'transition',
    label: 'Точка перехода',
    description: 'Смена способа прокладки без физического узла',
  },
] as const;
export const ROUTE_DUAL_TYPES: ReadonlySet<MapPointType> = new Set([
  'fiber_box',
  'network_node',
  'cabinet',
]);
