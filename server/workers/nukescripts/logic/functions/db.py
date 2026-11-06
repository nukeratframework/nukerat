from infra.database.database import (
    User,
    Terminal,
    Host,
    Listener,
    Folders,
    Process,
    Queue,
    Agents,
    AgentsHistory,
    Credentials,
    Keylogger,
    NukeScripts,
    NukeScriptsOutput,
    CustomNotification,
    Checkin,
    sqlite_db_sync as sqlite_db,
)
from utils.querys import row_to_dict

tables = {
    "users": User,
    "terminal": Terminal,
    "hosts": Host,
    "listeners": Listener,
    "folders": Folders,
    "process": Process,
    "queue": Queue,
    "agents": Agents,
    "agents_history": AgentsHistory,
    "credentials": Credentials,
    "keylogger": Keylogger,
    "nukescripts": NukeScripts,
    "nukescripts_output": NukeScriptsOutput,
    "custom_notifications": CustomNotification,
    "checkins": Checkin,
}


class DbApi:
    def __getattr__(self, name):
        # Returns a query function for the named table
        model = tables.get(name)
        if not model:
            raise AttributeError(f'unknown table "{name}"')

        columns = set(model.__table__.columns.keys())

        def query(column=None):
            # Reads the table, or one column when it is given
            rows = sqlite_db.read(model)
            if column is None:
                return [row_to_dict(row) for row in rows]
            col = str(column).strip()
            if col not in columns:
                raise ValueError(f'unknown column "{col}" in table "{name}"')
            return [getattr(row, col) for row in rows]

        return query


db = DbApi()
