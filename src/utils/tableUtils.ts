import JSZip from "jszip";
import { ColumnMetadata, TableData, DataTypes } from "../types";
import { defaults, element, elementAttributes, queryTableNotFoundErr, queryTableXmlPath, sheetsNotFoundErr, sheetsXmlPath, tableNotFoundErr, tableXmlPath, textResultType, workbookXmlPath, xmlTextResultType } from "../constants";
import documentUtils from "./documentUtils";
import { v4 } from "uuid";

const updateTableInitialDataIfNeeded = async (zip: JSZip, tableData?: TableData) : Promise<void> => {
        if (!tableData)
        {
            return;
        }

        const sheetsXmlString: string | undefined = await zip.file(sheetsXmlPath)?.async(textResultType);
        if (sheetsXmlString === undefined) {
            throw new Error(sheetsNotFoundErr);
        }

        const newSheet: string = await updateSheetsInitialData(sheetsXmlString, tableData);
        zip.file(sheetsXmlPath, newSheet);

        const queryTableXmlString: string | undefined = await zip.file(queryTableXmlPath)?.async(textResultType);
        if (queryTableXmlString === undefined) {
            throw new Error(queryTableNotFoundErr);
        }

        const newQueryTable: string = await updateQueryTablesInitialData(queryTableXmlString, tableData);
        zip.file(queryTableXmlPath, newQueryTable);

        const tableXmlString: string | undefined = await zip.file(tableXmlPath)?.async(textResultType);
        if (tableXmlString === undefined) {
            throw new Error(tableNotFoundErr);
        }

        const newTable: string = await updateTablesInitialData(tableXmlString, tableData);
        zip.file(tableXmlPath, newTable);

        const workbookXmlString = await zip.file(workbookXmlPath)?.async(textResultType);
        if (workbookXmlString === undefined) {
            throw new Error(sheetsNotFoundErr);
        }
        
        const newWorkbook:string = await updateWorkbookInitialData(workbookXmlString, tableData);
        zip.file(workbookXmlPath, newWorkbook);
    };

