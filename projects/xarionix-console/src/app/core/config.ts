import { Injectable } from '@angular/core';

export interface ConsoleConfig {
  development: boolean;
  coreApi: string;
  coreHealth: string;
  issuer: string;
  clientId: string;
  mfaAcr: string;
  maxPackageBytes: number;
}
export function validateConfig(value: unknown, origin: string): ConsoleConfig {
  if (!value || typeof value !== 'object') throw new Error('Не настроена Console');
  const v = value as Record<string, unknown>;
  const allowed = [
    'development',
    'coreApi',
    'coreHealth',
    'issuer',
    'clientId',
    'mfaAcr',
    'maxPackageBytes',
  ];
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new Error('Неизвестные параметры Console');
  if (
    typeof v['development'] !== 'boolean' ||
    typeof v['clientId'] !== 'string' ||
    !v['clientId'] ||
    typeof v['mfaAcr'] !== 'string'
  )
    throw new Error('Некорректная OIDC-конфигурация');
  const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  for (const key of ['coreApi', 'coreHealth', 'issuer']) {
    if (typeof v[key] !== 'string' || !v[key]) throw new Error('Не задан адрес сервиса');
    const url = new URL(v[key] as string, origin);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(v['development'] && loopback(url.hostname) && url.protocol === 'http:'))
    )
      throw new Error('Требуется HTTPS или явный loopback dev-режим');
    if (key !== 'issuer' && url.origin !== origin)
      throw new Error('Core должен использовать same-origin reverse proxy');
    if (key === 'coreApi' && !url.pathname.endsWith('/api/v1'))
      throw new Error('Некорректный путь Core API');
  }
  if (
    !Number.isSafeInteger(v['maxPackageBytes']) ||
    Number(v['maxPackageBytes']) < 1 ||
    Number(v['maxPackageBytes']) > 134217728
  )
    throw new Error('Некорректный лимит пакета');
  return v as unknown as ConsoleConfig;
}
@Injectable({ providedIn: 'root' })
export class Config {
  private current?: ConsoleConfig;
  get value(): ConsoleConfig {
    if (!this.current) throw new Error('Console не инициализирована');
    return this.current;
  }
  async load(): Promise<void> {
    const response = await fetch('/console-config.json', {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Не удалось загрузить конфигурацию Console');
    this.current = validateConfig(await response.json(), location.origin);
  }
}
