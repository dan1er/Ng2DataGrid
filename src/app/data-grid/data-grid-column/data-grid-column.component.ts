import {
    Component,
    Input,
    TemplateRef,
    ChangeDetectionStrategy,
    OnChanges,
    SimpleChanges,
    ChangeDetectorRef,
    AfterViewInit
} from "@angular/core";
import {ColumnsService} from "../data-grid.services";
import {Column} from "../data-grid.model";

@Component({
    selector: "grid-column",
    template: ``,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridColumnComponent implements OnChanges, AfterViewInit {
    @Input() public field: string;
    @Input() public header: string;
    @Input() public width: string;
    @Input() public resizable: string;
    @Input() public sortField: string;
    @Input() public visible: boolean;
    @Input() public template: TemplateRef<any>;

    constructor(private columnsService: ColumnsService,
                private changeDetector: ChangeDetectorRef) {
    }

    public ngOnChanges(changes: SimpleChanges): void {
        this.columnsService.registerColumn(new Column(this));
    }

    public ngAfterViewInit(): void {
        this.changeDetector.detach();
    }
}
