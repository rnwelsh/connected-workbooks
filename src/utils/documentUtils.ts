// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import JSZip from "jszip";
import { docPropsCoreXmlPath, docPropsRootElement } from "../constants";
import { DataTypes } from "../types";

const createOrUpdateProperty = (doc: Document, parent: Element, property: string, value?: string | null): void => {
    if (value === undefined) {
        return;
    }

    const elements = parent.getElementsByTagName(property);

    if (elements?.length === 0) {
        const newElement = doc.createElement(property);
        newElement.textContent = value;
        parent.appendChild(newElement);
    } else if (elements.length > 1) {
        throw new Error(`Invalid DocProps core.xml, multiple ${property} elements`);
    } else if (elements?.length > 0) {
        elements[0]!.textContent = value;
    }
};

const getDocPropsProperties = async (zip: JSZip): Promise<{ doc: Document; properties: Element }> => {
    const docPropsCoreXmlString = await zip.file(docPropsCoreXmlPath)?.async("text");
    if (docPropsCoreXmlString === undefined) {
        throw new Error("DocProps core.xml was not found in template");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(docPropsCoreXmlString, "text/xml");

    const properties = doc.getElementsByTagName(docPropsRootElement).item(0);
    if (properties === null) {
        throw new Error("Invalid DocProps core.xml");
    }

    return { doc, properties };
};

const getCellReferenceAbsolute = (col: number, row: number): string => {
    // 65 is the ascii value of first column 'A'
    return "$" + String.fromCharCode(col + 65) + "$" + row.toString();
};

const getCellReferenceRelative = (col: number, row: number): string => {
    // 65 is the ascii value of first column 'A'
    return String.fromCharCode(col + 65) + row.toString();
};

const getTableReference = (numberOfCols: number, numberOfRows: number) => {
    return `A1:${getCellReferenceRelative(numberOfCols, numberOfRows)}`;
};

const createCellElement = (doc: Document, colIndex: number, rowIndex: number, dataType: DataTypes, data: string) => {
    const cell: Element = doc.createElementNS(doc.documentElement.namespaceURI, "c");
    cell.setAttribute("r", getCellReferenceRelative(colIndex, rowIndex + 1));
    const cellData: Element = doc.createElementNS(doc.documentElement.namespaceURI, "v");
    updateCellData(dataType, data, cell, cellData);
    cell.appendChild(cellData);
    
    return cell;
};

const updateCellData = (dataType: DataTypes, data: string, cell: Element, cellData: Element) => {
    switch(dataType) {
    case DataTypes.string:
        cell.setAttribute("t", "str");
        break;
    case DataTypes.number:
        cell.setAttribute("t", "1");
        break;
    case DataTypes.boolean:
        cell.setAttribute("t", "b");
        break;
    }
    cellData.textContent = data;
};

export default { createOrUpdateProperty, getDocPropsProperties, getCellReferenceRelative, getCellReferenceAbsolute, createCell: createCellElement, getTableReference };
