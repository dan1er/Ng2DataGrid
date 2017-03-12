import {Component, OnInit, ChangeDetectorRef, AfterViewInit} from "@angular/core";
import {Http, Response} from "@angular/http";
import "rxjs/add/operator/map";
import {LoadNextPageEvent} from "./data-grid/data-grid.model";
import {range, random} from "lodash";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["app.component.less"]
})
export class AppComponent implements OnInit, AfterViewInit {
    public data: any;
    public selectedRows: any[];
    private dataSet: any[];
    public allowReorderRows: boolean = true;
    public emailVisible: boolean = true;
    public initialSelected: any[];

    constructor(private http: Http, private changeDetectorRef: ChangeDetectorRef) {
    }

    public onLoadNextPage(data: LoadNextPageEvent): void {
        const nextPageData = this.dataSet.slice(data.from, data.from + data.rowsPerPage)
            .map((i: any) => Object.assign(i, {rowMarkData: {letter: i.name}}));

        setTimeout(() => {
            this.data = [...this.data, ...nextPageData];
            this.changeDetectorRef.detectChanges();
        }, 500);
    }

    public onSelectionChanged(data: any[]): void {
        this.selectedRows = data;
    }

    public ngOnInit(): void {
        this.loadData();
    }

    public ngAfterViewInit(): void {
        // this.changeDetectorRef.detach();
    }

    public get optionsCount(): number[] {
        return range(0, random(3, 10));
    }

    private loadData(): void {
        this.http.get("https://jsonplaceholder.typicode.com/photos")
            .map((response: Response) => {
                this.dataSet = response.json();

                this.data = this.dataSet.map((i: any) => Object.assign(i, {rowMarkData: {letter: i.name}}));
                this.initialSelected = [this.data[0], this.data[4]];
                this.changeDetectorRef.detectChanges();
            })
            .subscribe();
    }
}
