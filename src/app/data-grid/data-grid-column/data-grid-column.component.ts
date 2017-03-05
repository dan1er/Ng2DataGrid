import {Component, Input, TemplateRef} from "@angular/core";

@Component({
    selector: "grid-column",
    template: ``
})
export class GridColumnComponent {
    @Input() public field: string;
    @Input() public header: string;
    @Input() public width: string;
    @Input() public resizable: string;
    @Input() public sortField: string;
    @Input() public visible: boolean;
    @Input() public template: TemplateRef<any>;
}

export class Column {
    field: string;
    header: string;
    width: string;
    sortField: string;
    visible: boolean;
    sorting: boolean;
    resizable: boolean;
    template: TemplateRef<any>;

    constructor(component: any = {}) {
        this.field = component.field;
        this.header = component.header || "";
        this.sortField = component.sortField || "";
        this.visible = component.visible || component.visible === undefined ? true : false;
        this.resizable = component.resizable || true;
        this.template = component.template || null;

        if (component.width) {
            this.width = component.width;
        }
    }
}
