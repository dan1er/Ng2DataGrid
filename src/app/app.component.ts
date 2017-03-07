import {Component, OnInit} from "@angular/core";
import {Http, Response} from "@angular/http";
import "rxjs/add/operator/map";
import {LoadNextPageEvent} from "./data-grid/data-grid.model";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["app.component.less"]
})
export class AppComponent implements OnInit {
    public data: any;
    public selectedRows: any[];
    private dataSet: any[];
    public allowReorderRows: boolean = true;
    public emailVisible: boolean = true;
    public initialSelected: any[];

    constructor(private http: Http) {
    }

    public onLoadNextPage(data: LoadNextPageEvent): void {
        const nextPageData = this.dataSet.slice(data.from, data.from + data.rowsPerPage)
            .map((i: any) => Object.assign(i, {rowMarkData: {letter: i.name}}));

        setTimeout(() => {
            this.data = [...this.data, ...nextPageData];
        }, 500);
    }

    public onSelectionChanged(data: any[]): void {
        this.selectedRows = data;
    }

    public ngOnInit(): void {
        this.loadData();
    }

    private loadData(): void {
        this.http.get("https://jsonplaceholder.typicode.com/comments")
            .map((response: Response) => {
                this.dataSet = response.json();

                this.data = this.dataSet.slice(0, 10).map((i: any) => Object.assign(i, {rowMarkData: {letter: i.name}}));
                this.initialSelected = [this.data[0], this.data[4]];
            })
            .subscribe();
    }
}
