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
import {SelectionService, ColumnsService, DomHelperService} from "../data-grid.services";
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
                                           [enableVirtualScroll]="virtualScrollingEnabled"
                                           [initializeSelected]="allSelected || innerData.get(key).selected"
                                           [height]="baseRowHeight"
                                           (onRowSelectionChanged)="onRowSelectionChanged($event)"
                                           (onRowDragEnded)="onRowDragEnded($event)"
                                           (onRowHeightChanged)="onRowHeightChanged($event)">
                            </data-grid-row>
                        </template>
                    </div>
                </div>
                <data-grid-spinner *ngIf="isLoading" [class.center]="virtualScrollingEnabled"></data-grid-spinner>
                <div *ngIf="false" class="data-table-footer"></div>
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
    @Input() public readonly virtualScrollingEnabled: string[];
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
    public baseRowHeight: number = 0;

    public columns: Column[];
    public innerData: Map<RowData>;
    public isLoading: boolean;
    public allSelected: boolean;
    private currentPage: number = 0;


    private identifiersLookup: string[];
    private bodyElement: HTMLDivElement;
    private listContainer: HTMLDivElement;
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
    private lastItemIndex: number = 15;
    private scrollBuffer: number;
    private scrollPosition: number = 0;

    constructor(private element: ElementRef,
                private changeDetector: ChangeDetectorRef,
                private zone: NgZone,
                private selectionService: SelectionService,
                private columnsService: ColumnsService,
                private domHelperService: DomHelperService) {
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
        this.listContainer = this.element.nativeElement.querySelector("div.data-table-body-data-container");
        this.scrollSizer = this.element.nativeElement.querySelector("div.scroller");

        this.subscribeToBodyScrolling();
        this.subscribeToColumnsChanged();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes["data"]) {
            this.processData();
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
                this.scrollerHeight = $event.currentValue * this.data.length;
                this.baseRowHeight = $event.currentValue;
                this.scrollerInitialized = true;

                const {firstItemIndex, lastItemIndex} = this.domHelperService.getVisibleItemBounds(
                    this.bodyElement,
                    this.baseRowHeight,
                    this.scrollBuffer,
                    this.innerData,
                    this.identifiersLookup,
                    false,
                    this.data.length);

                this.firstItemIndex = firstItemIndex;
                this.lastItemIndex = lastItemIndex;
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
            this.setScrollerSize(this.scrollerHeight);
        }
    }

    public get visibleColumns(): Column[] {
        return (this.columns || []).filter((column: Column) => column.visible);
    }

    public setDisplayData(from: number, to: number): void {
        if (this.virtualScrollingEnabled) {
            this.displayData = this.identifiersLookup.slice(from, to + 1);
        } else {
            this.displayData = this.identifiersLookup;
        }

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

        this.domHelperService.addClassToChildren(
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
                const offset = this.domHelperService.getElementOffset(this.resizedElement);
                if ($event.clientX >= offset.left + 20) {
                    const width = $event.clientX - offset.left;

                    const styles = {
                        flex: "",
                        width: `${width}px`
                    };

                    this.domHelperService.setElementStyle(this.resizedElement, styles);
                    this.domHelperService.setChildrenStyle(this.element.nativeElement, `.column_${this.resizedColumnIndex}`, styles);
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
        this.domHelperService.removeClassFromChildren(
            this.element.nativeElement,
            `.column_${this.resizedColumnIndex}`,
            "column-resizing"
        );

        this.resizing = false;
        this.resizedElement = null;
        this.resizedColumnIndex = null;
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

    private processData(): void {
        if (this.allSelected) {
            this.selected = this.data;
        }

        const newMap: Map<RowData> = new Map();
        this.identifiersLookup = [];

        let index = 0,
            scrollerHeight = 0;
        (this.data || []).forEach((item: any) => {
            const itemIdentifier = `${item[this.identifierProperty]}`;

            if (this.innerData.has(itemIdentifier)) {
                const el = this.innerData.get(itemIdentifier);
                el.data = item;
                newMap.set(itemIdentifier, el);
                scrollerHeight += el.rowHeight || this.baseRowHeight;
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
                scrollerHeight += this.baseRowHeight;
            }

            this.identifiersLookup.push(itemIdentifier);
        });

        this.innerData = newMap;

        if (this.virtualScrollingEnabled && this.scrollSizer && this.firstItemIndex) {
            this.scrollerHeight = scrollerHeight - this.scrollBuffer * this.baseRowHeight;
            this.setScrollerSize(this.scrollerHeight);
        }

        this.isLoading = false;

        this.setDisplayData(this.firstItemIndex, this.lastItemIndex);
    }

    private subscribeToBodyScrolling(): void {
        const bodyElement = this.element.nativeElement.querySelector("div.data-table-body");

        this.bodyScrollingSubscription$ = fromEvent(bodyElement, "scroll")
            .subscribe(() => {
                if (bodyElement.scrollTop + bodyElement.clientHeight === bodyElement.scrollHeight) {
                    this.tryNotifyLoadPage();
                }

                if (this.virtualScrollingEnabled) {
                    this.processScroll();
                }
            });
    }

    private tryNotifyLoadPage(): void {
        this.zone.run(() => {
            if (!this.lastPageReached) {
                ++this.currentPage;

                this.isLoading = true;

                this.changeDetector.detectChanges();

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
        if (!this.isLoading) {
            const scrollingDown: boolean = this.bodyElement.scrollTop >= this.scrollPosition;
            console.log(this.bodyElement.scrollTop);
            if (!this.heightOffsetInitialized) {
                this.setHeightOffset(0);
                this.heightOffsetInitialized = true;
            }

            const {firstItemIndex, lastItemIndex, heightOffset} = this.domHelperService.getVisibleItemBounds(
                this.bodyElement,
                this.baseRowHeight,
                this.scrollBuffer,
                this.innerData,
                this.identifiersLookup,
                scrollingDown,
                this.data.length,
                this.firstItemIndex);

            if (this.firstItemIndex !== firstItemIndex || this.lastItemIndex !== lastItemIndex) {
                this.firstItemIndex = firstItemIndex;
                this.lastItemIndex = lastItemIndex;

                this.setDisplayData(this.firstItemIndex, this.lastItemIndex);

                this.setListYPosition(heightOffset);

                this.changeDetector.markForCheck();
            }
            this.scrollPosition = this.bodyElement.scrollTop;
        }
    }

    private setScrollerSize(size: number): void {
        console.log("resize");
        this.scrollSizer.style.height = `${size}px`;
    }

    private setListYPosition(position: number): void {
        console.log("set position");
        this.listContainer.style.transform = `translateY(${position}px)`;
    }

    private setHeightOffset(index: number): void {
        for (let i = index; i < this.identifiersLookup.length; i++) {
            const current = this.innerData.get(this.identifiersLookup[i]),
                previous = i > 0 && this.innerData.get(this.identifiersLookup[i - 1]);
            current.heightOffset = (previous ? previous.heightOffset + (previous.rowHeight || this.baseRowHeight) : 0);
        }
    }
}
