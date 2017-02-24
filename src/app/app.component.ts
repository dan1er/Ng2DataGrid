import { Component, OnInit } from '@angular/core';
import { LoadNextPageEvent } from "./data-grid/data-grid/data-grid.component";
import { Http, Response } from "@angular/http";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['app.component.less']
})
export class AppComponent implements OnInit {
    public data: any;
    public selectedRows: any[];
    private dataSet: any[];

    constructor(private http: Http) {
    }

    public onLoadNextPage(data: LoadNextPageEvent): void {
        let nextPageData = this.dataSet.slice(data.from, data.from + data.rowsPerPage).map((i: any) => Object.assign(i, { rowMarkData: { letter: i.name } }));

        setTimeout(()=> {this.data = [...this.data, ...nextPageData];}, 500);
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

                this.data = this.dataSet.slice(0, 200).map((i: any) => Object.assign(i, { rowMarkData: { letter: i.name } }));
            })
            .subscribe();
    }
}
