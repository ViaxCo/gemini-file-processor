const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DOC_XML_NAMESPACES = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const ROOT_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CORE_PROP_REL_TYPE = `${ROOT_REL_NS}/metadata/core-properties`;
const OFFICE_DOC_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EXTENDED_PROP_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
const CORE_PROP_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
const DUBLIN_CORE_NS = 'http://purl.org/dc/elements/1.1/';
const DCTERMS_NS = 'http://purl.org/dc/terms/';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${ROOT_REL_NS}">
  <Relationship Id="rId1" Type="${OFFICE_DOC_REL_NS}/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="${OFFICE_DOC_REL_NS}/extended-properties" Target="docProps/app.xml"/>
  <Relationship Id="rId3" Type="${CORE_PROP_REL_TYPE}" Target="docProps/core.xml"/>
</Relationships>`;

const APP_PROPERTIES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="${EXTENDED_PROP_NS}" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>AI File Processor</Application>
</Properties>`;

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

const readUint16LE = (view: DataView, offset: number) => view.getUint16(offset, true);
const readUint32LE = (view: DataView, offset: number) => view.getUint32(offset, true);

const escapeXmlText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const createCorePropertiesXml = () => {
  const nowIso = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="${CORE_PROP_NS}" xmlns:dc="${DUBLIN_CORE_NS}" xmlns:dcterms="${DCTERMS_NS}" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="${XSI_NS}">
  <dc:title>AI Processed Document</dc:title>
  <dc:creator>AI File Processor</dc:creator>
  <cp:lastModifiedBy>AI File Processor</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`;
};

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
};

const ensureWithinBounds = (size: number, offset: number, length: number, message: string) => {
  if (offset < 0 || length < 0 || offset + length > size) {
    throw new Error(message);
  }
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

const buildDocumentXml = (content: string) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const paragraphXml = lines
    .map((line) => {
      if (!line) return '<w:p/>';
      const escaped = escapeXmlText(line);
      return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    })
    .join('');

  const body = paragraphXml || '<w:p/>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${DOC_XML_NAMESPACES}>
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
};

const createStoredZip = (entries: { name: string; data: Uint8Array }[]) => {
  if (entries.length > 0xffff) {
    throw new Error('Too many files for ZIP32 package');
  }

  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    if (entry.data.length > 0xffffffff) {
      throw new Error(`ZIP entry too large: ${entry.name}`);
    }
    if (localOffset > 0xffffffff) {
      throw new Error('ZIP package is too large');
    }

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    localChunks.push(localHeader, entry.data);
    centralChunks.push(centralHeader);

    localOffset += localHeader.length + entry.data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const localData = concatBytes(localChunks);
  if (centralDirectory.length > 0xffffffff || localData.length > 0xffffffff) {
    throw new Error('ZIP package is too large');
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirectory.length, true);
  eocdView.setUint32(16, localData.length, true);
  eocdView.setUint16(20, 0, true);

  return concatBytes([localData, centralDirectory, eocd]);
};

export const createDocxBlob = (content: string) => {
  const documentXml = buildDocumentXml(content);
  const corePropertiesXml = createCorePropertiesXml();
  const zipBytes = createStoredZip([
    {
      name: '[Content_Types].xml',
      data: textEncoder.encode(CONTENT_TYPES_XML),
    },
    {
      name: '_rels/.rels',
      data: textEncoder.encode(ROOT_RELS_XML),
    },
    {
      name: 'docProps/app.xml',
      data: textEncoder.encode(APP_PROPERTIES_XML),
    },
    {
      name: 'docProps/core.xml',
      data: textEncoder.encode(corePropertiesXml),
    },
    {
      name: 'word/document.xml',
      data: textEncoder.encode(documentXml),
    },
  ]);

  return new Blob([zipBytes], {
    type: DOCX_MIME_TYPE,
  });
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
