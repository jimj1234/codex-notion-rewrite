import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

export type BlockSpec =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'heading_1' | 'heading_2' | 'heading_3';
      text: string;
    }
  | {
      type: 'bulleted_list_item' | 'numbered_list_item';
      text: string;
      children?: BlockSpec[];
    }
  | {
      type: 'toggle';
      title: string;
      children?: BlockSpec[];
    }
  | {
      type: 'quote';
      text: string;
    }
  | {
      type: 'callout';
      text: string;
      icon?: string;
    }
  | {
      type: 'code';
      text: string;
      language?: string;
    };

const textToRichText = (text: string) => [
  {
    type: 'text',
    text: { content: text },
  },
];

const mapChildren = (children?: BlockSpec[]) => (children ? children.map(convertSpecToBlock) : undefined);

function convertSpecToBlock(spec: BlockSpec): BlockObjectRequest {
  switch (spec.type) {
    case 'paragraph':
      return {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: textToRichText(spec.text) as any,
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
      } as BlockObjectRequest;
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return {
        object: 'block',
        type: spec.type,
        [spec.type]: {
          rich_text: textToRichText(spec.text) as any,
          children: mapChildren(spec.children) as any,
        },
      } as BlockObjectRequest;
    case 'toggle':
      return {
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: textToRichText(spec.title) as any,
          children: mapChildren(spec.children) as any,
        },
      };
    case 'quote':
      return {
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: textToRichText(spec.text) as any,
        },
      };
    case 'callout':
      return {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: textToRichText(spec.text) as any,
          icon: spec.icon ? ({ type: 'emoji', emoji: spec.icon } as any) : undefined,
        },
      } as BlockObjectRequest;
    case 'code':
      return {
        object: 'block',
        type: 'code',
        code: {
          rich_text: textToRichText(spec.text) as any,
          language: (spec.language ?? 'plain text') as any,
        },
      };
    default: {
      const exhaustive: never = spec;
      return exhaustive;
    }
  }
}

export const blockSpecsToNotionBlocks = (specs: BlockSpec[]): BlockObjectRequest[] => specs.map(convertSpecToBlock);
