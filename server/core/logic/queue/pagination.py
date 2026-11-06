async def slice_page(items, body):
    # Cuts the list into one page
    page = max(1, int(body.get("page") or 1))
    page_size = max(1, min(500, int(body.get("pageSize") or 50)))
    total = len(items)
    start = (page - 1) * page_size
    return items[start : start + page_size], total, page, page_size
