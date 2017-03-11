import {
    Component,
    OnInit,
    Input,
    ElementRef,
    TemplateRef,
    ChangeDetectorRef,
    HostListener,
    EventEmitter,
    Output,
    NgZone,
    OnChanges,
    SimpleChanges,
    AfterContentChecked,
    OnDestroy,
    AfterViewInit
} from "@angular/core";
import "rxjs/add/operator/debounceTime";
import {cloneDeep} from "lodash";
import {fromEvent} from "rxjs/observable/fromEvent";
import "rxjs/operator/debounceTime";
import {SelectionService, ColumnsService} from "../data-grid.services";
import {
    RowData,
    RowDragEndedEvent,
    SortChangedEvent,
    LoadNextPageEvent,
    Column,
    RowHeightChangedEvent,
    Map
} from "../data-grid.model";
import {Subscription} from "rxjs";

export type SelectionMode = "single" | "multiple";

@Component({
    selector: "app-data-grid",
    template: `
            <div class="data-table">
                <div class="data-table-header">
                    <div *ngIf="showSelectionInput" 
                         class="column column-selection">
                         <data-grid-checkbox *ngIf="selectionMode === 'multiple'"
                                             (onChanged)="onSelectAllChanged($event)">
                         </data-grid-checkbox>
                    </div>
                    <div class="column column_{{i}}"
                         [ngStyle]="{flex: !column.width ? 1: '', width: column.width}"
                         *ngFor="let column of visibleColumns; let i = index; let isLast = last;"
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
                    <div class="scroller"></div>
                    <div class="data-table-body-data-container">
                        <template ngFor let-key let-last="last" [ngForOf]="displayData">
                            <data-grid-row [columns]="visibleColumns" 
                                           [rowData]="innerData.get(key)" 
                                           [expandTemplate]="expandTemplate"
                                           [showSelectionInput]="showSelectionInput"
                                           [selectionMode]="selectionMode"
                                           [rowMarkField]="rowMarkField"
                                           [allowRowsReorder]="allowRowsReorder"
                                           [relocatedStyles]="relocatedStyles"
                                           [enableVirtualScroll]="true"
                                           [initializeSelected]="allSelected || innerData.get(key).selected"
                                           (onRowSelectionChanged)="onRowSelectionChanged($event)"
                                           (onRowDragEnded)="onRowDragEnded($event)"
                                           (onRowHeightChanged)="onRowHeightChanged($event)">
                            </data-grid-row>
                        </template>
                    </div>
                    <data-grid-spinner *ngIf="isLoading"></data-grid-spinner>
                </div>
                <div *ngIf="false" class="data-table-footer">
                </div>
            </div>
    `,
    styleUrls: ["data-grid.component.less"]
})
export class DataGridComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit, AfterContentChecked {
    @Input() public readonly identifierProperty: string;
    @Input() public data: any[];
    @Input() public selected: any[];
    @Input() public totalRecords: number;
    @Input() public readonly rowsPerPage: number = 50;
    @Input() public readonly selectionMode: SelectionMode = "single";
    @Input() public readonly showSelectionInput: boolean = true;
    @Input() public readonly expandTemplate: TemplateRef<any>;
    @Input() public readonly rowMarkField: string;
    @Input() public readonly allowRowsReorder: string;
    @Input() public readonly relocatedStyles: string[];
    @Output() public onAllSelected: EventEmitter<any> = new EventEmitter();
    @Output() public onSelectionChanged: EventEmitter<any[]> = new EventEmitter();
    @Output() public onSortChanged: EventEmitter<SortChangedEvent> = new EventEmitter();
    @Output() public onLoadNextPage: EventEmitter<LoadNextPageEvent> = new EventEmitter();

    public sorting: boolean = false;
    public sortingAscending: boolean = true;
    public sortField: string;

    public resizing: boolean;
    public resizedElement: HTMLElement;
    public resizedColumnIndex: string;

    public rowsInitialized: boolean;

    public columns: Column[];
    public innerData: Map<RowData>;
    public isLoading: boolean;
    public allSelected: boolean;
    private currentPage: number = 0;


