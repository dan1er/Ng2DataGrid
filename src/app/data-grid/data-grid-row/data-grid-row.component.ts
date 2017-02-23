import {
    Component, Input, Output, EventEmitter, TemplateRef, OnInit
} from '@angular/core';
import { Column } from "../data-grid-column/data-grid-column.component";
import {RowMarkData, RowData} from "../data-grid/data-grid.component";

@Component({
    selector: 'data-grid-row',
    template: `
      <div class="data-table-body-row">
          <div class="data-table-body-row-columns" (click)="onColumnsRowClicked()">
              <template [ngIf]="rowMarkField && rowData.data[rowMarkField]">
                    <div class="column-marker" [style.border-color]="rowData.data[rowMarkField].color">
                    <span *ngIf="rowData.data[rowMarkField].letter">{{rowData.data[rowMarkField].letter}}</span>      
              </div>
              </template>
              <div *ngIf="showSelectionInput" 
                   class="column column-selection">
                   <data-grid-checkbox [value]="rowData.selected"
                                       [displayAsRadio]="displayAsRadio"
                                       (onChanged)="onRowSelectedChanged($event)">
                   </data-grid-checkbox>
              </div>
              
              <div class="column column_{{i}}"
                   [ngStyle]="{flex: !column.width ? 1: '', width: column.width}"
                   *ngFor="let column of columns; let i = index">
                  <div *ngIf="!column.template" class="column-content">{{rowData.data[column.field]}}</div>
                  <template [ngIf]="column.template" [ngTemplateOutlet]="column.template"></template>
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
    styleUrls: ['./data-grid-row.component.less'],
})
export class DataGridRowComponent implements OnInit {
    @Input() public columns: Column[];
    @Input() public rowData: RowData;
    @Input() public showSelectionInput: boolean;
    @Input() public selectionMode: string;
    @Input() public expandTemplate: TemplateRef<any>;
    @Input() public rowMarkField: string;
    @Output() public onRowSelectionChanged: EventEmitter<any> = new EventEmitter();
    @Output() public onRowExpanded: EventEmitter<any> = new EventEmitter();

    public ngOnInit(): void {
        this.initRowMarkData();
    }

    public onRowSelectedChanged($event: boolean): void {
        this.rowData.selected = $event;

        this.onRowSelectionChanged.emit(this.rowData);
    }

    public get displayAsRadio(): boolean {
        return this.selectionMode === 'single';
    }

    public toggleExpanded(): void {
        this.rowData.expanded = !this.rowData.expanded;

        this.onRowExpanded.emit(this.rowData);
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
            let rowMarkData: RowMarkData = this.rowData.data[this.rowMarkField];

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
}
