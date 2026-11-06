import json


def build_parent_map(hosts):
    # Builds the parent map of relay hops
    endpoints = {}
    for host in hosts:
        address = str(getattr(host, "ip", None) or getattr(host, "external_ip", None) or "").strip()
        if not address:
            continue
        raw = getattr(host, "relays", None) or "[]"
        try:
            parsed = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            parsed = []
        if not isinstance(parsed, list):
            parsed = []
        for line in parsed:
            parts = str(line).split(";", 2)
            if len(parts) != 3:
                continue
            channel = parts[0].strip().lower()
            mid = parts[1].strip()
            if channel not in ("tcp", "smb") or ":" not in mid:
                continue
            relay_tag, port = mid.rsplit(":", 1)
            relay_tag, port = relay_tag.strip(), port.strip()
            if relay_tag and port:
                endpoints[(address, channel, port)] = (relay_tag, channel)

    parent = {}
    for peer in hosts:
        server = str(getattr(peer, "host_server", None) or "").strip()
        port = str(getattr(peer, "host_port", None) or "").strip()
        listener = str(getattr(peer, "listener", None) or "").strip().lower()
        if not (server and port and listener):
            continue
        peer_key = (server, listener, port)
        match = endpoints.get(peer_key)
        if match is None:
            continue
        relay_tag, channel = match
        if peer.tag == relay_tag:
            continue
        parent[peer.tag] = (relay_tag, channel)

    return parent


def hops_from_entry(tag, parent, entrypoints):
    # Walks the hops from a host back to the entry
    seen = set()
    current = tag
    while current in parent:
        if current in seen:
            return None
        seen.add(current)
        current = parent[current][0]
    if current not in entrypoints:
        return None
    entry = current

    path = []
    current = tag
    while current != entry:
        if current not in parent:
            return None
        relay_tag, channel = parent[current]
        path.append((channel, current))
        current = relay_tag
    path.reverse()
    return entry, path


def create_graph_hosts(hosts, to_dict):
    # Builds the session graph chains and host data
    hosts = list(hosts)
    data = {host.tag: to_dict(host) for host in hosts}
    entrypoints = set()
    for host in hosts:
        listener = str(getattr(host, "listener", None) or "").strip().lower()
        if listener not in ("tcp", "smb"):
            entrypoints.add(host.tag)

    parent = build_parent_map(hosts)

    children_of = {}
    for child, (relay_tag, _) in parent.items():
        if relay_tag not in children_of:
            children_of[relay_tag] = set()
        children_of[relay_tag].add(child)

    chains = []
    for ep in entrypoints:
        if ep not in children_of:
            chains.append(f"server<{ep}")

    for child_tag in parent:
        result = hops_from_entry(child_tag, parent, entrypoints)
        if result is None:
            continue
        entry, hops = result
        parts = ["server", entry]
        for channel, child in hops:
            parts.extend([channel, child])
        chains.append("<".join(parts))

    unique = sorted(set(chains), key=len, reverse=True)
    kept = []
    for chain in unique:
        if any(longer.startswith(chain + "<") for longer in kept):
            continue
        kept.append(chain)
    chains = sorted(kept)

    linked = set()
    for chain in chains:
        for part in chain.split("<"):
            if part and part not in ("tcp", "smb") and part != "server":
                linked.add(part)
    filtered_data = {tag: data[tag] for tag in linked if tag in data}

    return {"chains": chains, "data": filtered_data}
