import {Injectable, EventEmitter} from "@angular/core";

@Injectable()
export class SelectionService {
    public selectionChanged$: EventEmitter<ISelectionChangedEvent> = new EventEmitter();
    public identifierProperty: string = "";

    public emitSelectionChanged($event: ISelectionChangedEvent = null): void {
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

export interface ISelectionChangedEvent {
    allSelected?: boolean;
    clearSelection?: boolean;
    selected?: any[]|Map<string, boolean>;
}
