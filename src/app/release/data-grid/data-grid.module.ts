import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {DataGridComponent} from "./data-grid/data-grid.component";
import {ReactiveFormsModule, FormsModule} from "@angular/forms";
import {GridColumnComponent} from "./data-grid-column/data-grid-column.component";
import {DataGridRowComponent} from "./data-grid-row/data-grid-row.component";
import CheckboxComponent from "./checkbox/checkbox.component";
import SpinnerComponent from "./spinner/spinner.component";
import {SelectionService, ColumnsService, DomHelperService} from "./data-grid.services";

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule
    ],
    declarations: [
        DataGridComponent,
        GridColumnComponent,
        DataGridRowComponent,
        CheckboxComponent,
        SpinnerComponent
    ],
    providers: [SelectionService, ColumnsService, DomHelperService],
    exports: [DataGridComponent, GridColumnComponent]
})
export class DataGridModule {
}
