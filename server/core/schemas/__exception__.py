import re

from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse

_DISCRIMINATOR_MISSING = re.compile(
    r"Unable to extract tag using discriminator '([^']+)'"
)


def _field_from_loc(loc: tuple) -> str:
    # Builds the field path from the validation location
    parts = []
    for item in loc:
        if item == "body":
            continue
        if isinstance(item, str) and item.endswith("Request"):
            continue
        parts.append(str(item))
    return ".".join(parts) if parts else "request"


def _format_errors(exc: RequestValidationError) -> list[dict[str, str]]:
    # Turns validation errors into a short field and message list
    seen: set[tuple[str, str]] = set()
    errors: list[dict[str, str]] = []
    for error in exc.errors():
        field = _field_from_loc(error.get("loc", ()))
        message = error.get("msg", "Invalid value")
        match = _DISCRIMINATOR_MISSING.search(message)
        if match:
            message = f"{message} (missing {match.group(1)})"
        elif "not match" in message.lower():
            message = message.replace("tag", "value")
        key = (field, message)
        if key in seen:
            continue
        seen.add(key)
        errors.append({"field": field, "message": message})
    return errors


async def validation_exception_handler(request, exc: RequestValidationError):
    # Returns a 422 response with the formatted validation errors
    return ORJSONResponse(
        status_code=422,
        content={
            "status": "failure",
            "message": "Invalid request",
            "errors": _format_errors(exc),
        },
    )
