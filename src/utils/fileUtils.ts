import { createDocxBlob, extractTextFromDocx } from './docxUtils';

const TEXT_PLAIN_MIME = 'text/plain';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const KNOWN_DOWNLOAD_BASE_EXT_RE = /\.(txt|md|docx)$/i;

const TXT_EXT_RE = /\.txt$/i;
const DOCX_EXT_RE = /\.docx$/i;

const makeTimestampedBaseName = () =>
  `ai-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

const toDownloadFileName = (filename: string | undefined, extension: 'md' | 'docx') => {
  const rawName = filename?.trim();
  const normalizedName = rawName ? rawName.replace(KNOWN_DOWNLOAD_BASE_EXT_RE, '') : '';
  const baseName = normalizedName || makeTimestampedBaseName();
  return `${baseName}.${extension}`;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
};

export const isTextInputFile = (file: File) =>
  file.type === TEXT_PLAIN_MIME || TXT_EXT_RE.test(file.name);

export const isDocxInputFile = (file: File) =>
  file.type === DOCX_MIME || DOCX_EXT_RE.test(file.name);

export const isSupportedInputFile = (file: File) => isTextInputFile(file) || isDocxInputFile(file);

export const extractTextFromFile = async (file: File) => {
  if (isDocxInputFile(file)) {
    return extractTextFromDocx(await file.arrayBuffer());
  }

  if (isTextInputFile(file)) {
    return file.text();
  }

  throw new Error('Unsupported file type. Use .txt or .docx files.');
};

export const downloadAsMarkdown = (content: string, filename?: string): void => {
  const blob = new Blob([content], { type: 'text/markdown' });
  triggerDownload(blob, toDownloadFileName(filename, 'md'));
};

export const downloadAsDocx = (content: string, filename?: string): void => {
  const blob = createDocxBlob(content);
  triggerDownload(blob, toDownloadFileName(filename, 'docx'));
};

export const downloadProcessedFile = (
  content: string,
  filename: string | undefined,
  format: 'markdown' | 'docx',
) => {
  if (format === 'docx') {
    downloadAsDocx(content, filename);
    return;
  }

  downloadAsMarkdown(content, filename);
};
