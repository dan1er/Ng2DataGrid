import {TemplateRef} from "@angular/core";

export type SortDirection = "ascending" | "descending";

export class RowData {
    identifier?: string;
    selected?: boolean;
    expanded?: boolean;
    data?: any;
    relocated?: boolean;
    rowHeight?: number;
}

export interface RowMarkData {
    color?: string;
    letter?: string;
}

export interface SortChangedEvent {
    sortField: string;
    sortDirection: SortDirection;
}

export interface LoadNextPageEvent {
    page: number;
    from: number;
    rowsPerPage: number;
    sortField?: string;
    sortDirection?: string;
}

export interface RowDragEndedEvent {
    currentIndex: number;
    nextIndex: number;
}

export interface ISelectionChangedEvent {
    allSelected?: boolean;
    clearSelection?: boolean;
    selected?: any[]|Map<string, boolean>;
}

export interface RowHeightChangedEvent {
    previousValue: number;
    currentValue: number;
    rowData: RowData;
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
        this.visible = component.visible || component.visible === undefined;
        this.resizable = component.resizable || true;
        this.template = component.template || null;

        if (component.width) {
            this.width = component.width;
        }
    }
}
