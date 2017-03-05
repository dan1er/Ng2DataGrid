import {
    Component,
    Output,
    EventEmitter,
    Input,
    ChangeDetectionStrategy,
    OnDestroy,
    ElementRef,
    OnInit
} from "@angular/core";
import {SelectionService, ISelectionChangedEvent} from "../data-grid.services";
import {Subscription} from "rxjs";

@Component({
    selector: "data-grid-checkbox",
    template: `
        <div class="checkbox-container" 
             (click)="toggleValue($event)">
            <div class="checkbox-container-input"
                 [class.display-radio]="displayAsRadio">
            </div>
        </div>
    `,
    styleUrls: ["checkbox.component.less"],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export default class CheckboxComponent implements OnInit, OnDestroy {
    @Input() public displayAsRadio: boolean;
    @Input() public initializeSelected: boolean;
    @Input() public identifierProperty: string;
    @Output() public onChanged: EventEmitter<any> = new EventEmitter();
    private _checked: boolean = false;
    private selectionSubscription$: Subscription;
    private element: HTMLDivElement;

    constructor(private selectionService: SelectionService, private el: ElementRef) {
        this.subscribeToSelectionChanged();
    }

    public ngOnInit(): void {
        this.element = this.el.nativeElement.querySelector(".checkbox-container-input");

        if (this.initializeSelected) {
            this.checked = true;
        }
    }

    public get checked(): boolean {
        return this._checked;
    }

    public set checked(value: boolean) {
        this._checked = value;

        if (value) {
            this.element.classList.add("checked");
        } else {
            this.element.classList.remove("checked");
        }
    }

    public ngOnDestroy(): void {
        this.selectionSubscription$.unsubscribe();
    }

    public toggleValue($event: MouseEvent): void {
        $event.stopPropagation();

        this.checked = !this.checked;

        this.onChanged.emit(this.checked);
    }

    private subscribeToSelectionChanged(): void {
        this.selectionSubscription$ = this.selectionService.selectionChanged$.subscribe(($event: ISelectionChangedEvent) => {
            if ($event.clearSelection) {
                this.checked = false;
            } else if ($event.hasOwnProperty("allSelected")) {
                if ($event.allSelected) {
                    this.checked = true;
                } else {
                    this.checked = false;
                }
            } else {
                if (!this.identifierProperty) {
                    this.checked = false;
                } else {
                    if ((<Map<string, boolean>>$event.selected).has(this.identifierProperty)) {
                        this.checked = true;
                    } else {
                        this.checked = false;
                    }
                }
            }
        });
    }
}
