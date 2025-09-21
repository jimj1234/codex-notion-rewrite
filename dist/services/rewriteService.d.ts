export interface RewriteContext {
    pageId: string;
    pageTitle: string;
    rootBlockIds: string[];
    pageMarkdown: string;
    overrideInstructions?: string;
}
export declare const rewritePage: (context: RewriteContext) => Promise<void>;
//# sourceMappingURL=rewriteService.d.ts.map