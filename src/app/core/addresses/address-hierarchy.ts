import type {
    AddressObject,
    AddressType,
    AddressTypeCategory,
} from './address.models';


export const ROOT_ADDRESS_TYPE_CATEGORIES: readonly AddressTypeCategory[] = [
    'country',
    'region',
    'locality',
];


const SYSTEM_CHILD_CATEGORIES: Readonly<Record<
    string,
    readonly AddressTypeCategory[]
>> = {
    country: ['region', 'locality'],
    region: ['area', 'locality'],
    city: ['area', 'territory', 'thoroughfare'],
    settlement: ['area', 'territory', 'thoroughfare'],
    village: ['area', 'territory', 'thoroughfare'],
    district: ['area', 'territory', 'thoroughfare'],
    municipal_district: ['area', 'territory', 'thoroughfare'],
    microdistrict: ['territory', 'thoroughfare'],
    quarter: ['territory', 'thoroughfare'],
    snt_territory: ['territory', 'thoroughfare'],
    tsn_territory: ['territory', 'thoroughfare'],
    dnt_territory: ['territory', 'thoroughfare'],
    industrial_zone: ['territory', 'thoroughfare'],
    territory: ['territory', 'thoroughfare'],
    street: [],
    avenue: [],
    lane: [],
};


const CUSTOM_CHILD_CATEGORIES: Readonly<Record<
    AddressTypeCategory,
    readonly AddressTypeCategory[]
>> = {
    country: ['region', 'locality'],
    region: ['area', 'locality'],
    locality: ['area', 'territory', 'thoroughfare'],
    area: ['area', 'territory', 'thoroughfare'],
    territory: ['territory', 'thoroughfare'],
    thoroughfare: [],
};


export const ADDRESS_TYPE_CATEGORY_LABELS: Readonly<Record<
    AddressTypeCategory,
    string
>> = {
    country: 'Страна',
    region: 'Регион',
    locality: 'Населённый пункт',
    area: 'Район или округ',
    territory: 'Планировочная структура или территория',
    thoroughfare: 'Улица, проспект или переулок',
};


export const ADDRESS_TYPE_CATEGORIES: readonly AddressTypeCategory[] = [
    'country',
    'region',
    'locality',
    'area',
    'territory',
    'thoroughfare',
];


export function allowedChildCategories(
    parent: Pick<AddressObject, 'type_code' | 'type_category'>,
): readonly AddressTypeCategory[] {
    return SYSTEM_CHILD_CATEGORIES[parent.type_code]
        ?? CUSTOM_CHILD_CATEGORIES[parent.type_category];
}


export function filterAllowedAddressTypes(
    types: AddressType[],
    parent: Pick<AddressObject, 'type_code' | 'type_category'> | null,
): AddressType[] {
    const categories = parent
        ? allowedChildCategories(parent)
        : ROOT_ADDRESS_TYPE_CATEGORIES;
    return types.filter(type => categories.includes(type.category));
}


export function addressObjectAllowsBuildings(
    addressObject: Pick<AddressObject, 'type_category'>,
): boolean {
    return addressObject.type_category === 'territory'
        || addressObject.type_category === 'thoroughfare';
}


export function addressObjectDisplayName(
    addressObject: Pick<AddressObject, 'name' | 'type_short_name'>,
): string {
    return addressObject.type_short_name
        ? `${addressObject.type_short_name} ${addressObject.name}`
        : addressObject.name;
}
