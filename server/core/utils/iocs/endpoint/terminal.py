import re

from logic.terminal.utils.parse_args import remove_blob_payload_tmp
from utils.iocs.helpers import save_iocs
from utils.iocs.knowledge.map import extensions, is_valid_domain

default_host = "campaign"
split_pattern = re.compile(r"[;|]|&&|\|\|")
ip_pattern = re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3})\b")
domain_pattern = re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b", re.I)
token_pattern = re.compile(r"\b[^\s;|&\"']+\b", re.I)


async def run(body: dict) -> None:
    # Extracts ips, domains and file paths from the command and stores them
    text = str(body.get("command") or body.get("input") or "")
    text, _ = remove_blob_payload_tmp(text)
    if not text:
        return

    host_tag = default_host
    for key in ("host_tag", "hostTag", "host", "session"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            host_tag = value.strip()
            break

    items = {}
    segments = split_pattern.split(text) or [text]

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        segment_iocs = []

        for ip in ip_pattern.findall(segment):
            value = ip.lower()
            if ("ipv4", value) not in segment_iocs:
                segment_iocs.append(("ipv4", value))

        for match in domain_pattern.findall(segment):
            candidate = match.strip().lower()
            if ("domain", candidate) in segment_iocs or not is_valid_domain(candidate):
                continue
            segment_iocs.append(("domain", candidate))

        for token in token_pattern.findall(segment):
            token = token.strip().lower()
            if "." not in token:
                continue
            if "\\" in token or "/" in token:
                ext = token.rsplit(".", 1)[-1]
                if ext in extensions and ("file", token) not in segment_iocs:
                    segment_iocs.append(("file", token))
                continue
            ext = token.rsplit(".", 1)[-1]
            if ext in extensions and ("file", token) not in segment_iocs:
                segment_iocs.append(("file", token))

        if not segment_iocs:
            continue

        for ioc_type, value in segment_iocs:
            items[(ioc_type, value)] = 1

    if items:
        await save_iocs(host_tag, [(ioc_type, value, level) for (ioc_type, value), level in items.items()])
