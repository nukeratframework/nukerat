import { useEffect, useRef, useState } from "react";
import {
  communicationFromPreset,
  type ImplantBodyType,
  type ResponseHeader,
} from "@/components/canva/topbar/listeners/components/logic";
import { stagelessCustomChannelBase, stagelessCustomHttpRelayBase } from "./custom_code";

export const sections = [
  "general",
  "c2",
  "preface",
  "artifact",
  "runtime",
] as const;
export type Section = (typeof sections)[number];

export type Os = "windows" | "linux" | "macos";
export type Cpu = "amd" | "arm";
export type Arch = "x64" | "x86";
export type Format = "exe" | "dll" | "shellcode" | "elf" | "so" | "app";
export type Protocol = "http" | "https" | "smb" | "tcp" | "custom";
export type SleepMaskMode = "off" | "timer" | "zilean";
export type PatchToggle = "on" | "off";

export const supportsArmCpu = (os: Os) => os === "linux" || os === "macos";

export const cpuOptions = (os: Os): Cpu[] =>
  supportsArmCpu(os) ? ["amd", "arm"] : ["amd"];

export const archOptions = (cpu: Cpu, _os: Os): Arch[] => {
  if (cpu === "arm") return ["x64"];
  return ["x64"];
};

export const sleepMaskOptions: { value: SleepMaskMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "timer", label: "Ekko" },
  { value: "zilean", label: "Zilean" },
];
export type StringObfuscationMode = "off" | "xor" | "rc4";
export type ApiResolutionMode = "dynamic";
export type WinApiMethod = "indirect";
export type DonutEntropy = "none" | "random" | "encrypt";
export type DonutCompress = "none" | "aplib";
export type DonutHeaders = "overwrite" | "keep";
export type DonutExit = "thread" | "process" | "block";
export type ShellcodeEncoder = "off" | "sgn";

export type ImplantFormChange = <K extends keyof ImplantFormData>(
  key: K,
  value: ImplantFormData[K]
) => void;

export type ImplantFileAttachment = {
  name: string;
  bytes: string;
};

export type ServerEntry = { host: string; port: string; path: string };

export interface ImplantFormData {
  os: Os;
  cpu: Cpu;
  arch: Arch;
  format: Format;
  exeIcon: ImplantFileAttachment | null;
  protocol: Protocol;
  teamHost: string;
  teamPort: string;
  servers: ServerEntry[];
  sleep: string;
  delay: string;
  secondDelay: string;
  requestBodyType: ImplantBodyType;
  requestBody: string;
  responseBody: string;
  customCookies: ResponseHeader[];
  customHeaders: ResponseHeader[];
  smbHost: string;
  smbPipeName: string;
  sleepMask: SleepMaskMode;
  stringObfuscation: StringObfuscationMode;
  etwPatch: PatchToggle;
  amsiPatch: PatchToggle;
  apiResolution: ApiResolutionMode;
  winApiMethod: WinApiMethod;
  peTimestampDate: string;
  peMajorLinkerVersion: string;
  peMinorLinkerVersion: string;
  peMajorOsVersion: string;
  peMinorOsVersion: string;
  peMajorImageVersion: string;
  peMinorImageVersion: string;
  peMajorSubsystemVersion: string;
  peMinorSubsystemVersion: string;
  copyPeStrings: string;
  customCopyPeStrings: boolean;
  peHeadersPatch: PatchToggle;
  showConhost: boolean;
  donutEntropy: DonutEntropy;
  donutCompress: DonutCompress;
  donutHeaders: DonutHeaders;
  donutExit: DonutExit;
  donutThread: boolean;
  shellcodeEncoder: ShellcodeEncoder;
  customPreface: boolean;
  preface: string;
  customChannel: string;
  customHttpRelay: string;
}

export const usesCustomHttpRelay = (_os: Os) => true;

export const buildStagelessCustomHttpRelay = (os: Os) => stagelessCustomHttpRelayBase(os);

export const sectionLabels: Record<Section, string> = {
  general: "General",
  c2: "C2",
  preface: "Preface",
  artifact: "PE Artifacts",
  runtime: "Runtime",
};

export const isHttpProtocol = (protocol: Protocol) =>
  protocol === "http" || protocol === "https";

export const smbRelaySupported = (os: Os) => os === "windows";

export const isExeFormat = (format: Format) => format === "exe";

export const isDllFormat = (format: Format) => format === "dll";

export const isShellcodeFormat = (format: Format) => format === "shellcode";