    private identifiersLookup: string[];
    private bodyElement: HTMLDivElement;
    private scrollContainer: HTMLDivElement;
    private scrollSizer: HTMLDivElement;
    private scrollerHeight: number = 0;
    private scrollerInitialized: boolean;
    private heightOffsetInitialized: boolean;
    private currentPosition: number;
    private displayData: string[];
    private scrolledItemsHeight: number;

    private columnsChangedSubscription$: Subscription;
    private bodyScrollingSubscription$: Subscription;

    private firstItemIndex: number = 0;
    private lastIndexIndex: number = 15;
    private scrollBuffer: number;
    private scrollPosition: number = 0;
    private baseRowHeight: number = 0;

    constructor(private element: ElementRef,
                private changeDetector: ChangeDetectorRef,
                private zone: NgZone,
                private selectionService: SelectionService,
                private columnsService: ColumnsService) {
    }

    public ngOnInit(): void {
        this.isLoading = true;
        this.innerData = new Map<RowData>();
        this.selected = [];
        this.data = this.data || [];
        this.identifiersLookup = [];
        this.currentPosition = 0;
        this.scrolledItemsHeight = 0;
        this.scrollBuffer = 3;

        if (!this.identifierProperty) {
            throw new Error("You have to set an identifier property");
        }

        this.selectionService.identifierProperty = this.identifierProperty;

        this.bodyElement = this.element.nativeElement.querySelector("div.data-table-body");
        this.scrollContainer = this.element.nativeElement.querySelector("div.data-table-body-data-container");
        this.scrollSizer = this.element.nativeElement.querySelector("div.scroller");

        this.subscribeToBodyScrolling();
        this.subscribeToColumnsChanged();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes["data"]) {
            this.processData(changes["data"].currentValue);
        }

