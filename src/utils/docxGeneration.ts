import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from 'docx';
import MarkdownIt from 'markdown-it';

const markdownParser = new MarkdownIt({
  breaks: true,
  linkify: true,
});

type MarkdownToken = ReturnType<MarkdownIt['parse']>[number];
type ListState =
  | { kind: 'bullet' }
  | {
      kind: 'ordered';
      reference: string;
      instance: number;
    };

type InlineStyle = {
  bold: boolean;
  italics: boolean;
  strike: boolean;
  code: boolean;
  link: string | null;
};

type InlinePart =
  | {
      kind: 'text';
      text: string;
      style: InlineStyle;
    }
  | {
      kind: 'break';
      style: InlineStyle;
    };

const DEFAULT_INLINE_STYLE: InlineStyle = {
  bold: false,
  italics: false,
  strike: false,
  code: false,
  link: null,
};

const ORDERED_NUMBERING_REFERENCE = 'markdown-ordered-list-default';
const ORDERED_NUMBERING_MAX_LEVEL = 8;

const createOrderedNumberingLevels = (targetLevel = -1, startAt = 1) =>
  Array.from({ length: ORDERED_NUMBERING_MAX_LEVEL + 1 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    start: level === targetLevel ? startAt : 1,
    style: {
      paragraph: {
        indent: {
          left: 720 + level * 360,
          hanging: 260,
        },
      },
    },
  }));

const HEADING_LEVELS = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const stripHtmlTags = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeLink = (href: string | null | undefined) => {
  if (!href) return null;
  try {
    const parsed = new URL(href, 'https://example.invalid');
    if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return href;
  } catch {
    return null;
  }
};

const parseInlinePartsRange = (
  tokens: MarkdownToken[],
  startIndex: number,
  style: InlineStyle,
  stopType?: string,
): [InlinePart[], number] => {
  const parts: InlinePart[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      index++;
      continue;
    }

    if (stopType && token.type === stopType) {
      return [parts, index + 1];
    }

    switch (token.type) {
      case 'text':
        if (token.content) {
          parts.push({ kind: 'text', text: token.content, style });
        }
        index++;
        break;
      case 'html_inline': {
        const content = stripHtmlTags(token.content);
        if (content) {
          parts.push({ kind: 'text', text: content, style });
        }
        index++;
        break;
      }
      case 'code_inline':
        parts.push({
          kind: 'text',
          text: token.content,
          style: { ...style, code: true },
        });
        index++;
        break;
      case 'softbreak':
      case 'hardbreak':
        parts.push({ kind: 'break', style });
        index++;
        break;
      case 'image': {
        const altText = token.content?.trim();
        const src = token.attrGet('src');
        const imageText = altText || src || 'image';
        parts.push({ kind: 'text', text: `[Image: ${imageText}]`, style });
        index++;
        break;
      }
      case 'strong_open': {
        const [innerParts, nextIndex] = parseInlinePartsRange(
          tokens,
          index + 1,
          {
            ...style,
            bold: true,
          },
          'strong_close',
        );
        parts.push(...innerParts);
        index = nextIndex;
        break;
      }
      case 'em_open': {
        const [innerParts, nextIndex] = parseInlinePartsRange(
          tokens,
          index + 1,
          {
            ...style,
            italics: true,
          },
          'em_close',
        );
        parts.push(...innerParts);
        index = nextIndex;
        break;
      }
      case 's_open': {
        const [innerParts, nextIndex] = parseInlinePartsRange(
          tokens,
          index + 1,
          {
            ...style,
            strike: true,
          },
          's_close',
        );
        parts.push(...innerParts);
        index = nextIndex;
        break;
      }
      case 'link_open': {
        const [innerParts, nextIndex] = parseInlinePartsRange(
          tokens,
          index + 1,
          {
            ...style,
            link: sanitizeLink(token.attrGet('href')),
          },
          'link_close',
        );
        parts.push(...innerParts);
        index = nextIndex;
        break;
      }
      default: {
        if (token.type.endsWith('_open')) {
          const closeType = token.type.replace(/_open$/, '_close');
          const [innerParts, nextIndex] = parseInlinePartsRange(
            tokens,
            index + 1,
            style,
            closeType,
          );
          parts.push(...innerParts);
          index = nextIndex;
          break;
        }

        if (token.type.endsWith('_close')) {
          index++;
          break;
        }

        if (token.content) {
          parts.push({ kind: 'text', text: token.content, style });
        }

        index++;
      }
    }
  }

  return [parts, index];
};

