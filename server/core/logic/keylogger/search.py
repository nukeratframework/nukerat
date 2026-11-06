def _in_range(created_at, body):
    date = (body.get("date") or "").strip()
    time_from = (body.get("timeFrom") or "").strip()
    time_to = (body.get("timeTo") or "").strip()
    if not date and not time_from and not time_to:
        return True
    if not created_at:
        return False
    hora = created_at.strftime("%Y-%m-%d %H:%M:%S")
    if date and hora[:10] != date:
        return False
    t = hora[11:19]
    if time_from and t < time_from:
        return False
    if time_to and t > time_to:
        return False
    return True


async def filter_rows(rows, body, host_map):
    q = (body.get("search") or "").strip().lower()
    host_tag = body.get("hostTag") or "all"
    out = []
    for row in rows:
        if host_tag != "all" and row.host_tag != host_tag:
            continue
        if not _in_range(row.created_at, body):
            continue
        host = host_map.get(row.host_tag, "")
        hay = f"{row.host_tag} {host} {row.content}".lower()
        if row.created_at:
            hay += f" {row.created_at.strftime('%Y/%m/%d - %H:%M')} {row.created_at.isoformat()}"
        if q and q not in hay:
            continue
        out.append(row)
    return out