        if (changes["selected"]) {
            this.markSelected();
        }
    }

    public ngOnDestroy(): void {
        this.columnsChangedSubscription$.unsubscribe();
        this.bodyScrollingSubscription$.unsubscribe();
    }

    public ngAfterViewInit(): void {
        this.changeDetector.detach();
    }

    public ngAfterContentChecked(): void {
        if (!this.rowsInitialized) {
            this.markSelected();
            this.rowsInitialized = true;
        }
    }

    public onRowHeightChanged($event: RowHeightChangedEvent): void {
        if ($event) {
            if (!this.scrollerInitialized) {
                this.scrollerHeight = $event.currentValue * (this.totalRecords || this.data.length);
                this.baseRowHeight = $event.currentValue;
                this.scrollerInitialized = true;

                const {firstItemIndex, lastItemIndex} = DomHelper.getVisibleItemBounds(
                    this.bodyElement,
                    this.data.length,
                    $event.currentValue,
                    this.scrollBuffer,
                    this.innerData);

                this.firstItemIndex = firstItemIndex;
                this.lastIndexIndex = lastItemIndex;
            }

            if ($event.previousValue) {
                this.scrollerHeight -= $event.previousValue;
                this.scrollerHeight += $event.currentValue;

                if (!this.heightOffsetInitialized) {
                    this.setHeightOffset(0);
                    this.heightOffsetInitialized = true;
                } else {
                    this.setHeightOffset($event.rowData.rowIndex);
                }
            }
            // this.scrollContainer.style.height = `${this.scrollerHeight}px`;
            this.scrollSizer.style.height = `${this.scrollerHeight}px`;
        }
    }

    public get visibleColumns(): Column[] {
        return (this.columns || []).filter((column: Column) => column.visible);
    }

    public setDisplayData(from: number, to: number): void {
        this.displayData = this.identifiersLookup.slice(from, to + 1);

        this.changeDetector.detectChanges();
    }

    public get lastPageReached(): boolean {
        return this.data.length >= this.totalRecords;
    }

    public onSelectAllChanged($event: boolean): void {
        this.selected = $event ? this.data : [];

        this.allSelected = $event;

        this.selectionService.emitSelectionChanged({
            allSelected: $event
        });

        this.onAllSelected.emit();
    }

    public onRowSelectionChanged(rowData: RowData): void {
        if (this.selectionMode === "single") {
            this.selected = [];

            if (rowData.selected) {
                this.selected.push(rowData.data);
            }
        } else {
            if (rowData.selected) {
                this.selected.push(rowData.data);
            } else {
                this.selected = this.selected.filter((row: any) => `${row[this.identifierProperty]}` !== rowData.identifier);
            }
        }

        this.allSelected = this.data.length === this.selected.length;

        this.markSelected();

        this.onSelectionChanged.emit(this.selected);
    }

    public onRowDragEnded($event: RowDragEndedEvent): void {
        this.zone.runOutsideAngular(() => {
            const data: RowData[] = Array.from(this.innerData.values());

            if ($event.nextIndex !== $event.currentIndex) {
                const elementToMove = cloneDeep(data[$event.currentIndex]);
                let i = $event.currentIndex;

                elementToMove.relocated = true;

                if ($event.nextIndex > $event.currentIndex) {
                    while (i < $event.nextIndex) {
                        const item = cloneDeep(data[i + 1]);
                        data[i] = item;
                        this.data[i] = item.data;
                        i++;
                    }
                } else {
                    while (i > $event.nextIndex) {
                        const item = cloneDeep(data[i - 1]);
                        data[i] = item;
                        this.data[i] = item.data;
                        i--;
                    }
                }
                data[$event.nextIndex] = elementToMove;
                this.data[$event.nextIndex] = elementToMove.data;

                this.regenerateInnerDataFromRowsData(data);
            }
        });
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

    public onResize($event: MouseEvent): void {
        const columnIndex = (<HTMLDivElement>$event.currentTarget).getAttribute("column_index");

        DomHelper.addClassToChildren(
            this.element.nativeElement,
            `.column_${columnIndex}`,
            "column-resizing"
        );

        this.resizedElement = (<Element>$event.currentTarget).parentElement;
        this.resizing = true;
        this.resizedColumnIndex = columnIndex;
    }

    private subscribeToColumnsChanged(): void {
        this.columnsChangedSubscription$ = this.columnsService.columnsChanged$.subscribe((columns: Column[]) => {
            this.columns = columns;
            this.changeDetector.detectChanges();
        });
    }

    @HostListener("mousemove", ["$event"])
    public onDocumentMouseMoved($event: MouseEvent): void {
        if (this.resizing) {
            if ($event.buttons) {
                const offset = DomHelper.getElementOffset(this.resizedElement);
                if ($event.clientX >= offset.left + 20) {
                    const width = $event.clientX - offset.left;

                    const styles = {
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
        const bodyElement = this.element.nativeElement.querySelector("div.data-table-body");

        this.bodyScrollingSubscription$ = fromEvent(bodyElement, "scroll")
            .subscribe(() => {
                if (bodyElement.scrollTop + bodyElement.clientHeight === bodyElement.scrollHeight) {
                    this.tryNotifyLoadPage();
                }
                this.processScroll();
            });
    }

    private processData(data: any[]): void {
        if (this.allSelected) {
            this.selected = data;
        }

        const newMap: Map<RowData> = new Map();
        this.identifiersLookup = [];

        let index = 0;
        (this.data || []).forEach((item: any) => {
            const itemIdentifier = `${item[this.identifierProperty]}`;

            if (this.innerData.has(itemIdentifier)) {
                const el = this.innerData.get(itemIdentifier);
                el.data = item;
                newMap.set(itemIdentifier, el);
            } else {
                const identifier = itemIdentifier;
                newMap.set(
                    identifier,
                    {
                        selected: this.allSelected,
                        identifier: identifier,
                        data: item,
                        rowIndex: index++
                    });
            }

            this.identifiersLookup.push(itemIdentifier);
        });

        this.innerData = newMap;

        this.isLoading = false;

        this.setDisplayData(this.firstItemIndex, this.lastIndexIndex);
    }

    private markSelected(): void {
        if (this.selected && Array.isArray(this.selected)) {
            this.selected.forEach((item: any) => {
                const identifier = `${item[this.identifierProperty]}`;
                if (this.innerData.has(identifier)) {
                    const row = this.innerData.get(identifier);
                    row.selected = true;
                }
            });

            if (this.allSelected) {
                this.selectionService.emitSelectionChanged({
                    allSelected: true
                });
            } else {
                this.selectionService.emitSelectionChanged({
                    selected: this.selected
                });
            }
        }
    }

    private regenerateInnerDataFromRowsData(data: RowData[]): void {
        const map: Map<RowData> = new Map();

        (data || []).forEach((row: RowData) => map.set(row.identifier, row));

        this.innerData = map;

        this.changeDetector.detectChanges();
    }

    private tryNotifyLoadPage(): void {
        this.zone.run(() => {
            if (!this.lastPageReached) {
                ++this.currentPage;

                this.isLoading = true;

                this.onLoadNextPage.emit({
                    page: this.currentPage,
                    from: this.currentPage * this.rowsPerPage,
                    rowsPerPage: this.rowsPerPage,
                    sortField: this.sortField,
                    sortDirection: this.sortField && (this.sortingAscending ? "ascending" : "descending")
                });
            }
        });
    }

    private processScroll(): void {
        const scrollingDown: boolean = this.bodyElement.scrollTop >= this.scrollPosition;

        if (!this.heightOffsetInitialized) {
            this.setHeightOffset(0);
            this.heightOffsetInitialized = true;
        }

        const {firstItemIndex, lastItemIndex} = DomHelper.getVisibleItemBounds(
            this.bodyElement,
            this.data.length,
            this.innerData.get(this.identifiersLookup[this.firstItemIndex]).rowHeight,
            this.scrollBuffer,
            this.innerData,
            scrollingDown);

        if (this.firstItemIndex !== firstItemIndex || this.lastIndexIndex !== lastItemIndex) {
            let heightOffset = 0;

            const scrollTop = this.bodyElement.scrollTop,
                scrollBottom = this.bodyElement.scrollHeight - this.bodyElement.scrollTop - this.bodyElement.clientHeight,
                lastHeight = this.innerData.last().rowHeight;

            const scrollBottomHeight = this.bodyElement.scrollHeight - scrollTop;

            if ((scrollingDown && firstItemIndex < this.firstItemIndex) ||
                (!scrollingDown && this.scrollPosition - scrollTop > 100)) {

                if (scrollTop < scrollBottomHeight) {
                    this.firstItemIndex = Math.floor(scrollTop / this.baseRowHeight);
                } else {
                    this.firstItemIndex = this.totalRecords - Math.floor(scrollBottomHeight / this.baseRowHeight);
                }

                if (scrollBottom < lastHeight) {
                    heightOffset = this.innerData.last().heightOffset;
                    this.firstItemIndex = Math.max(0, firstItemIndex - this.scrollBuffer);
                    console.log(`last height: ${this.bodyElement.scrollHeight - this.bodyElement.scrollTop}`);
                } else {
                    const bufferedHeight = this.bodyElement.scrollTop > (this.scrollBuffer * this.baseRowHeight)
                        ? (this.scrollBuffer * this.baseRowHeight)
                        : 0;

                    heightOffset = this.bodyElement.scrollTop - bufferedHeight;
                }

                this.lastIndexIndex = this.firstItemIndex + 20;
            } else {
                this.firstItemIndex = firstItemIndex;
                this.lastIndexIndex = lastItemIndex;

                heightOffset = this.innerData.get(this.identifiersLookup[this.firstItemIndex]).heightOffset;
            }

            this.setDisplayData(this.firstItemIndex, this.lastIndexIndex);
            this.changeDetector.markForCheck();

            this.scrollContainer.style.transform = `translateY(${heightOffset}px)`;
        }
        this.scrollPosition = this.bodyElement.scrollTop;
    }

    private setHeightOffset(index: number): void {
        for (let i = index; i < this.identifiersLookup.length; i++) {
            const current = this.innerData.get(this.identifiersLookup[i]),
                previous = i > 0 && this.innerData.get(this.identifiersLookup[i - 1]);
            current.heightOffset = (previous ? previous.heightOffset + (previous.rowHeight || this.baseRowHeight) : 0);
        }
    }
}

export class DomHelper {
    public static getVisibleItemBounds(container: any,
                                       itemsLength: number,
                                       itemHeight: number,
                                       itemBuffer: number,
                                       innerData: Map<RowData>,
                                       scrollingDown = false): {firstItemIndex: number, lastItemIndex: number} {
        if (!container || !itemHeight || !itemsLength) {
            return;
        }

        const innerHeight = container.innerHeight,
            clientHeight = container.clientHeight;


        const viewHeight = innerHeight || clientHeight;

        if (!viewHeight) {
            return;
        }

        let current: HTMLElement,
            firstItemIndex: number,
            lastItemIndex: number,
            firstItemFound: boolean = false,
            lastItemFound: boolean = false;

        const rows = container.querySelectorAll("data-grid-row");

        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                current = <HTMLElement>rows[i];

                const identifier = current.getAttribute("data-identifier"),
                    rowData: RowData = innerData.get(identifier);

                if (rowData) {
                    const containerBoundaries = container.getBoundingClientRect(),
                        rowBoundaries = current.getBoundingClientRect();

                    const containerTop = containerBoundaries.top,
                        containerBottom = containerBoundaries.top + containerBoundaries.height,
                        rowTop = rowBoundaries.top,
                        rowBottom = rowBoundaries.top
                            + rowBoundaries.height;

                    if (!firstItemFound) {
                        if (rowBottom >= containerTop) {
                            firstItemIndex = rowData.rowIndex;
                            firstItemFound = true;
                        }
                    } else {
                        if (rowTop <= containerBottom && rowBottom >= containerBottom) {
                            lastItemIndex = rowData.rowIndex;
                            lastItemFound = true;
                            break;
                        }
                    }
                }
            }
        }

        if (firstItemIndex === undefined) {
            firstItemIndex = itemBuffer;
        }

        if (!lastItemFound) {
            lastItemIndex = firstItemIndex + 20;
        }

        console.log(`first: ${firstItemIndex} - last: ${lastItemIndex}`);

        return {
            firstItemIndex: Math.max(0, firstItemIndex - itemBuffer),
            lastItemIndex: Math.max(0, lastItemIndex + itemBuffer)
        };
    }

    public static addClassToElement(element: Element, ...cssClass: string[]): Element {
        element.classList.add(...cssClass);
        return element;
    }

    public static addClassToChild(element: Element, selector: string, ...cssClass: string[]): Element {
        const child: Element = element.querySelector(selector);
        element.classList.add(...cssClass);
        return child;
    }

    public static addClassToChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        const elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: Element) => el.classList.add("column-resizing"));
        }

        return elements;
    }

    public static removeClassFromElement(element: Element, ...cssClass: string[]): Element {
        element.classList.remove(...cssClass);
        return element;
    }

    public static removeClassFromChild(element: Element, selector: string, ...cssClass: string[]): Element {
        const child: Element = element.querySelector(selector);
        element.classList.remove(...cssClass);
        return child;
    }

    public static removeClassFromChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        const elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: Element) => el.classList.remove("column-resizing"));
        }

        return elements;
    }

    public static getElementOffset(element: HTMLElement): {top: number, left: number} {
        let top = 0, left = 0;
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

    public static setElementStyle(element: HTMLElement, styles: any): HTMLElement {
        Object.assign(element.style, styles);

        return element;
    }

    public static setChildrenStyle(element: HTMLElement, selector: string, styles: any): NodeListOf<HTMLElement> {
        const elements: any = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: HTMLElement) => Object.assign(el.style, styles));
        }

        return elements;
    }

    public static getTopFromWindow(element: HTMLElement) {
        if (typeof element === "undefined" || !element) {
            return 0;
        }

        return (element.offsetTop || 0) + DomHelper.getTopFromWindow(<HTMLElement>element.offsetParent);
    }

    public static getElementTop(element: any) {
        if (element.pageYOffset) {
            return element.pageYOffset;
        }

        if (element.document) {
            if (element.document.documentElement && element.document.documentElement.scrollTop) {
                return element.document.documentElement.scrollTop;
            }

            if (element.document.body && element.document.body.scrollTop) {
                return element.document.body.scrollTop;
            }

            return 0;
        }

        return element.scrollY || element.scrollTop || 0;
    }
}