const parseInlineParts = (tokens: MarkdownToken[] | null | undefined) => {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const [parts] = parseInlinePartsRange(tokens, 0, DEFAULT_INLINE_STYLE);
  return parts;
};

const toTextRun = (part: InlinePart, isHyperlink: boolean) =>
  new TextRun({
    ...(part.kind === 'text' ? { text: part.text } : { break: 1 }),
    bold: part.style.bold || undefined,
    italics: part.style.italics || undefined,
    strike: part.style.strike || undefined,
    font: part.style.code ? 'Consolas' : undefined,
    ...(isHyperlink
      ? {
          color: '0563C1',
          underline: {
            type: UnderlineType.SINGLE,
          },
        }
      : {}),
  });

const inlinePartsToChildren = (parts: InlinePart[]) => {
  const children: Array<TextRun | ExternalHyperlink> = [];
  let activeLink: string | null = null;
  let linkRuns: TextRun[] = [];

  const flushLink = () => {
    if (activeLink && linkRuns.length > 0) {
      children.push(
        new ExternalHyperlink({
          link: activeLink,
          children: linkRuns,
        }),
      );
    }
    activeLink = null;
    linkRuns = [];
  };

  for (const part of parts) {
    const link = part.style.link;

    if (link) {
      if (activeLink !== link) {
        flushLink();
        activeLink = link;
      }
      linkRuns.push(toTextRun(part, true));
      continue;
    }

    flushLink();
    children.push(toTextRun(part, false));
  }

  flushLink();

  if (children.length === 0) {
    return [new TextRun('')];
  }

  return children;
};

const toHeadingLevel = (tag: string) => HEADING_LEVELS[tag as keyof typeof HEADING_LEVELS];

const getListLevel = (listStack: ListState[]) =>
  Math.max(0, Math.min(ORDERED_NUMBERING_MAX_LEVEL, listStack.length - 1));

const getListMarkerOptions = (listStack: ListState[]) => {
  if (listStack.length === 0) {
    return {};
  }

  const level = getListLevel(listStack);
  const topList = listStack[listStack.length - 1];

  if (topList?.kind === 'ordered') {
    return {
      numbering: {
        reference: topList.reference,
        level,
        instance: topList.instance,
      },
    };
  }

  return {
    bullet: {
      level,
    },
  };
};

const getListContinuationOptions = (listStack: ListState[]) => {
  if (listStack.length === 0) {
    return {};
  }

  const level = getListLevel(listStack);
  return {
    indent: {
      left: 720 + level * 360,
    },
  };
};

const getListParagraphOptions = (
  listStack: ListState[],
  listItemStack: Array<{ markerPending: boolean }>,
) => {
  if (listStack.length === 0) {
    return {};
  }

  const currentItem = listItemStack[listItemStack.length - 1];
  if (!currentItem) {
    return getListMarkerOptions(listStack);
  }

  if (currentItem.markerPending) {
    currentItem.markerPending = false;
    return getListMarkerOptions(listStack);
  }

  return getListContinuationOptions(listStack);
};

const getBlockquoteOptions = (blockquoteDepth: number) => {
  if (blockquoteDepth <= 0) {
    return {};
  }

  return {
    indent: {
      left: Math.min(8, blockquoteDepth) * 360,
    },
  };
};

const codeBlockToRuns = (content: string) => {
  const lines = content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (lines.length === 1 && lines[0] === '') {
    return [new TextRun('')];
  }

  return lines.map(
    (line, index) =>
      new TextRun({
        ...(index > 0 ? { break: 1 } : {}),
        text: line,
        font: 'Consolas',
      }),
  );
};

