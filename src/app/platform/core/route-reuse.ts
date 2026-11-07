import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

@Injectable()
export class ConsoleRouteReuse extends BaseRouteReuseStrategy {
  override shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    current: ActivatedRouteSnapshot,
  ): boolean {
    // Detail stores own subscriptions. A different Core UUID must receive a new store.
    return (
      future.routeConfig === current.routeConfig &&
      JSON.stringify(future.params) === JSON.stringify(current.params)
    );
  }
}
