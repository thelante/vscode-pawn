import {
    TextDocument, CompletionItem, CompletionItemKind, Definition, Location, MarkedString, Hover, SignatureHelp, Position,
    ParameterInformation,
    CompletionParams
} from "vscode-languageserver";
import { findFunctionIdentifier, positionToIndex, findIdentifierAtCursor } from "./common";

interface PawnFunction {
    textDocument: TextDocument;
    completion: CompletionItem;
    definition: Definition;
    params?: ParameterInformation[];
}
let pawnFuncCollection: Map<string, PawnFunction> = new Map();


export const parseDefine = (textDocument: TextDocument) => {
    const regexDefine = /^#define\s([A-Za-z_]*?)($|\s)/gm;
    const content = textDocument.getText();
    const splitContent = content.split('\n');
    splitContent.forEach((cont: string, index: number) => {
        var m;
        do {
            m = regexDefine.exec(cont);
            if (m) {
                const newSnip: CompletionItem = {
                    label: m[1],
                    kind: CompletionItemKind.Text,
                    insertText: m[1]
                };
                const newDef: Definition = Location.create(textDocument.uri, {
                    start: { line: index, character: m.input.indexOf(m[1]) },
                    end: { line: index, character: m.input.indexOf(m[1]) + m[1].length }

                });
                const pwnFun: PawnFunction = {
                    textDocument: textDocument,
                    completion: newSnip,
                    definition: newDef
                };
                const findSnip = pawnFuncCollection.get(m[1]);
                if (findSnip === undefined) pawnFuncCollection.set(m[1], pwnFun);
            }
        } while (m);
    });
};

export const parsefuncs = (textDocument: TextDocument) => {
    const regex = /^(forward|native|stock)\s(.*?)\((.*?)\)/gm;
    const content = textDocument.getText();
    const splitContent = content.split('\n');
    splitContent.forEach((cont: string, index: number) => {
        var m;
        do {
            m = regex.exec(cont);
            if (m) {
                let doc: string = '';
                let endDoc = -1;
                if (splitContent[index - 1] !== undefined) endDoc = splitContent[index - 1].indexOf('*/');
                if (endDoc !== -1) {
                    let startDoc = -1;
                    let inNum = index;
                    while (inNum >= 0) {
                        inNum--;
                        if (splitContent[inNum] === undefined) continue;
                        startDoc = splitContent[inNum].indexOf('/*');
                        if (startDoc !== -1) {
                            if (inNum === index) {
                                doc = splitContent[index];
                            } else if (inNum < index) {
                                while (inNum < index) {
                                    doc += splitContent[inNum] + '\n\n';
                                    inNum++;

                                }
                            }
                            break;
                        }
                    }
                }
                doc = doc.replace('/*', '').replace('*/', '').trim();
                const newSnip: CompletionItem = {
                    label: m[2] + '(' + m[3] + ')',
                    kind: CompletionItemKind.Function,
                    insertText: m[2] + '(' + m[3] + ')',
                    documentation: doc,
                };
                const newDef: Definition = Location.create(textDocument.uri, {
                    start: { line: index, character: m.input.indexOf(m[2]) },
                    end: { line: index, character: m.input.indexOf(m[2]) + m[2].length }

                });
                let params: ParameterInformation[] = [];
                if (m[3].trim().length > 0) {
                    params = m[3].split(',').map((value) => ({ label: value.trim() }));
                } else {
                    params = [];
                }
                const pwnFun: PawnFunction = {
                    textDocument: textDocument,
                    definition: newDef,
                    completion: newSnip,
                    params
                };
                const indexPos = m[2].indexOf(':');
                if (indexPos !== -1) {
                    const resOut = /:(.*)/gm.exec(m[2]);
                    if (resOut) m[2] = resOut[1];
                }
                const findSnip = pawnFuncCollection.get(m[2]);
                if (findSnip === undefined) pawnFuncCollection.set(m[2], pwnFun);
            }
        } while (m);
    });
};

let pawnWords: Map<string, CompletionItem[]> = new Map();

export const parseWords = (textDocument: TextDocument) => {
    const regex = /[A-Za-z_]+/gm;
    const content = textDocument.getText();
    const splitContent = content.split('\n');
    const words: string[] = [];
    const wordCompletion: CompletionItem[] = [];
    splitContent.forEach((cont: string, index: number) => {
        var m;
        do {
            m = regex.exec(cont);
            if (m) {
                if (words.indexOf(m[0]) === -1) words.push(m[0]);
            }
        } while (m);
    });
    for (const key in words) {
        if (words.hasOwnProperty(key)) {
            const element = words[key];
            const newSnip: CompletionItem = {
                label: element,
                kind: CompletionItemKind.Text,
                insertText: element
            };
            wordCompletion.push(newSnip);
        }
    }

    const findSnip = pawnWords.get(textDocument.uri);
    if (findSnip === undefined) pawnWords.set(textDocument.uri, wordCompletion);
};

export const parseSnippets = async (textDocument: TextDocument) => {
    pawnFuncCollection.forEach((value: PawnFunction, key: string) => {
        if (value.textDocument.uri === textDocument.uri) pawnFuncCollection.delete(key);
    });
    const findSnip = pawnWords.get(textDocument.uri);
    if (findSnip !== undefined) { pawnWords.delete(textDocument.uri); }
    parseDefine(textDocument);
    parsefuncs(textDocument);
    parseWords(textDocument);
};

export const doCompletion = async (params: CompletionParams) => {
    const comItems: CompletionItem[] = [];
    pawnFuncCollection.forEach(res => comItems.push(res.completion));
    const findSnip = pawnWords.get(params.textDocument.uri);
    if (findSnip !== undefined) {
        findSnip.forEach(res => comItems.push(res));
    }
    return comItems;
};

export const doCompletionResolve = async (item: CompletionItem) => {
    return item;
};

export const doHover = (document: TextDocument, position: Position): Hover | undefined => {
    const cursorIndex = positionToIndex(document.getText(), position);
    const result = findIdentifierAtCursor(document.getText(), cursorIndex);
    const snip = pawnFuncCollection.get(result.identifier);
    if (snip === undefined) return undefined;
    let c: MarkedString[] = [];
    if (snip.completion.label !== undefined) c.push(`${snip.completion.label}`);
    if (snip.completion.documentation !== undefined) c.push(`${snip.completion.documentation}`);
    return {
        contents: c
    };
};

export const doSignHelp = (document: TextDocument, position: Position): SignatureHelp | undefined => {
    const cursorIndex = positionToIndex(document.getText(), position);
    const result = findFunctionIdentifier(document.getText(), cursorIndex);
    if (result.identifier === '') return undefined;
    const snip = pawnFuncCollection.get(result.identifier);
    if (snip === undefined) return undefined;
    let c: MarkedString[] = [];
    if (snip.completion.label !== undefined) c.push(`# ${snip.completion.label}`);
    if (snip.completion.documentation !== undefined) c.push(`${snip.completion.documentation}`);
    return {
        activeParameter: 0,
        activeSignature: 0,
        signatures: [{
            label: snip.completion.label,
            parameters: snip.params,
            documentation: snip.completion.documentation
        }]
    };
};

export const doGoToDef = (document: TextDocument, position: Position) => {
    const cursorIndex = positionToIndex(document.getText(), position);
    const result = findIdentifierAtCursor(document.getText(), cursorIndex);
    const snip = pawnFuncCollection.get(result.identifier);
    if (snip === undefined) return;
    return snip.definition;
};