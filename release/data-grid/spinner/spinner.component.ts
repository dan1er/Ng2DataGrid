import {Component} from "@angular/core";

@Component({
    selector: "data-grid-spinner",
    template: `
        <div class="spinner-container">
            <ul class="spinner-flex-container">
                <li>
                    <span class="spinner-loading"></span>
                </li>
            </ul>
        </div>
    `,
    styleUrls: ["spinner.component.less"]
})
export default class SpinnerComponent {
}