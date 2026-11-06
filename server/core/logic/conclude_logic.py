from fastapi.responses import JSONResponse

# For post processing of responses

async def conclude_request(
    content,
    status_code: int = 200,
    body: dict | None = None,
    *,
    type: str | None = None,
):
    # Returns the final json response of the request
    if isinstance(content, JSONResponse):
        return content

    return JSONResponse(status_code=status_code, content=content)