export const isElfFormat = (format: Format) => format === "elf";

export const isSoFormat = (format: Format) => format === "so";

export const isAppFormat = (format: Format) => format === "app";

export const isLinuxFormat = (format: Format) => isElfFormat(format) || isSoFormat(format);

export const isMacFormat = (format: Format) => isAppFormat(format);

export const usesPeArtifacts = (os: Os) => os === "windows";

export const usesWindowsRuntime = (os: Os) => os === "windows";

export const usesGoSource = (os: Os) => os === "macos";

export const navSections = (format: Format, os: Os) =>
  sections.filter((s) => {
    if (s === "preface" && !usesNimCompile(format)) return false;
    if (s === "artifact" && !usesPeArtifacts(os)) return false;
    return true;
  });

export const usesNimCompile = (format: Format) =>
  format === "exe" ||
  format === "dll" ||
  format === "shellcode" ||
  format === "elf" ||
  format === "so" ||
  format === "app";

export const formatExt = (format: Format) => {
  if (format === "dll") return "dll";
  if (format === "shellcode") return "bin";
  if (format === "elf") return "elf";
  if (format === "so") return "so";
  if (format === "app") return "app";
  return "exe";
};

export const outputDownloadName = (format: Format) => `implant.${formatExt(format)}`;

export const parseSleepCheck = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

export const parsePeHeaderInt = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
};

export const peHeaderPlaceholders = {
  peMajorLinkerVersion: "14",
  peMinorLinkerVersion: "44",
  peMajorOsVersion: "6",
  peMinorOsVersion: "0",
  peMajorImageVersion: "0",
  peMinorImageVersion: "0",
  peMajorSubsystemVersion: "6",
  peMinorSubsystemVersion: "0",
} as const satisfies Partial<Record<keyof ImplantFormData, string>>;

export const usesPeHeaders = (format: Format) =>
  isExeFormat(format) || isDllFormat(format) || isShellcodeFormat(format);

const peHeaderConfig = (data: ImplantFormData) => {
  const out: Record<string, number | { lo: number; hi: number }> = {};

  if (data.peTimestampDate.trim()) {
    out.pe_timestamp = peTimestampDayRange(data.peTimestampDate.trim());
  }

  const versions: [keyof ImplantFormData, string][] = [
    ["peMajorLinkerVersion", "pe_major_linker_version"],
    ["peMinorLinkerVersion", "pe_minor_linker_version"],
    ["peMajorOsVersion", "pe_major_os_version"],
    ["peMinorOsVersion", "pe_minor_os_version"],
    ["peMajorImageVersion", "pe_major_image_version"],
    ["peMinorImageVersion", "pe_minor_image_version"],
    ["peMajorSubsystemVersion", "pe_major_subsystem_version"],
    ["peMinorSubsystemVersion", "pe_minor_subsystem_version"],
  ];

  for (const [key, configKey] of versions) {
    const n = parsePeHeaderInt(data[key] as string);
    if (n !== null) out[configKey] = n;
  }

  return out;
};

export const patchResponseHeader = (
  items: ResponseHeader[],
  index: number,
  field: keyof ResponseHeader,
  value: string
) => items.map((row, i) => (i === index ? { ...row, [field]: value } : row));

export const defaultImplantCustomHeaders = (): ResponseHeader[] => [
  { key: "User-Agent", value: "Mozilla/5.0" },
];

export const removeResponseHeader = (items: ResponseHeader[], index: number) => [
  ...items.slice(0, index),
  ...items.slice(index + 1),
];

export const filledServers = (items: ServerEntry[]) =>
  items.filter((s) => s.host.trim() && s.port.trim());

export const formatServerEndpoint = (
  host: string,
  port: string,
  scheme: "http" | "https" = "http",
  path = "/",
) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${scheme === "https" ? "https" : "http"}://${host}:${port}${p}`;
};

export const addServerEntry = (items: ServerEntry[], raw: string) => {
  const value = raw.trim();
  if (!value) return filledServers(items);
  let h: string;
  let p: string;
  let path: string;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`http://${value}`);
    if (!url.hostname) return filledServers(items);
    h = url.hostname;
    p = url.port || (url.protocol === "https:" ? "443" : "80");
    path = `${url.pathname || "/"}${url.search}`;
  } catch {
    return filledServers(items);
  }
  const entries = filledServers(items);
  if (entries.some((s) => s.host === h && s.port === p && (s.path || "/") === path)) return entries;
  return [...entries, { host: h, port: p, path }];
};