const normalizeOrderedListStart = (token: MarkdownToken) => {
  const rawStart = token.attrGet('start');
  if (!rawStart) {
    return 1;
  }

  const parsed = Number.parseInt(rawStart, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const getOrderedReferenceForList = (
  level: number,
  start: number,
  referenceByKey: Map<string, string>,
  numberingConfigs: Array<{
    reference: string;
    levels: ReturnType<typeof createOrderedNumberingLevels>;
  }>,
) => {
  if (start === 1) {
    if (!referenceByKey.has(ORDERED_NUMBERING_REFERENCE)) {
      referenceByKey.set(ORDERED_NUMBERING_REFERENCE, ORDERED_NUMBERING_REFERENCE);
      numberingConfigs.push({
        reference: ORDERED_NUMBERING_REFERENCE,
        levels: createOrderedNumberingLevels(),
      });
    }

    return ORDERED_NUMBERING_REFERENCE;
  }

  const key = `${level}:${start}`;
  const existingReference = referenceByKey.get(key);
  if (existingReference) {
    return existingReference;
  }

  const reference = `markdown-ordered-list-l${level}-s${start}`;
  referenceByKey.set(key, reference);
  numberingConfigs.push({
    reference,
    levels: createOrderedNumberingLevels(level, start),
  });
  return reference;
};

const buildMarkdownParagraphs = (content: string) => {
  const tokens = markdownParser.parse(content.replace(/\r\n/g, '\n'), {});
  const paragraphs: Paragraph[] = [];
  const listStack: ListState[] = [];
  const listItemStack: Array<{ markerPending: boolean }> = [];
  const numberingConfigs: Array<{
    reference: string;
    levels: ReturnType<typeof createOrderedNumberingLevels>;
  }> = [];
  const referenceByKey = new Map<string, string>();
  let orderedListInstance = 0;
  let blockquoteDepth = 0;

  const blockOptions = () => ({
    ...getListParagraphOptions(listStack, listItemStack),
    ...getBlockquoteOptions(blockquoteDepth),
  });

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) continue;

    if (token.type === 'bullet_list_open') {
      listStack.push({ kind: 'bullet' });
      continue;
    }

    if (token.type === 'ordered_list_open') {
      const level = Math.max(0, Math.min(ORDERED_NUMBERING_MAX_LEVEL, listStack.length));
      const start = normalizeOrderedListStart(token);
      const reference = getOrderedReferenceForList(level, start, referenceByKey, numberingConfigs);

      listStack.push({
        kind: 'ordered',
        reference,
        instance: orderedListInstance++,
      });
      continue;
    }

    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      if (listStack.length > 0) {
        listStack.pop();
      }
      continue;
    }

    if (token.type === 'list_item_open') {
      listItemStack.push({ markerPending: true });
      continue;
    }

    if (token.type === 'list_item_close') {
      if (listItemStack.length > 0) {
        listItemStack.pop();
      }
      continue;
    }

    if (token.type === 'blockquote_open') {
      blockquoteDepth++;
      continue;
    }

    if (token.type === 'blockquote_close') {
      blockquoteDepth = Math.max(0, blockquoteDepth - 1);
      continue;
    }

    if (token.type === 'heading_open') {
      const inlineToken = tokens[index + 1];
      const heading = toHeadingLevel(token.tag);
      const parts = parseInlineParts(inlineToken?.children);
      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          ...(heading ? { heading } : {}),
          children: inlinePartsToChildren(parts),
        }),
      );
      index += 2;
      continue;
    }

    if (token.type === 'paragraph_open') {
      const inlineToken = tokens[index + 1];
      const parts = parseInlineParts(inlineToken?.children);
      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          children: inlinePartsToChildren(parts),
        }),
      );
      index += 2;
      continue;
    }

    if (token.type === 'inline') {
      const parts = parseInlineParts(token.children);
      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          children: inlinePartsToChildren(parts),
        }),
      );
      continue;
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          children: codeBlockToRuns(token.content),
        }),
      );
      continue;
    }

    if (token.type === 'hr') {
      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          thematicBreak: true,
        }),
      );
      continue;
    }

    if (token.type === 'html_block') {
      const contentText = stripHtmlTags(token.content);
      if (!contentText) {
        continue;
      }

      paragraphs.push(
        new Paragraph({
          ...blockOptions(),
          children: [new TextRun(contentText)],
        }),
      );
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph(''));
  }

  return {
    paragraphs,
    numberingConfigs,
  };
};

export const createDocxBlobFromMarkdown = async (content: string) => {
  const { paragraphs, numberingConfigs } = buildMarkdownParagraphs(content);
  const document = new Document({
    numbering: {
      config: numberingConfigs,
    },
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBlob(document);
};
