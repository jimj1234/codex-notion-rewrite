interface NotionWebhookEvent {
    id: string;
    type: string;
    created_time: string;
    data: Record<string, unknown>;
}
interface NotionWebhookBody {
    event_id: string;
    created_time: string;
    payload: {
        type: string;
        events: NotionWebhookEvent[];
    };
}
export declare const handleNotionWebhook: (payload: NotionWebhookBody) => Promise<void>;
export {};
//# sourceMappingURL=notionWebhookService.d.ts.map