export const canAddServerEntry = (items: ServerEntry[], raw: string) =>
  addServerEntry(items, raw).length > filledServers(items).length;

export const removeServerEntry = (items: ServerEntry[], index: number) =>
  filledServers(items).filter((_, i) => i !== index);

export function useServerDraft(servers: ServerEntry[], onChange: (servers: ServerEntry[]) => void) {
  const [url, setUrl] = useState("");
  const entries = filledServers(servers);
  const canAdd = canAddServerEntry(servers, url);

  const add = () => {
    if (!canAdd) return;
    onChange(addServerEntry(servers, url));
    setUrl("");
  };

  const remove = (index: number) => onChange(removeServerEntry(servers, index));

  return { entries, url, setUrl, canAdd, add, remove };
};

export const peDateFromStr = (value: string) => {
  const raw = value.trim();
  if (!raw) return undefined;
  const [y, m, d] = raw.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

export const peDateToStr = (date?: Date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const peTimestampDayRange = (date: string) => {
  const [y, m, d] = date.split("-").map((x) => Number.parseInt(x, 10));
  const lo = Math.floor(new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000);
  const hi = Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000);
  return { lo, hi };
};

export const requiredFields: { label: string; ok: (d: ImplantFormData) => boolean }[] = [
  { label: "compile server", ok: (d) => !!(d.teamHost.trim() && d.teamPort.trim()) },
  {
    label: "server",
    ok: (d) =>
      d.protocol === "smb" ||
      d.protocol === "custom" ||
      d.servers.some((s) => s.host.trim() && s.port.trim()),
  },
  { label: "pipeline", ok: (d) => d.protocol !== "smb" || !!(d.smbHost.trim() && d.smbPipeName.trim()) },
];

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });

export const formatAttachmentSize = (bytesLength: number) => {
  if (bytesLength < 1024) return `${bytesLength} B`;
  if (bytesLength < 1024 * 1024) return `${(bytesLength / 1024).toFixed(1)} KB`;
  return `${(bytesLength / (1024 * 1024)).toFixed(1)} MB`;
};

export const attachmentByteLength = (attachment: ImplantFileAttachment | null) => {
  if (!attachment?.bytes) return 0;
  try {
    return atob(attachment.bytes).length;
  } catch {
    return 0;
  }
};

export const createImplantAttachmentHandler =
  <K extends keyof ImplantFormData>(
    key: K,
    handleFormChange: ImplantFormChange
  ) =>
  async (file: File) => {
    const bytes = await fileToBase64(file);
    handleFormChange(key, { name: file.name, bytes } as ImplantFormData[K]);
  };

export const createPeStringsConfig = (data: ImplantFormData) => {
  if (!data.customCopyPeStrings) return {};
  const createPeStrings = data.copyPeStrings.trim();
  if (!createPeStrings) return {};
  return { create_pe_strings: createPeStrings };
};

const escapeNimObfString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const escapeGoObfString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const customChannelHostFromServers = (data: Pick<ImplantFormData, "servers" | "protocol">) => {
  const first = data.servers.find((s) => s.host.trim() && s.port.trim());
  if (!first) return null;
  const path = first.path?.trim() || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const hp = `${first.host.trim()}:${first.port.trim()}${normalized}`;
  if (hp.includes("://")) return hp;
  const scheme = data.protocol === "https" ? "https://" : "http://";
  return `${scheme}${hp}`;
};

export const buildStagelessCustomChannel = (
  os: Os,
  data: Pick<ImplantFormData, "sleep" | "servers" | "protocol">
) => patchStagelessCustomChannelVars(stagelessCustomChannelBase(os), os, data);

export const patchStagelessCustomChannelVars = (
  channel: string,
  os: Os,
  data: Pick<ImplantFormData, "sleep" | "servers" | "protocol">
) => {
  const delay = parseSleepCheck(data.sleep);
  if (os === "macos") {
    let out = channel.replace(/^const customDelaySeconds = \d+/m, `const customDelaySeconds = ${delay}`);
    const host = customChannelHostFromServers(data);
    if (host) {
      out = out.replace(
        /^var customServerHost = obf\.S\(".*"\)/m,
        `var customServerHost = obf.S("${escapeGoObfString(host)}")`
      );
    }
    return out;
  }
  let out = channel.replace(/^(?:var|const) delaySeconds = \d+/m, `const delaySeconds = ${delay}`);
  const host = customChannelHostFromServers(data);
  if (host) {
    out = out.replace(
      /^var customServerHost = obf\(".*"\)/m,
      `var customServerHost = obf("${escapeNimObfString(host)}")`
    );
  }
  return out;
};