const updateTablesInitialData = async (tableXmlString: string, tableData: TableData) : Promise<string> => {
        const parser: DOMParser = new DOMParser();
        const serializer: XMLSerializer = new XMLSerializer();
        const tableDoc: Document = parser.parseFromString(tableXmlString, xmlTextResultType);
        const tableColumns: Element = tableDoc.getElementsByTagName(element.tableColumns)[0];
        tableColumns.textContent = "";
        tableData.columnMetadata.forEach((col: ColumnMetadata, columnIndex: number) => {
            const tableColumn: Element = tableDoc.createElementNS(tableDoc.documentElement.namespaceURI, element.tableColumn);
            tableColumn.setAttribute(elementAttributes.id, (columnIndex + 1).toString());
            tableColumn.setAttribute(elementAttributes.uniqueName, (columnIndex + 1).toString());
            tableColumn.setAttribute(elementAttributes.name, col.name);
            tableColumn.setAttribute(elementAttributes.queryTableFieldId, (columnIndex + 1).toString());
            tableColumns.appendChild(tableColumn);
            tableColumn.setAttribute(elementAttributes.xr3uid, "{" + v4().toUpperCase() + "}");
        });

        tableColumns.setAttribute(elementAttributes.count, tableData.columnMetadata.length.toString());
        tableDoc
            .getElementsByTagName(element.table)[0]
            .setAttribute(
                elementAttributes.reference,
                `A1:${documentUtils.getCellReferenceRelative(
                    tableData.columnMetadata.length - 1,
                    tableData.rows.length + 1
                )}`
            );
        tableDoc
            .getElementsByTagName(element.autoFilter)[0]
            .setAttribute(
                elementAttributes.reference,
                `A1:${documentUtils.getCellReferenceRelative(
                    tableData.columnMetadata.length - 1,
                    tableData.rows.length + 1
                )}`
            );
        
        return serializer.serializeToString(tableDoc);
    }

    const updateWorkbookInitialData = async (workbookXmlString: string, tableData: TableData, queryName?: string) : Promise<string> => {
        const newParser: DOMParser = new DOMParser();
        const newSerializer: XMLSerializer = new XMLSerializer();
        const workbookDoc: Document = newParser.parseFromString(workbookXmlString, xmlTextResultType);
        var definedName: Element = workbookDoc.getElementsByTagName(element.definedName)[0];
        const prefix = queryName === undefined ? defaults.queryName : queryName;
        definedName.textContent =
            prefix +
            `!$A$1:${documentUtils.getCellReferenceAbsolute(tableData.columnMetadata.length - 1, tableData.rows.length + 1)}`;
        
        return newSerializer.serializeToString(workbookDoc);
    }

    const updateQueryTablesInitialData = async (queryTableXmlString: string, tableData: TableData) : Promise<string> => {
        const parser: DOMParser = new DOMParser();
        const serializer: XMLSerializer = new XMLSerializer();
        const queryTableDoc: Document = parser.parseFromString(queryTableXmlString, xmlTextResultType);
        const queryTableFields: Element = queryTableDoc.getElementsByTagName(element.queryTableFields)[0];
        queryTableFields.textContent = "";
        tableData.columnMetadata.forEach((col: ColumnMetadata, columnIndex: number) => {
            const queryTableField: Element = queryTableDoc.createElementNS(
                queryTableDoc.documentElement.namespaceURI,
                element.queryTableField
            );
            queryTableField.setAttribute(elementAttributes.id, (columnIndex + 1).toString());
            queryTableField.setAttribute(elementAttributes.name, col.name);
            queryTableField.setAttribute(elementAttributes.tableColumnId, (columnIndex + 1).toString());
            queryTableFields.appendChild(queryTableField);
        });
        queryTableFields.setAttribute(elementAttributes.count, tableData.columnMetadata.length.toString());
        queryTableDoc
            .getElementsByTagName(element.queryTableRefresh)[0]
            .setAttribute(elementAttributes.nextId, (tableData.columnMetadata.length + 1).toString());
        
        return serializer.serializeToString(queryTableDoc);
    }

    const updateSheetsInitialData = async(sheetsXmlString: string, tableData: TableData) : Promise<string> => {
        const parser: DOMParser = new DOMParser();
        const serializer: XMLSerializer = new XMLSerializer();
        const sheetsDoc: Document = parser.parseFromString(sheetsXmlString, xmlTextResultType);
        const sheetData: Element = sheetsDoc.getElementsByTagName(element.sheetData)[0];
        sheetData.textContent = "";
        var rowIndex: number = 0;
        const columnRow: Element = sheetsDoc.createElementNS(sheetsDoc.documentElement.namespaceURI, element.row);
        columnRow.setAttribute(elementAttributes.row, (rowIndex + 1).toString());
        columnRow.setAttribute(elementAttributes.spans, "1:" + tableData.columnMetadata.length);
        columnRow.setAttribute(elementAttributes.x14acDyDescent, "0.3");
        tableData.columnMetadata.forEach((col, colIndex) => {
            columnRow.appendChild(documentUtils.createCell(sheetsDoc, colIndex, rowIndex, DataTypes.string, col.name));
        });
        sheetData.appendChild(columnRow);
        rowIndex++;
        tableData.rows.forEach((row) => {
            const newRow = sheetsDoc.createElementNS(sheetsDoc.documentElement.namespaceURI, element.row);
            newRow.setAttribute(elementAttributes.row, (rowIndex + 1).toString());
            newRow.setAttribute(elementAttributes.spans, "1:" + row.length);
            newRow.setAttribute(elementAttributes.x14acDyDescent, "0.3");
            row.forEach((cellContent, colIndex) => {
                newRow.appendChild(
                    documentUtils.createCell(
                        sheetsDoc,
                        colIndex,
                        rowIndex,
                        tableData.columnMetadata[colIndex].type,
                        cellContent
                    )
                );
            });
            sheetData.appendChild(newRow);
            rowIndex++;
        });

        sheetsDoc
            .getElementsByTagName(element.dimension)[0]
            .setAttribute(elementAttributes.reference, documentUtils.getTableReference(tableData.rows[0].length - 1, tableData.rows.length));
        
        return serializer.serializeToString(sheetsDoc);
    }

export default {
    updateTableInitialDataIfNeeded
};