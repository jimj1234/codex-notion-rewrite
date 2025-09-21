import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
export type BlockSpec = {
    type: 'paragraph';
    text: string;
} | {
    type: 'heading_1' | 'heading_2' | 'heading_3';
    text: string;
} | {
    type: 'bulleted_list_item' | 'numbered_list_item';
    text: string;
    children?: BlockSpec[];
} | {
    type: 'toggle';
    title: string;
    children?: BlockSpec[];
} | {
    type: 'quote';
    text: string;
} | {
    type: 'callout';
    text: string;
    icon?: string;
} | {
    type: 'code';
    text: string;
    language?: string;
};
export declare const blockSpecsToNotionBlocks: (specs: BlockSpec[]) => BlockObjectRequest[];
//# sourceMappingURL=blockSpec.d.ts.map