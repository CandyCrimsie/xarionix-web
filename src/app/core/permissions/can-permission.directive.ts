import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';

import {
    PermissionCode,
    PermissionScope,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';


@Directive({
    selector: '[appCan]',
})
export class CanPermissionDirective {
    readonly appCan =
        input.required<PermissionCode>();

    readonly appCanScope =
        input<PermissionScope | undefined>(
            undefined,
        );

    private readonly permissions =
        inject(PermissionService);

    private readonly template =
        inject(
            TemplateRef<unknown>,
        );

    private readonly viewContainer =
        inject(ViewContainerRef);

    private rendered = false;


    constructor() {
        effect(() => {
            const allowed =
                this.permissions.can(
                    this.appCan(),
                    this.appCanScope(),
                );

            if (allowed) {
                this.render();

                return;
            }

            this.clear();
        });
    }


    private render(): void {
        if (this.rendered) {
            return;
        }

        this.viewContainer
            .createEmbeddedView(
                this.template,
            );

        this.rendered = true;
    }


    private clear(): void {
        if (!this.rendered) {
            return;
        }

        this.viewContainer.clear();

        this.rendered = false;
    }
}