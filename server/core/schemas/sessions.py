from typing import Literal

from pydantic import BaseModel


SessionListMode = Literal["default", "graphs", "sessions_lp"]


class ListSessionsQuery(BaseModel):
    mode: SessionListMode = "default"
    long_polling: bool = True


class PatchSessionRequest(BaseModel):
    notes: str = ""
