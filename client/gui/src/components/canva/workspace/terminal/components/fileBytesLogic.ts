export type DownloadExtras = {
  download_bytes: boolean;
  download_name?: string;
  download_output?: string;
  download_source?: string;
};

const extractPath = (afterFileFlag: string): string | null => {
  if (afterFileFlag.startsWith('"')) {
    const end = afterFileFlag.indexOf('"', 1);
    return end === -1 ? null : afterFileFlag.slice(1, end);
  }
  if (afterFileFlag.startsWith("'")) {
    const end = afterFileFlag.indexOf("'", 1);
    return end === -1 ? null : afterFileFlag.slice(1, end);
  }
  const spaceIndex = afterFileFlag.search(/\s/);
  return spaceIndex === -1 ? afterFileFlag : afterFileFlag.slice(0, spaceIndex);
};

const outputDestinationMessage = (detail: string, lowercase = true) =>
  `Output destination: ${lowercase ? `${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : detail}`;

const extractOutputPath = (input: string): string | null => {
  for (const flag of ['--output', '-o']) {
    const match = input.match(new RegExp(`(?:^|\\s)${flag}\\s+`, 'i'));
    if (!match || match.index === undefined) continue;
    const outputPath = extractPath(input.slice(match.index + match[0].length));
    if (outputPath) return outputPath;
  }
  return null;
};

const extractFilePath = (input: string): string | null => {
  for (const flag of ['--file', '-f']) {
    const escaped = flag.replace(/-/g, '\\-');
    const match = input.match(new RegExp(`(?:^|\\s)${escaped}\\s+`, 'i'));
    if (!match || match.index === undefined) continue;
    const filePath = extractPath(input.slice(match.index + match[0].length));
    if (filePath) return filePath;
  }
  return null;
};

export const fileBytesLogic = {
  async prepare(input: string) {
    let processedCmd = input;
    let downloadExtras: DownloadExtras = { download_bytes: false };
    let uploadPath: string | undefined;

    if (!input || !window.electronAPI || /\s--__tmp_file_bytes__(?:\s|$)/.test(input)) {
      return { processedCmd, downloadExtras, uploadPath };
    }

    const lower = input.toLowerCase();
    for (const commandName of ['inj shellcode', 'inj dll-reflective', 'inj donut', 'shellcode', 'dotnet', 'bof', 'upload', 'download', 'load-dll']) {
      if (!lower.startsWith(commandName)) continue;
      const filePath = extractFilePath(input.slice(commandName.length));
      if (!filePath) continue;

      if (commandName === 'download') {
        // ======= download =======
        downloadExtras = {
          download_bytes: true,
          download_name: filePath.split(/[/\\]/).filter(Boolean).pop() ?? 'download',
          download_output: extractOutputPath(input) ?? undefined,
          download_source: filePath,
        };
        // =======================
      } else if (commandName === 'upload') {
        uploadPath = filePath;
      } else {
        // ============= normal ============
        const readResult = await window.electronAPI.invoke('file:readBytes', filePath) as
          | string
          | { error: string };
        if (readResult && typeof readResult === 'object' && 'error' in readResult) {
          // console.warn('[file:readBytes]', filePath, readResult.error);
          throw new Error(readResult.error);
        }
        processedCmd = `${input} --__tmp_file_bytes__ ${readResult}`;
      }
      break;
    }

    return { processedCmd, downloadExtras, uploadPath };
  },

  async saveDownload(output: unknown, extras: DownloadExtras): Promise<string> {
    // ======= download =======
    const streamed =
      output &&
      typeof output === 'object' &&
      (output as { download_path?: string }).download_path;
    if (streamed) {
      const path = (output as { download_path: string }).download_path;
      if (extras.download_output) return outputDestinationMessage(extras.download_output, false);
      return `File downloaded successfully (${path})`;
    }
    let raw = (typeof output === 'string' ? output : String(output ?? '')).trim();
    if (extras.download_bytes) {
      raw = raw.replace(/\s/g, '');
    }
    if (!raw || !window.electronAPI) return 'Error decoding file bytes';
    try {
      atob(raw);
      const saved = await window.electronAPI.invoke('file:saveBytes', {
        defaultName: extras.download_name ?? 'download',
        base64: raw,
        outputPath: extras.download_output,
      }) as boolean;
      if (!saved) return '';
      if (extras.download_output) return outputDestinationMessage(extras.download_output, false);
      return 'File downloaded successfully';
    } catch (error) {
      if (extras.download_output && error instanceof Error) {
        return outputDestinationMessage(error.message);
      }
      return 'Error decoding file bytes';
    }
    // =======================
  },
};
