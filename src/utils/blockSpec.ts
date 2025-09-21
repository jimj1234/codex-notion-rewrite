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

const sanitizeText = (value: string | undefined): string => {
  const trimmed = (value ?? '').toString();
  // Notion rejects empty rich_text; use a single space as minimal content
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : ' ';
};

const textToRichText = (text: string) => [
  {
    type: 'text',
    text: { content: sanitizeText(text) },
  },
];

const mapChildren = (children?: BlockSpec[]) => (children ? children.map(convertSpecToBlock) : undefined);

const getSpecDisplayText = (spec: BlockSpec): string => {
  switch (spec.type) {
    case 'paragraph':
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'quote':
    case 'callout':
    case 'code':
      return (spec as any).text ?? '';
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return (spec as any).text ?? '';
    case 'toggle':
      return (spec as any).title ?? '';
    default:
      return '';
  }
};

const deriveToggleTitle = (children?: BlockSpec[]): string => {
  if (!children || children.length === 0) {
    return 'Details';
  }
  // Prefer first heading text if present
  const heading = children.find((c) => c.type === 'heading_1' || c.type === 'heading_2' || c.type === 'heading_3');
  const candidate: BlockSpec | undefined = heading ?? children.find((c) => getSpecDisplayText(c).trim().length > 0) ?? children[0];
  const raw = candidate ? getSpecDisplayText(candidate).trim() : '';
  const title = raw.length > 0 ? raw : 'Details';
  return title.slice(0, 120);
};

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
      // Ensure toggle has a visible title; derive from children if missing
      {
        const provided = (spec as any).title as string | undefined;
        const finalTitle = (provided && provided.trim().length > 0)
          ? provided
          : deriveToggleTitle(spec.children);
      return {
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: textToRichText(finalTitle) as any,
          children: mapChildren(spec.children) as any,
        },
      };
      }
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
