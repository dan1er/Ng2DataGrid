import {Injectable, EventEmitter} from "@angular/core";
import {ISelectionChangedEvent, Column, Map, RowData} from "./data-grid.model";
import {findIndex} from "lodash";

@Injectable()
export class SelectionService {
    public selectionChanged$: EventEmitter<ISelectionChangedEvent> = new EventEmitter();
    public identifierProperty: string = "";

    public emitSelectionChanged($event: ISelectionChangedEvent): void {
        if (this.identifierProperty && $event.selected && $event.selected instanceof Array) {
            const map = new Map<boolean>();

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

@Injectable()
export class DomHelperService {
    public getVisibleItemBounds(container: Element,
                                rowHeight: number,
                                buffer: number,
                                data: Map<RowData>,
                                identifiersLookup: string[],
                                scrollingDown: boolean,
                                totalRecords: number,
                                previousFirstItem: number = 0): {firstItemIndex: number, lastItemIndex: number, heightOffset: number} {
        if (!container) {
            return;
        }

        let current: HTMLElement,
            firstItemIndex: number = 0,
            lastItemIndex: number,
            firstItemFound: boolean = false,
            lastItemFound: boolean = false,
            heightOffset: number = 0;

        const rows = container.querySelectorAll("data-grid-row"),
            itemsPerContainer: number = Math.ceil(container.clientHeight / rowHeight);

        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                current = <HTMLElement>rows[i];

                const identifier = current.getAttribute("data-identifier"),
                    rowData: RowData = data.get(identifier);

                if (rowData) {
                    const containerBoundaries = container.getBoundingClientRect(),
                        rowBoundaries = current.getBoundingClientRect(),
                        containerTop = containerBoundaries.top,
                        containerBottom = containerBoundaries.top + containerBoundaries.height,
                        rowTop = rowBoundaries.top,
                        rowBottom = rowBoundaries.top + rowBoundaries.height;

                    if (!firstItemFound) {
                        if (rowBottom >= containerTop && rowTop <= containerBottom) {
                            // if there is a row in visible in container
                            firstItemIndex = rowData.rowIndex;
                            firstItemFound = true;
                        }
                    } else {
                        if (rowTop <= containerBottom && rowBottom >= containerBottom) {
                            lastItemIndex = rowData.rowIndex;
                            lastItemFound = true;
                            break;
                        }
                    }
                }
            }

            if (firstItemFound && !(scrollingDown && firstItemIndex < previousFirstItem)) {
                // if row visible
                lastItemIndex = Math.max(0, firstItemIndex + itemsPerContainer + buffer);
                firstItemIndex = Math.max(0, firstItemIndex - buffer);
                heightOffset = data.get(identifiersLookup[firstItemIndex]).heightOffset;
            } else {
                const scrollTop = container.scrollTop,
                    firstHeight = data.get(identifiersLookup[0]).rowHeight,
                    lastHeight = data.last().rowHeight || rowHeight;

                const scrollBottomHeight = container.scrollHeight - scrollTop - container.clientHeight;

                if (scrollingDown && scrollBottomHeight < lastHeight) {
                    // if scroll reached end
                    firstItemIndex = totalRecords - 1 - itemsPerContainer - buffer;
                } else if (!scrollingDown && scrollTop < firstHeight) {
                    // if top reached
                    firstItemIndex = 0;
                } else {
                    firstItemIndex = Math.floor(scrollTop / rowHeight);
                }

                if (firstItemIndex > --totalRecords - itemsPerContainer) {
                    firstItemIndex = totalRecords - itemsPerContainer;
                }

                lastItemIndex = Math.max(0, firstItemIndex + itemsPerContainer + buffer);
                firstItemIndex = Math.max(0, firstItemIndex - buffer);

                if (scrollingDown && firstItemIndex < previousFirstItem) {
                    firstItemIndex = firstItemIndex + 1;
                    lastItemIndex = lastItemIndex + 1;
                }

                const itemAtPosition = data.get(identifiersLookup[firstItemIndex]),
                    currentOffset = itemAtPosition.heightOffset || firstItemIndex * rowHeight,
                    normalOffset = firstItemIndex * rowHeight;

                if (currentOffset > normalOffset && scrollBottomHeight * buffer > currentOffset - normalOffset) {
                    // expanded records
                    heightOffset = normalOffset;
                    console.log("expanded");
                } else {
                    heightOffset = currentOffset;
                }
            }
        }

        return {
            firstItemIndex,
            lastItemIndex,
            heightOffset
        };
    }

    public addClassToElement(element: Element, ...cssClass: string[]): Element {
        element.classList.add(...cssClass);
        return element;
    }

    public addClassToChild(element: Element, selector: string, ...cssClass: string[]): Element {
        const child: Element = element.querySelector(selector);
        element.classList.add(...cssClass);
        return child;
    }

    public addClassToChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        const elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: Element) => el.classList.add("column-resizing"));
        }

        return elements;
    }

    public removeClassFromElement(element: Element, ...cssClass: string[]): Element {
        element.classList.remove(...cssClass);
        return element;
    }

    public removeClassFromChild(element: Element, selector: string, ...cssClass: string[]): Element {
        const child: Element = element.querySelector(selector);
        element.classList.remove(...cssClass);
        return child;
    }

    public removeClassFromChildren(element: Element, selector: string, ...cssClass: string[]): NodeListOf<Element> {
        const elements = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: Element) => el.classList.remove("column-resizing"));
        }

        return elements;
    }

    public getElementOffset(element: HTMLElement): {top: number, left: number} {
        let top = 0, left = 0;
        do {
            top += element.offsetTop || 0;
            left += element.offsetLeft || 0;
            element = <HTMLElement>element.offsetParent;
        } while (element);

        return {
            top: top,
            left: left
        };
    }

    public setElementStyle(element: HTMLElement, styles: any): HTMLElement {
        Object.assign(element.style, styles);

        return element;
    }

    public setChildrenStyle(element: HTMLElement, selector: string, styles: any): NodeListOf<HTMLElement> {
        const elements: any = element.querySelectorAll(selector);

        if (elements) {
            (<any>elements).forEach((el: HTMLElement) => Object.assign(el.style, styles));
        }

        return elements;
    }

    public getTopFromWindow(element: HTMLElement) {
        if (typeof element === "undefined" || !element) {
            return 0;
        }

        return (element.offsetTop || 0) + this.getTopFromWindow(<HTMLElement>element.offsetParent);
    }

    public getElementTop(element: any) {
        if (element.pageYOffset) {
            return element.pageYOffset;
        }

        if (element.document) {
            if (element.document.documentElement && element.document.documentElement.scrollTop) {
                return element.document.documentElement.scrollTop;
            }

            if (element.document.body && element.document.body.scrollTop) {
                return element.document.body.scrollTop;
            }

            return 0;
        }

        return element.scrollY || element.scrollTop || 0;
    }
}
