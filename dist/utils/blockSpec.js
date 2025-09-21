"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockSpecsToNotionBlocks = void 0;
const textToRichText = (text) => [
    {
        type: 'text',
        text: { content: text },
    },
];
const mapChildren = (children) => (children ? children.map(convertSpecToBlock) : undefined);
function convertSpecToBlock(spec) {
    switch (spec.type) {
        case 'paragraph':
            return {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: textToRichText(spec.text),
                },
            };
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
            return {
                object: 'block',
                type: spec.type,
                [spec.type]: {
                    rich_text: textToRichText(spec.text),
                },
            };
        case 'bulleted_list_item':
        case 'numbered_list_item':
            return {
                object: 'block',
                type: spec.type,
                [spec.type]: {
                    rich_text: textToRichText(spec.text),
                    children: mapChildren(spec.children),
                },
            };
        case 'toggle':
            return {
                object: 'block',
                type: 'toggle',
                toggle: {
                    rich_text: textToRichText(spec.title),
                    children: mapChildren(spec.children),
                },
            };
        case 'quote':
            return {
                object: 'block',
                type: 'quote',
                quote: {
                    rich_text: textToRichText(spec.text),
                },
            };
        case 'callout':
            return {
                object: 'block',
                type: 'callout',
                callout: {
                    rich_text: textToRichText(spec.text),
                    icon: spec.icon ? { type: 'emoji', emoji: spec.icon } : undefined,
                },
            };
        case 'code':
            return {
                object: 'block',
                type: 'code',
                code: {
                    rich_text: textToRichText(spec.text),
                    language: (spec.language ?? 'plain text'),
                },
            };
        default: {
            const exhaustive = spec;
            return exhaustive;
        }
    }
}
const blockSpecsToNotionBlocks = (specs) => specs.map(convertSpecToBlock);
exports.blockSpecsToNotionBlocks = blockSpecsToNotionBlocks;
//# sourceMappingURL=blockSpec.js.map