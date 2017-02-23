import {Component, Input, TemplateRef} from '@angular/core';

@Component({
    selector: 'grid-column',
    template: `A `
})
export class GridColumnComponent {
    @Input() public field: string;
    @Input() public header: string;
    @Input() public width: string;
    @Input() public resizable: string;
    @Input() public sortField: string;
    @Input() public template: TemplateRef<any>;
}

export class Column {
    field: string;
    header: string;
    width: string;
    sortField: string;
    sorting: boolean;
    resizable: boolean;
    template: TemplateRef<any>;

    constructor(component: any = {}) {
        this.field = component.field;
        this.header = component.header || "";
        this.sortField = component.sortField || "";
        this.resizable = component.resizable || true;
        this.template = component.template || null;

        if (component.width) {
            this.width = component.width;
        }
    }
}