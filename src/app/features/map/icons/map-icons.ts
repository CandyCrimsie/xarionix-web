import house from './house.svg';
import network from './network-node.svg';
import cabinet from './cabinet.svg';
import splice from './splice.svg';
import pole from './pole.svg';
import chamber from './chamber.svg';
import equipment from './equipment.svg';
import note from './note.svg';
import router from './router.svg';
import wifi from './wifi.svg';
import radioTower from './radio-tower.svg';
import fiberBox from './fiber-box.svg';
import odf from './odf.svg';
import transition from './transition.svg';

export const APPROVED_MAP_ICONS = [
    { value: 'map-house', label: 'Дом', svg: house },
    { value: 'network-node', label: 'Узел связи', svg: network },
    { value: 'cabinet', label: 'Шкаф', svg: cabinet },
    { value: 'splice', label: 'Муфта', svg: splice },
    { value: 'pole', label: 'Опора', svg: pole },
    { value: 'chamber', label: 'Колодец', svg: chamber },
    { value: 'equipment', label: 'Оборудование', svg: equipment },
    { value: 'note', label: 'Заметка', svg: note },
    { value: 'fiber-box', label: 'Оптический бокс', svg: fiberBox },
    { value: 'odf', label: 'Оптический кросс', svg: odf },
    { value: 'transition', label: 'Точка перехода', svg: transition },
] as const;

export const TELECOM_MAP_ICONS = [
    { value: 'router', label: 'Маршрутизатор', svg: router },
    { value: 'wifi', label: 'Точка доступа Wi-Fi', svg: wifi },
    { value: 'radio-tower', label: 'Радиомачта', svg: radioTower },
] as const;
