import {Injectable, EventEmitter} from "@angular/core";
import {ISelectionChangedEvent, Column} from "./data-grid.model";
import {findIndex} from "lodash";

@Injectable()
export class SelectionService {
    public selectionChanged$: EventEmitter<ISelectionChangedEvent> = new EventEmitter();
    public identifierProperty: string = "";

    public emitSelectionChanged($event: ISelectionChangedEvent): void {
        if (this.identifierProperty && $event.selected && $event.selected instanceof Array) {
            const map: Map<string, boolean> = new Map();

            $event.selected.forEach((item: any) => {
                map.set(`${item[this.identifierProperty]}`, true);
            });

            $event.selected = map;
        }

        this.selectionChanged$.emit($event);
    }
}

@Injectable()
export class ColumnsService {
    public columnsChanged$: EventEmitter<Column[]> = new EventEmitter();
    private columns: Column[] = [];

    public registerColumn(column: Column): void {
        const index = findIndex(this.columns, {field: column.field});

        if (index > 0) {
            this.columns[index] = column;
        } else {
            this.columns.push(column);
        }

        this.columnsChanged$.emit(this.columns);
    }
}
