import {
    Component,
    Input,
    Output,
    EventEmitter,
    TemplateRef,
    OnInit,
    ElementRef,
    NgZone,
    OnChanges,
    SimpleChanges,
    ChangeDetectorRef,
    AfterViewInit,
    HostBinding
} from "@angular/core";
import {fromEvent} from "rxjs/observable/fromEvent";
import {Subscription} from "rxjs";
import {RowData, RowDragEndedEvent, RowMarkData, Column, RowHeightChangedEvent} from "../data-grid.model";

@Component({
    selector: "data-grid-row",
    template: `
      <div class="data-table-body-row" [draggable]="allowRowsReorder">
          <div class="data-table-body-row-columns" 
               [ngStyle]="rowData.relocated && relocatedStyles"
               [style.minHeight]="innerHeight"
               (click)="onColumnsRowClicked()">
              <template [ngIf]="rowMarkField && rowData.data[rowMarkField]">
                    <div class="column-marker" [style.border-color]="rowData.data[rowMarkField].color">
                    <span *ngIf="rowData.data[rowMarkField].letter">{{rowData.data[rowMarkField].letter}}</span>      
              </div>
              </template>
              <div *ngIf="showSelectionInput" 
                   class="column column-selection">
                   <data-grid-checkbox [displayAsRadio]="displayAsRadio"
                                       [identifierProperty]="rowData.identifier"
                                       [initializeSelected]="initializeSelected"
                                       (onChanged)="onRowSelectedChanged($event)">
                   </data-grid-checkbox>
              </div>
              
              <div class="column column_{{i}}"
                   [ngStyle]="{flex: !column.width ? 1: '', width: column.width}"
                   *ngFor="let column of columns; let i = index">
                  <div *ngIf="!column.template" class="column-content">{{rowData.data[column.field]}}</div>
                  <template [ngIf]="column.template" 
                            [ngTemplateOutlet]="column.template" 
                            [ngOutletContext]="{rowData: rowData.data}">
                  </template>
              </div>
              <div *ngIf="expandTemplate" 
                   class="column column-expand"
                   [class.expanded]="rowData.expanded"
                   (click)="onToggleSelectedClicked($event)">
              </div>
          </div>
          <div  *ngIf="rowData.expanded"
                class="data-table-body-row-expanded">
               <template [ngTemplateOutlet]="expandTemplate" [ngOutletContext]="{rowData: rowData.data}"></template>
          </div>
      </div>
  `,
    styleUrls: ["./data-grid-row.component.less"]
})
export class DataGridRowComponent implements OnInit, OnChanges, AfterViewInit {
    @Input() public readonly columns: Column[];
    @Input() public rowData: RowData;
    @Input() public readonly showSelectionInput: boolean;
    @Input() public readonly selectionMode: string;
    @Input() public readonly expandTemplate: TemplateRef<any>;
    @Input() public readonly rowMarkField: string;
    @Input() public readonly allowRowsReorder: string;
    @Input() public readonly relocatedStyles: string[];
    @Input() public initializeSelected: boolean;
    @Input() public virtualScrollingEnabled: boolean;
    @Input() public height: number;
    @Output() public onRowSelectionChanged: EventEmitter<any> = new EventEmitter();
    @Output() public onRowDragEnded: EventEmitter<RowDragEndedEvent> = new EventEmitter();
    @Output() public onRowHeightChanged: EventEmitter<RowHeightChangedEvent> = new EventEmitter();
    @HostBinding("attr.data-identifier") identifier: string;

    public innerHeight: string;
    private element: HTMLDivElement;
    private draggingSubscribersInitialized: boolean;
    private onDragOver$: Subscription;
    private onDragLeave$: Subscription;
    private onDragStart$: Subscription;
    private onDrop$: Subscription;

    constructor(private el: ElementRef,
                private changeDetector: ChangeDetectorRef,
                private zone: NgZone) {
        this.element = this.el.nativeElement;
    }

