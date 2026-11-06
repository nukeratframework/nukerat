def long_polling_mode(config: dict | None) -> bool:
    # Reads if long polling is on
    if not config:
        return False
    return bool(config.get("longPollingMode"))
