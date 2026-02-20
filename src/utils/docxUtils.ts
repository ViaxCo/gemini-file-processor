const textDecoder = new TextDecoder();

const readUint16LE = (view: DataView, offset: number) => view.getUint16(offset, true);
const readUint32LE = (view: DataView, offset: number) => view.getUint32(offset, true);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let j = 0; j < 8; j++) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const ensureWithinBounds = (size: number, offset: number, length: number, message: string) => {
  if (offset < 0 || length < 0 || offset + length > size) {
    throw new Error(message);
  }
};

export const createDocxBlob = async (content: string) => {
  const { createDocxBlobFromMarkdown } = await import('./docxGeneration');
  return createDocxBlobFromMarkdown(content);
};

const findEndOfCentralDirectoryOffset = (bytes: Uint8Array) => {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const commentLength = readUint16LE(view, offset + 20);
      if (offset + 22 + commentLength !== bytes.length) {
        continue;
      }
      return offset;
    }
  }
  throw new Error('Invalid .docx file: missing ZIP directory');
};

const inflateRawDeflate = async (compressed: Uint8Array) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support .docx extraction');
  }

  const compressedBuffer = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(compressedBuffer).set(compressed);

  const stream = new Blob([compressedBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
};

const readZipEntries = async (arrayBuffer: ArrayBuffer) => {
  if (arrayBuffer.byteLength < 22) {
    throw new Error('Invalid .docx file: ZIP data is too short');
  }

  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectoryOffset(bytes);
  const diskNumber = readUint16LE(view, eocdOffset + 4);
  const startDiskNumber = readUint16LE(view, eocdOffset + 6);
  const recordsOnDisk = readUint16LE(view, eocdOffset + 8);
  const totalEntries = readUint16LE(view, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(view, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(view, eocdOffset + 16);

  if (diskNumber !== 0 || startDiskNumber !== 0 || recordsOnDisk !== totalEntries) {
    throw new Error('Unsupported .docx file: multi-disk ZIP packages are not supported');
  }

  ensureWithinBounds(
    bytes.length,
    centralDirectoryOffset,
    centralDirectorySize,
    'Invalid .docx file: ZIP central directory is out of bounds',
  );

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  let offset = centralDirectoryOffset;
  const files = new Map<string, Uint8Array>();

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > centralDirectoryEnd || readUint32LE(view, offset) !== 0x02014b50) {
      throw new Error('Invalid .docx file: corrupt ZIP entry');
    }

    const compressionMethod = readUint16LE(view, offset + 10);
    const generalPurposeBitFlag = readUint16LE(view, offset + 8);
    const expectedCrc = readUint32LE(view, offset + 16);
    const expectedUncompressedSize = readUint32LE(view, offset + 24);
    const compressedSize = readUint32LE(view, offset + 20);
    const fileNameLength = readUint16LE(view, offset + 28);
    const extraFieldLength = readUint16LE(view, offset + 30);
    const fileCommentLength = readUint16LE(view, offset + 32);
    const localHeaderOffset = readUint32LE(view, offset + 42);

    if ((generalPurposeBitFlag & 0x1) !== 0) {
      throw new Error('Unsupported .docx file: encrypted ZIP entries are not supported');
    }

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    ensureWithinBounds(
      bytes.length,
      fileNameStart,
      fileNameLength,
      'Invalid .docx file: corrupt ZIP filename entry',
    );
    const fileName = textDecoder.decode(bytes.subarray(fileNameStart, fileNameEnd));
    if (!fileName) {
      throw new Error('Invalid .docx file: ZIP entry has an empty filename');
    }

    ensureWithinBounds(
      bytes.length,
      localHeaderOffset,
      30,
      'Invalid .docx file: local ZIP header is out of bounds',
    );
    if (readUint32LE(view, localHeaderOffset) !== 0x04034b50) {
      throw new Error('Invalid .docx file: missing local ZIP header');
    }

    const localCompressionMethod = readUint16LE(view, localHeaderOffset + 8);
    const localNameLength = readUint16LE(view, localHeaderOffset + 26);
    const localExtraLength = readUint16LE(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    ensureWithinBounds(
      bytes.length,
      dataStart,
      compressedSize,
      'Invalid .docx file: ZIP entry data is out of bounds',
    );

    if (localCompressionMethod !== compressionMethod) {
      throw new Error('Invalid .docx file: ZIP compression metadata mismatch');
    }

    const compressedData = bytes.subarray(dataStart, dataEnd);
    let fileData: Uint8Array;

    if (compressionMethod === 0) {
      fileData = new Uint8Array(compressedData);
    } else if (compressionMethod === 8) {
      fileData = await inflateRawDeflate(compressedData);
    } else {
      throw new Error(`Unsupported .docx compression method: ${compressionMethod}`);
    }

    if (fileData.length !== expectedUncompressedSize) {
      throw new Error(`Invalid .docx file: ZIP entry size mismatch for "${fileName}"`);
    }

    const actualCrc = crc32(fileData);
    if (actualCrc !== expectedCrc) {
      throw new Error(`Invalid .docx file: ZIP CRC mismatch for "${fileName}"`);
    }

    files.set(fileName, fileData);
    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }

  if (offset > centralDirectoryEnd) {
    throw new Error('Invalid .docx file: ZIP central directory overflow');
  }

  return files;
};

export const extractTextFromDocx = async (arrayBuffer: ArrayBuffer) => {
  const entries = await readZipEntries(arrayBuffer);
  if (!entries.has('[Content_Types].xml') || !entries.has('_rels/.rels')) {
    throw new Error('Invalid .docx file: required package metadata is missing');
  }

  const documentXmlBytes = entries.get('word/document.xml');

  if (!documentXmlBytes) {
    throw new Error('Invalid .docx file: document.xml was not found');
  }

  const xml = textDecoder.decode(documentXmlBytes);
  if (typeof DOMParser === 'undefined') {
    throw new Error('This browser does not support .docx extraction');
  }

  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid .docx file: document.xml is malformed');
  }

  const paragraphNodes = Array.from(parsed.getElementsByTagNameNS('*', 'p'));
  const paragraphTexts = paragraphNodes.map((paragraph) => {
    let paragraphText = '';
    const walker = parsed.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null,
    );

    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const parentTag = current.parentElement?.localName;
        if (parentTag === 't' || parentTag === 'delText' || parentTag === 'instrText') {
          paragraphText += current.nodeValue || '';
        }
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        const tagName = (current as Element).localName;
        if (tagName === 'tab' || tagName === 'ptab') {
          paragraphText += '\t';
        } else if (tagName === 'br' || tagName === 'cr') {
          paragraphText += '\n';
        }
      }

      current = walker.nextNode();
    }

    return paragraphText;
  });

  const normalized = paragraphTexts
    .join('\n\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    throw new Error('No readable text found in this .docx file');
  }

  return normalized;
};