    public ngOnInit(): void {
        this.initRowMarkData();

        this.innerHeight = this.height ? `${this.height}px` : "auto";

        this.identifier = this.rowData.identifier;
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes["allowRowsReorder"]) {
            if (this.allowRowsReorder) {
                if (!this.draggingSubscribersInitialized) {
                    this.subscribeToDragEvents();

                    this.draggingSubscribersInitialized = true;
                }
            } else {
                if (this.draggingSubscribersInitialized) {
                    this.unSubscribeFromDragEvents();

                    this.draggingSubscribersInitialized = false;
                }
            }
        }

        if (changes["columns"]) {
            this.changeDetector.detectChanges();
        }
    }

    public ngAfterViewInit(): void {
        this.changeDetector.detach();

        if (this.virtualScrollingEnabled) {
            this.trySetRowHeightAndNotify();
        }
    }

    public onRowSelectedChanged($event: boolean): void {
        this.rowData.selected = $event;

        this.onRowSelectionChanged.emit(this.rowData);
    }

    public get displayAsRadio(): boolean {
        return this.selectionMode === "single";
    }

    public toggleExpanded(): void {
        this.rowData.expanded = !this.rowData.expanded;

        this.changeDetector.detectChanges();

        if (this.virtualScrollingEnabled) {
            setTimeout(() => this.trySetRowHeightAndNotify());
        }
    }

    public onColumnsRowClicked(): void {
        if (this.expandTemplate) {
            this.toggleExpanded();
        }
    }

    public onToggleSelectedClicked($event: MouseEvent): void {
        $event.stopPropagation();

        this.toggleExpanded();
    }

    private initRowMarkData(): void {
        if (this.rowMarkField && this.rowData.data[this.rowMarkField]) {
            const rowMarkData: RowMarkData = this.rowData.data[this.rowMarkField];

            if (!rowMarkData.color) {
                rowMarkData.color = "#98db53";
            }

            if (rowMarkData.letter) {
                if (rowMarkData.letter.length > 1) {
                    rowMarkData.letter = rowMarkData.letter.charAt(0);
                }
            }
        }
    }

    private subscribeToDragEvents(): void {
        this.zone.runOutsideAngular(() => {
            this.onDragStart$ = this.onDragStart();
            this.onDragOver$ = this.onDragOver();
            this.onDragLeave$ = this.onDragLeave();
            this.onDrop$ = this.onDrop();
        });
    }

    private unSubscribeFromDragEvents(): void {
        this.onDragStart$.unsubscribe();
        this.onDragOver$.unsubscribe();
        this.onDragLeave$.unsubscribe();
        this.onDrop$.unsubscribe();
    }

    private onDragStart(): Subscription {
        return fromEvent(this.element, "dragstart")
            .subscribe(($event: DragEvent) => {
                $event.stopPropagation();

                $event.dataTransfer.setData("index", `${this.rowData.rowIndex}`);
                $event.dataTransfer.effectAllowed = "move";
            });
    }

    private onDragOver(): Subscription {
        return fromEvent(this.element, "dragover")
            .subscribe(($event: DragEvent) => {
                $event.preventDefault();

                $event.dataTransfer.dropEffect = "move";

                if (!this.element.classList.contains("row-dragging-over")) {
                    this.element.classList.add("row-dragging-over");
                }
            });

    }

    private onDragLeave(): Subscription {
        return fromEvent(this.element, "dragleave")
            .subscribe(() => {
                this.element.classList.remove("row-dragging-over");
            });
    }

    private onDrop(): Subscription {
        return fromEvent(this.element, "drop")
            .subscribe(($event: DragEvent) => {
                $event.preventDefault();

                const index = $event.dataTransfer.getData("index");
                this.onRowDragEnded.emit({currentIndex: +index, nextIndex: this.rowData.rowIndex});

                this.element.classList.remove("row-dragging-over");
            });
    }

    private trySetRowHeightAndNotify(): void {
        this.changeDetector.detectChanges();

        const style = window.getComputedStyle(this.el.nativeElement),
            currentHeight = parseFloat(style.height);

        if (this.rowData.rowHeight !== currentHeight) {
            const previousHeight = this.rowData.rowHeight || 0;

            this.rowData.rowHeight = currentHeight;

            this.onRowHeightChanged.emit({
                previousValue: previousHeight,
                currentValue: currentHeight,
                rowData: this.rowData
            });
        }
    }
}
