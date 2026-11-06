async def filter_lines(lines, body):
    # Filters the log lines by search, type and category
    q = (body.get("search") or "").strip().lower()
    log_type = body.get("logType") or "all"
    category = body.get("category") or "all"
    out = []
    for line in lines:
        low = line.lower()
        if log_type != "all" and f"| {log_type} |".lower() not in low:
            continue
        if category != "all" and f"| {category} |".lower() not in low:
            continue
        if q and q not in low:
            continue
        out.append(line)
    return out