export const customChannelConfig = (data: ImplantFormData) => {
  if (data.protocol !== "custom") return {};
  const custom_channel = data.customChannel.trim();
  if (!custom_channel) return {};
  return { custom_channel };
};

export const customHttpRelayConfig = (data: ImplantFormData) => {
  if (data.protocol !== "custom" || !usesCustomHttpRelay(data.os)) return {};
  const custom_http_relay = data.customHttpRelay.trim();
  if (!custom_http_relay) return {};
  return { custom_http_relay };
};

export const prefaceConfig = (data: ImplantFormData) => {
  if (!data.customPreface) return {};
  const preface = data.preface.trim();
  if (!preface) return {};
  return { preface };
};

export const buildImplantConfig = (data: ImplantFormData) => ({
  operational_system: data.os,
  cpu: data.cpu,
  arch: data.arch,
  format: data.format,
  ...(isExeFormat(data.format) && data.exeIcon?.bytes ? { exe_icon: data.exeIcon } : {}),
  protocol: data.protocol,
  servers: Object.fromEntries(
    data.servers
      .filter((s) => s.host.trim() && s.port.trim())
      .map((s, i) => {
        const path = s.path?.trim() || "/";
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const hp = `${s.host.trim()}:${s.port.trim()}`;
        return [
          String(i),
          isHttpProtocol(data.protocol) ? `${hp}${normalized}` : hp,
        ];
      })
  ),
  sleep: data.sleep,
  delay: data.delay,
  second_delay: data.secondDelay.trim(),
  ...(isHttpProtocol(data.protocol)
    ? {
        body_content: {
          type: data.requestBodyType,
          ...(data.requestBodyType !== "off"
            ? {
                request_body: data.requestBody.trim(),
                response_body: data.responseBody.trim(),
              }
            : {}),
          cookies: data.customCookies,
          headers: data.customHeaders,
        },
      }
    : {}),
  ...(data.protocol === "smb"
    ? { smb_pipe: `\\\\${data.smbHost.trim()}\\pipe\\${data.smbPipeName.trim()}` }
    : {}),
  syscall_method: data.winApiMethod,
  sleep_mask: data.sleepMask,
  string_obfuscation: data.stringObfuscation,
  etw_patch: data.etwPatch,
  amsi_patch: data.amsiPatch,
  pe_headers_patch: data.peHeadersPatch,
  ...(data.os === "windows" && isExeFormat(data.format)
    ? { show_conhost: data.showConhost ? "on" : "off" }
    : {}),
  api_resolution: data.apiResolution,
  ...createPeStringsConfig(data),
  ...(usesPeHeaders(data.format) ? peHeaderConfig(data) : {}),
  ...(usesNimCompile(data.format) ? prefaceConfig(data) : {}),
  ...(data.protocol === "custom"
    ? { ...customChannelConfig(data), ...customHttpRelayConfig(data) }
    : {}),
  ...(isShellcodeFormat(data.format)
    ? {
        donut_entropy: data.donutEntropy,
        donut_compress: data.donutCompress,
        donut_headers: data.donutHeaders,
        donut_exit: data.donutExit,
        donut_thread: data.donutThread,
      }
    : {}),
  ...(data.os === "windows" ? { shellcode_encoder: data.shellcodeEncoder } : {}),
});

export const defaultPrefaceNim = `import osproc

proc example() =
  let output = execProcess("whoami")
  echo output

example()`;

export const defaultPrefaceGo = `import (
	"fmt"
	"os/exec"
)

func example() {
	cmd := exec.Command("whoami")
	output, err := cmd.Output()
	if err != nil {
		return
	}
	fmt.Println(string(output))
}

func init() {
	example()
}`;

export const defaultPreface = (os: Os) => (os === "macos" ? defaultPrefaceGo : defaultPrefaceNim);

