import {
    Component, OnInit, Input, ContentChildren, QueryList,
    AfterViewInit, AfterContentInit, ElementRef, TemplateRef,
    ChangeDetectorRef, HostListener, EventEmitter, Output, NgZone, OnChanges, SimpleChanges
} from '@angular/core';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/takeUntil';
import 'rxjs/add/operator/switchMap';
import {GridColumnComponent, Column} from '../data-grid-column/data-grid-column.component';
import {filter} from "lodash";
import {fromEvent} from "rxjs/observable/fromEvent";
import {random} from "lodash";
import "rxjs/operator/debounceTime";

type selectionMode = "single" | "multiple";

@Component({
    selector: 'app-data-grid',
    template: `
            <div class="data-table">
                <div class="data-table-header">
                    <div *ngIf="showSelectionInput" 
                         class="column column-selection">
                         <data-grid-checkbox *ngIf="selectionMode === 'multiple'"
                                             [value]="allSelected"
                                             (onChanged)="onSelectAllChanged($event)">
                         </data-grid-checkbox>
                    </div>
                    <div class="column column_{{i}}"
                         [ngStyle]="{flex: !column.width ? 1: '', width: column.width}"
                         *ngFor="let column of columns; let i = index; let isLast = last;"
                         (click)="onColumnHeaderClicked(column)">
                        <div class="column-content">{{column.header}}</div>
                        <template [ngIf]="(column.sortField && sorting && column.sortField === sortField) === true">
                            <div class="column-sortable"
                                 [class.ascending]="sortingAscending"
                                 [class.descending]="!sortingAscending">
                            </div>
                        </template>
                        <template [ngIf]="(!isLast && column.resizable) === true">
                            <div class="column-divider"
                                 [attr.column_index]="i"
                                 (mousedown)="onResize($event)">
                            </div>
                        </template>
                    </div>
                    <div *ngIf="expandTemplate" 
                         class="column column-expand">
                    </div>
                </div>      
                <div class="data-table-body">
                    <template ngFor let-row [ngForOf]="innerData" [ngForTrackBy]="trackByIdentifier">
                        <data-grid-row [columns]="columns" 
                                       [rowData]="row" 
                                       [expandTemplate]="expandTemplate"
                                       [showSelectionInput]="showSelectionInput"
                                       [selectionMode]="selectionMode"
                                       [rowMarkField]="rowMarkField"
                                       (onRowSelectionChanged)="onRowSelectionChanged($event)">
                        </data-grid-row>
                    </template>
                    <data-grid-spinner *ngIf="isLoading"></data-grid-spinner>
                </div>
                <div *ngIf="false" class="data-table-footer">
                </div>
            </div>
    `,
    styleUrls: ['data-grid.component.less']
})
export class DataGridComponent implements OnInit, OnChanges, AfterViewInit, AfterContentInit {
    @Input() public readonly identifierField: string;
    @Input() public readonly data: any[];
    @Input() public selected: any[];
    @Input() public readonly rowsPerPage: number = 50;
    @Input() public readonly selectionMode: selectionMode = "single";
    @Input() public readonly showSelectionInput: boolean = true;
    @Input() public readonly expandTemplate: TemplateRef<any>;
    @Input() public readonly rowMarkField: string;
    @Output() public onAllSelected: EventEmitter<any> = new EventEmitter();
    @Output() public onSelectionChanged: EventEmitter<any[]> = new EventEmitter();
    @Output() public onSortChanged: EventEmitter<SortChangedEvent> = new EventEmitter();
    @Output() public onLoadNextPage: EventEmitter<LoadNextPageEvent> = new EventEmitter();
    @ContentChildren(GridColumnComponent) public gridColumns: QueryList<GridColumnComponent>;

    public sorting: boolean = false;
    public sortingAscending: boolean = true;
    public sortField: string;

    public resizing: boolean;
    public resizedElement: HTMLElement;
    public resizedColumnIndex: string;

    private innerData: RowData[];
    private columns: Column[];
    private currentPage: number = 0;
    private allSelected: boolean;
    private isLoading: boolean;

    constructor(private element: ElementRef,
                private changeDetector: ChangeDetectorRef,
                private ngZone: NgZone) {
    }

    public ngOnInit(): void {
        this.isLoading = true;

        this.subscribeToBodyScrolling();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes["data"]) {
            this.processData(changes["data"].currentValue);
        }

