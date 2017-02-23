import { Component, Output, EventEmitter, Input } from "@angular/core";

@Component({
    selector: "data-grid-checkbox",
    template: `
        <div class="checkbox-container" 
             (click)="toggleValue($event)">
            <div class="checkbox-container-input"
                 [class.checked]="value"
                 [class.display-radio]="displayAsRadio">
            </div>
        </div>
    `,
    styleUrls: ["checkbox.component.less"]
})
export default class CheckboxComponent {
    @Input() public displayAsRadio: boolean;
    @Output() public onChanged: EventEmitter<any> = new EventEmitter();
    private innerValue: boolean = false;

    public get value(): boolean {
        return this.innerValue;
    }

    @Input()
    public set value(val: boolean) {
        if (val !== this.innerValue) {
            this.innerValue = val;
        }
    }

    public toggleValue($event: MouseEvent): void {
        $event.stopPropagation();

        this.value = !this.value;

        this.onChanged.emit(this.value);
    }
}