export const emptyForm: ImplantFormData = {
  os: "windows",
  cpu: "amd",
  arch: "x64",
  format: "exe",
  exeIcon: null,
  protocol: "http",
  teamHost: "",
  teamPort: "",
  servers: [],
  sleep: "2",
  delay: "20",
  secondDelay: "",
  requestBodyType: "off",
  requestBody: communicationFromPreset("off").implantBody,
  responseBody: communicationFromPreset("off").listenerResponse,
  customCookies: [],
  customHeaders: defaultImplantCustomHeaders(),
  smbHost: "",
  smbPipeName: "",
  sleepMask: "off",
  stringObfuscation: "xor",
  etwPatch: "on",
  amsiPatch: "on",
  apiResolution: "dynamic",
  winApiMethod: "indirect",
  peTimestampDate: "",
  peMajorLinkerVersion: "",
  peMinorLinkerVersion: "",
  peMajorOsVersion: "",
  peMinorOsVersion: "",
  peMajorImageVersion: "",
  peMinorImageVersion: "",
  peMajorSubsystemVersion: "",
  peMinorSubsystemVersion: "",
  copyPeStrings: `var a = 1;
const b = 1.1;
let c = "example";`,
  customCopyPeStrings: false,
  peHeadersPatch: "off",
  showConhost: false,
  donutEntropy: "encrypt",
  donutCompress: "none",
  donutHeaders: "overwrite",
  donutExit: "thread",
  donutThread: false,
  shellcodeEncoder: "off",
  customPreface: false,
  customChannel: buildStagelessCustomChannel("windows", { sleep: "2", servers: [], protocol: "http" }),
  customHttpRelay: buildStagelessCustomHttpRelay("windows"),
  preface: defaultPrefaceNim,
};

export function useRequestBodyMarkers(
  requestBody: string,
  patch: (next: string) => void
) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const addMarker = () => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const marker = "§content§";
    patch(requestBody.slice(0, start) + marker + requestBody.slice(end));
    const pos = start + marker.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const clearMarkers = () =>
    patch(requestBody.replace(/§[^§]*§/g, "").replace(/§/g, ""));

  return { bodyRef, addMarker, clearMarkers };
}

export function useStagelessPanel() {
  const [section, setSection] = useState<Section>("general");
  const [formData, setFormData] = useState<ImplantFormData>(emptyForm);

  useEffect(() => {
    if (!usesPeArtifacts(formData.os) && section === "artifact") {
      setSection("general");
    }
  }, [formData.os, section]);

  const handleFormChange = <K extends keyof ImplantFormData>(
    key: K,
    value: ImplantFormData[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "requestBodyType") {
        const preset = communicationFromPreset(value as ImplantBodyType);
        next.requestBody = preset.implantBody;
        next.responseBody = preset.listenerResponse;
      }
      if (key === "protocol") {
        next.servers = [];
        if (value === "custom") {
          next.customChannel = buildStagelessCustomChannel(next.os, next);
          next.customHttpRelay = buildStagelessCustomHttpRelay(next.os);
        }
      } else if (
        next.protocol === "custom" &&
        (key === "servers" || key === "sleep")
      ) {
        next.customChannel = patchStagelessCustomChannelVars(next.customChannel, next.os, next);
      }
      if (key === "os") {
        const prevOs = prev.os;
        if (value === "linux") {
          if (next.format === "exe" || next.format === "dll" || next.format === "shellcode" || isMacFormat(next.format)) {
            next.format = "elf";
          }
          if (next.protocol === "smb") next.protocol = "tcp";
        } else if (value === "macos") {
          if (next.format === "exe" || next.format === "dll" || next.format === "shellcode" || isLinuxFormat(next.format)) {
            next.format = "app";
          }
          if (next.protocol === "smb") next.protocol = "tcp";
        } else if (isLinuxFormat(next.format) || isMacFormat(next.format)) {
          next.format = "exe";
        }
        if (!supportsArmCpu(value as Os) && next.cpu === "arm") {
          next.cpu = "amd";
        }
        if (value === "windows") {
          next.cpu = "amd";
          next.arch = "x64";
        }
        if (!archOptions(next.cpu, value as Os).includes(next.arch)) {
          next.arch = archOptions(next.cpu, value as Os)[0];
        }
        if (prev.preface === defaultPreface(prevOs)) {
          next.preface = defaultPreface(value as Os);
        }
        if (next.protocol === "custom") {
          next.customChannel = buildStagelessCustomChannel(value as Os, next);
          next.customHttpRelay = buildStagelessCustomHttpRelay(value as Os);
        }
      }
      if (key === "cpu") {
        const allowedArch = archOptions(value as Cpu, next.os);
        if (!allowedArch.includes(next.arch)) {
          next.arch = allowedArch[0];
        }
      }
      return next;
    });
  };

  return {
    section,
    formData,
    setSection,
    handleFormChange,
  };
}