        if (changes["selected"]) {
            this.markSelected(changes["selected"].currentValue);
        }
    }

    public ngAfterViewInit(): void {
        this.initializeColumns();
    }

    public ngAfterContentInit(): void {
    }

    public get selectedCount(): number {
        return filter(this.innerData, <any>{ selected: true }).length;
    }

    public get allRowsSelected(): boolean {
        return !filter(this.innerData, (row: any) => !row.selected).length;
    }

    public get selectedRows(): any[] {
        return filter(this.innerData, <any>{ selected: true }).map((row: RowData) => row.data);
    }

    public onSelectAllChanged($event: boolean): void {
        this.allSelected = $event;

        this.innerData.forEach((item: RowData) => item.selected = this.allSelected);

        this.selected = this.selectedRows;

        this.onAllSelected.emit();
    }

    public onRowSelectionChanged(rowData: RowData): void {
        if (this.selectionMode === "single") {
            this.innerData.forEach((item: any) => {
                if (item.identifier !== rowData.identifier) {
                    item.selected = false;
                }
            });
        } else {
            this.allSelected = this.allRowsSelected;
        }

        let selected = this.selectedRows;

        this.onSelectionChanged.emit(selected);

        this.selected = selected;
    }

    public trackByIdentifier(index: number, row: RowData): string {
        return row.identifier;
    }

    public onColumnHeaderClicked(column: Column): void {
        if (column.sortField) {
            if (!this.sorting) {
                this.sorting = true;
            }

            this.sortField = column.sortField;
            this.sortingAscending = !this.sortingAscending;

            this.onSortChanged.emit({
                sortField: this.sortField,
                sortDirection: this.sortingAscending ? "ascending" : "descending"
            });
        }
    }

    private initializeColumns(): void {
        this.columns = this.gridColumns.map((component: GridColumnComponent) => new Column(component));

        this.changeDetector.detectChanges();
    }

    private onResize($event: MouseEvent): void {
        let columnIndex = (<HTMLDivElement>$event.currentTarget).getAttribute("column_index");

        DomHelper.addClassToChildren(
            this.element.nativeElement,
            `.column_${columnIndex}`,
            "column-resizing"
        );

        this.resizedElement = (<Element>$event.currentTarget).parentElement;
        this.resizing = true;
        this.resizedColumnIndex = columnIndex;
    }

    @HostListener("mousemove", ["$event"])
    public onDocumentMouseMoved($event: MouseEvent): void {
        if (this.resizing) {
            if ($event.buttons) {
                let offset = DomHelper.getElementOffset(this.resizedElement);
                if ($event.clientX >= offset.left + 20) {
                    let width = $event.clientX - offset.left;

                    let styles = {
                        flex: "",
                        width: `${width}px`
                    };

                    DomHelper.setElementStyle(this.resizedElement, styles);
                    DomHelper.setChildrenStyle(this.element.nativeElement, `.column_${this.resizedColumnIndex}`, styles);
                }
            } else {
                this.clearResizingData();
            }
        }
    }

    @HostListener("mouseup", ["$event"])
    public onDocumentMouseLeave($event: MouseEvent): void {
        if (this.resizing) {
            this.clearResizingData();
        }
    }

    private clearResizingData(): void {
        DomHelper.removeClassFromChildren(
            this.element.nativeElement,
            `.column_${this.resizedColumnIndex}`,
            "column-resizing"
        );

        this.resizing = false;
        this.resizedElement = null;
        this.resizedColumnIndex = null;
    }

    private subscribeToBodyScrolling(): void {
        this.ngZone.runOutsideAngular(() => {
            let bodyElement = this.element.nativeElement.querySelector("div.data-table-body");

            fromEvent(bodyElement, "scroll")
                .debounceTime(100)
                .subscribe(() => {
                    if (bodyElement.scrollTop + bodyElement.clientHeight === bodyElement.scrollHeight) {
                        this.ngZone.run(() => {
                            ++this.currentPage;

                            this.isLoading = true;

                            this.onLoadNextPage.emit({
                                page: this.currentPage,
                                from: this.currentPage * this.rowsPerPage,
                                rowsPerPage: this.rowsPerPage,
                                sortField: this.sortField,
                                sortDirection: this.sortField && (this.sortingAscending ? "ascending" : "descending")
                            });
                        });
                    }
                });
        });
    }

    private processData(data: any[]): void {
        this.innerData = data
            ? data.map((item: any) => <RowData>(
            {
                identifier: this.identifierField ? item[this.identifierField] : `item_${random(5000, 1000000)}`,
                data: item,
                selected: this.allSelected
            }))
            : [];

        this.isLoading = false;
    }

    private markSelected(rows: any[]): void {
        this.innerData.forEach((row: RowData) => {
            let found: boolean = false;
            rows.forEach((selected: any) => {
                if ((this.identifierField && (row[this.identifierField] === selected[this.identifierField])) ||
                    (!this.identifierField && row === selected)) {
                    found = true;
                }
            });
            row.selected = found;
        });
    }
}

export interface RowMarkData {
    color?: string;
    letter?: string;
}

export type sortDirection = "ascending" | "descending";

export interface SortChangedEvent {
    sortField: string;
    sortDirection: sortDirection
}

export interface RowData {
    identifier?: string;
    selected?: boolean;
    expanded?: boolean;
    data?: any;
}

export interface LoadNextPageEvent {
    page: number;
    from: number;
    rowsPerPage: number;
    sortField?: string;
    sortDirection?: string;
}

export class DomHelper {
    static addClassToElement(element: Element, ...cssClass: string[]): Element {
        element.classList.add(...cssClass);
        return element;
    }

    static addClassToChild(element: Element, selector: string, ...cssClass: string[]): Element {
        let child: Element = element.querySelector(selector);
        element.classList.add(...cssClass);
        return child;
    }

    static addClassToChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        let elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((element: Element) => element.classList.add("column-resizing"));
        }

        return elements;
    }

    static removeClassFromElement(element: Element, ...cssClass: string[]): Element {
        element.classList.remove(...cssClass);
        return element;
    }

    static removeClassFromChild(element: Element, selector: string, ...cssClass: string[]): Element {
        let child: Element = element.querySelector(selector);
        element.classList.remove(...cssClass);
        return child;
    }

    static removeClassFromChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        let elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((element: Element) => element.classList.remove("column-resizing"));
        }

        return elements;
    }

    static getElementOffset(element: HTMLElement): { top: number, left: number } {
        var top = 0, left = 0;
        do {
            top += element.offsetTop || 0;
            left += element.offsetLeft || 0;
            element = <HTMLElement>element.offsetParent;
        } while (element);

        return {
            top: top,
            left: left
        };
    }

    static setElementStyle(element: HTMLElement, styles: any): HTMLElement {
        Object.assign(element.style, styles);

        return element;
    }

    static setChildrenStyle(element: HTMLElement, selector: string, styles: any): NodeListOf<HTMLElement> {
        let elements: any = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((element: HTMLElement) => Object.assign(element.style, styles));
        }

        return elements;
    }
}
