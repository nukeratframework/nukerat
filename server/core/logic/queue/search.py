async def filter_rows(rows, body, host_map):
    # Filters the queue by search and host
    q = (body.get("search") or "").strip().lower()
    host_tag = body.get("hostTag") or "all"
    out = []
    for row in rows:
        if host_tag != "all" and row.host != host_tag:
            continue
        host = host_map.get(row.host, "")
        hay = f"{row.tag} {row.host} {host} {row.type} {row.input} {row.parameters} {row.error or ''}".lower()
        if row.created_at:
            hay += f" {row.created_at.strftime('%Y/%m/%d - %H:%M')} {row.created_at.isoformat()}"
        if q and q not in hay:
            continue
        out.append(row)
    return out
