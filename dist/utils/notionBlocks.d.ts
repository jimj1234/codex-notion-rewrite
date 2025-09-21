import { BlockObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
export type ExpandedBlock = BlockObjectResponse & {
    children: ExpandedBlock[];
};
export declare const fetchBlockChildren: (blockId: string) => Promise<BlockObjectResponse[]>;
export declare const expandBlocks: (blocks: BlockObjectResponse[]) => Promise<ExpandedBlock[]>;
export declare const blocksToMarkdown: (blocks: ExpandedBlock[]) => string;
export declare const richTextToPlain: (richText?: RichTextItemResponse[]) => string;
//# sourceMappingURL=notionBlocks.d.ts.map