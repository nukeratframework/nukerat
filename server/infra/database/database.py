import os
import sqlite3
import time
import asyncio
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint, delete, event, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import class_mapper, declarative_base, sessionmaker
from sqlalchemy import create_engine
import sqlalchemy.pool.base as pool_base

from launcher.utils.config import config
from infra.database.cell_limits import cell_byte_limit, clamp_cell_value
from infra.general.create_log import logger, write_log


def utc_now():
    # Returns the current time in UTC
    return datetime.now(timezone.utc)


_Base = declarative_base()


class User(_Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    secret = Column(String, nullable=False)


class Terminal(_Base):
    __tablename__ = "terminal"
    __table_args__ = (Index("ix_terminal_host", "host"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    terminal_id = Column(String, nullable=False)
    tag = Column(String, nullable=False, unique=True)
    host = Column(Text, nullable=False)
    input = Column(Text, nullable=False)
    output = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now)


class Host(_Base):
    __tablename__ = "hosts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    ip = Column(Text, nullable=False)
    host_server = Column(Text, nullable=False, default="")
    host_port = Column(Text, nullable=False, default="")
    external_ip = Column(Text, nullable=False, default="")
    listener = Column(Text, nullable=False, default="")
    privilege = Column(Text)
    relays = Column(Text)
    notes = Column(Text)
    process = Column(Text)
    pid = Column(Integer)
    arch = Column(Text, nullable=False, default="")
    os = Column(Text, nullable=False)
    user = Column(Text, nullable=False, default="")
    hostname = Column(Text, nullable=False, default="")
    info = Column(Text)
    first_seen = Column(DateTime, default=utc_now)
    last_seen = Column(DateTime, default=utc_now)
    last_activity = Column(Text)
    next_checkin = Column(DateTime, default=utc_now)
    delay = Column(Integer, nullable=False)
    status = Column(Text, nullable=False, default="active")
    implant_config = Column(Text)
    created_at = Column(DateTime, default=utc_now)


class Listener(_Base):
    __tablename__ = "listeners"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    type = Column(Text, nullable=False)
    protocol = Column(Text, nullable=False)
    config = Column(Text, nullable=False)
    key_pem = Column(Text)
    cert_pem = Column(Text)
    created_at = Column(DateTime, default=utc_now)


class Folders(_Base):
    __tablename__ = "folders"
    __table_args__ = (UniqueConstraint("host", "path", name="uq_folders_host_path"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    host = Column(Text, nullable=False)
    path = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    modified = Column(Text, nullable=False)
    size = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)


class Checkin(_Base):
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    host = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)


class Queue(_Base):
    __tablename__ = "queue"
    __table_args__ = (
        Index("ix_queue_host", "host"),
        Index("ix_queue_host_pending", "host", "is_completed", "is_ready", "captured"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    host = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    command = Column(Text, nullable=False, default="")
    input = Column(Text, nullable=False)
    parameters = Column(Text, nullable=False)
    is_completed = Column(Integer, nullable=False)
    error = Column(Text, nullable=True)
    custom_response = Column(Text, nullable=True)
    captured = Column(Integer, default=0)
    is_ready = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=utc_now)
    nukescript_trigger = Column(Text, nullable=True)


class Process(_Base):
    __tablename__ = "process"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False)
    host = Column(Text, nullable=False, unique=True)
    tree = Column(Text)
    created_at = Column(DateTime, default=utc_now)


class Agents(_Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False, unique=True)
    type = Column(Text, nullable=False)
    is_custom = Column(Integer, nullable=False)
    api_key = Column(Text, nullable=True)
    endpoint = Column(Text, nullable=True)
    headers = Column(Text, nullable=True)
    body_template = Column(Text, nullable=True)
    response_field = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class AgentsHistory(_Base):
    __tablename__ = "agents_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Text, nullable=False)
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)


class Credentials(_Base):
    __tablename__ = "credentials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    server = Column(Text, nullable=False)
    host = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class Keylogger(_Base):
    __tablename__ = "keylogger"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    content = Column(Text, nullable=False)
    host_tag = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)


class CustomNotification(_Base):
    __tablename__ = "custom_notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    title = Column(Text)
    type = Column(Text, nullable=False, default="info")
    description = Column(Text)
    created_at = Column(DateTime, default=utc_now)


class NukeScripts(_Base):
    __tablename__ = "nukescripts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    status = Column(Integer, nullable=False)
    last_run = Column(DateTime, default=utc_now)
    errors_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)


class NukeScriptsOutput(_Base):
    __tablename__ = "nukescripts_output"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    content = Column(Text, nullable=False)
    consumed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)


class Ioc(_Base):
    __tablename__ = "iocs"
    __table_args__ = (Index("ix_ioc_host_tag", "host_tag"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    type = Column(Text, nullable=False)
    value = Column(Text, nullable=False)
    host_tag = Column(Text, nullable=True)
    level = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)


class AesKeys(_Base):
    __tablename__ = "aes_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)


class Builds(_Base):
    __tablename__ = "builds"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tag = Column(Text, nullable=False, unique=True)
    shellcode_path = Column(Text, nullable=False)


def clamp_text_changes(model, changes):
    # Cuts text fields in a change dict to the max cell size
    if not changes or cell_byte_limit() <= 0:
        return changes
    text = {c.key for c in class_mapper(model).columns if isinstance(c.type, Text)}
    return {k: clamp_cell_value(v) if k in text else v for k, v in changes.items()}


@event.listens_for(_Base, "before_insert", propagate=True)
@event.listens_for(_Base, "before_update", propagate=True)
def clamp_text_cell_values(mapper, connection, target):
    # Cuts text columns before the row is saved
    if cell_byte_limit() <= 0:
        return
    for col in mapper.columns:
        if isinstance(col.type, Text):
            val = getattr(target, col.key, None)
            if isinstance(val, str):
                setattr(target, col.key, clamp_cell_value(val))


def apply_sqlite_pragmas(dbapi_conn, connection_record):
    # Sets WAL, busy timeout and foreign keys on connect
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def ensure_indexes(connection):
    # Creates the extra indexes if they are missing
    for stmt in (
        "CREATE INDEX IF NOT EXISTS ix_terminal_host ON terminal (host)",
        "CREATE INDEX IF NOT EXISTS ix_queue_host ON queue (host)",
        "CREATE INDEX IF NOT EXISTS ix_queue_host_pending ON queue (host, is_completed, is_ready, captured)",
        "CREATE INDEX IF NOT EXISTS ix_ioc_host_tag ON iocs (host_tag)",
    ):
        connection.execute(text(stmt))


class sqlite_db:
    _store = {}
    _async_lock = asyncio.Lock()
    _sync_lock = threading.Lock()
    _async_engine = None
    _sync_engine = None
    _AsyncSession = None
    _SyncSession = None
    _async_started = False
    _sync_started = False

    @classmethod
    @contextmanager
    def sync_session(cls):
        # Opens a sync session and closes it after use
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                yield session

    @classmethod
    async def start(cls):
        # Main function that starts the async DB and creates the tables
        cls.start_sync()
        if cls._async_started:
            return
        path = config["paths"]["database"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cls._async_engine = create_async_engine(
            f"sqlite+aiosqlite:///{path}",
            connect_args={"timeout": 30},
        )
        if not getattr(pool_base.Pool, "_close_cancel_patched", False):

            def close_connection(self, connection, *, terminate=False):
                # Here is where the pool close is handled to avoid a cancelled exception
                try:
                    if terminate:
                        self._dialect.do_terminate(connection)
                    else:
                        self._dialect.do_close(connection)
                except asyncio.CancelledError:
                    write_log(
                        logger,
                        "debug",
                        "Connection close cancelled | sqlite pool (client disconnect or shutdown)",
                    )
                except BaseException as e:
                    write_log(
                        logger,
                        "error",
                        f"Exception {'terminating' if terminate else 'closing'} connection | sqlite pool | {e}",
                    )
                    if not isinstance(e, Exception):
                        raise

            pool_base.Pool._close_connection = close_connection
            pool_base.Pool._close_cancel_patched = True
        event.listen(cls._async_engine.sync_engine, "connect", apply_sqlite_pragmas)
        async with cls._async_engine.begin() as conn:
            await conn.run_sync(_Base.metadata.create_all)
            await conn.run_sync(ensure_indexes)
        cls._AsyncSession = async_sessionmaker(cls._async_engine, expire_on_commit=False)
        cls._async_started = True

    @classmethod
    def start_sync(cls):
        # Starts the sync DB engine and creates the tables
        if cls._sync_started:
            return
        path = config["paths"]["database"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cls._sync_engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"timeout": 30},
            pool_size=1,
            max_overflow=0,
        )
        event.listen(cls._sync_engine, "connect", apply_sqlite_pragmas)
        _Base.metadata.create_all(cls._sync_engine)
        cls._SyncSession = sessionmaker(bind=cls._sync_engine, expire_on_commit=False)
        cls._sync_started = True

    @classmethod
    def session(cls):
        # Returns a sync session
        cls.start_sync()
        return cls._SyncSession()

    @classmethod
    async def put(cls, key, value):
        # Stores a value in the memory store
        async with cls._async_lock:
            cls._store[key] = value

    @classmethod
    async def store_get(cls, key, default=None):
        # Reads a value from the memory store
        async with cls._async_lock:
            return cls._store.get(key, default)

    @classmethod
    async def store_set(cls, key, value):
        # Stores a value in the memory store
        async with cls._async_lock:
            cls._store[key] = value

    @classmethod
    async def store_update(cls, key, changes):
        # Updates a dict already stored in memory
        async with cls._async_lock:
            if key in cls._store and isinstance(cls._store[key], dict):
                cls._store[key].update(changes)

    @classmethod
    def put_sync(cls, key, value):
        # Stores a value in the memory store
        with cls._sync_lock:
            cls._store[key] = value

    @classmethod
    def store_get_sync(cls, key, default=None):
        # Reads a value from the memory store
        with cls._sync_lock:
            return cls._store.get(key, default)

    @classmethod
    def store_set_sync(cls, key, value):
        # Stores a value in the memory store
        with cls._sync_lock:
            cls._store[key] = value

    @classmethod
    def store_update_sync(cls, key, changes):
        # Updates a dict already stored in memory
        with cls._sync_lock:
            if key in cls._store and isinstance(cls._store[key], dict):
                cls._store[key].update(changes)

    @classmethod
    async def write(cls, instance):
        # Stores a new row in the DB
        async with cls._AsyncSession() as session:
            session.add(instance)
            await session.commit()

    @classmethod
    async def read(cls, model, *, order_desc_id=False, **filters):
        # Reads rows from the DB
        async with cls._AsyncSession() as session:
            q = select(model).filter_by(**filters)
            if order_desc_id:
                q = q.order_by(model.id.desc())
            result = await session.execute(q)
            return result.scalars().all()

    @classmethod
    async def modify(cls, model, filters, changes):
        # Updates rows in the DB
        changes = clamp_text_changes(model, changes)
        async with cls._AsyncSession() as session:
            await session.execute(update(model).filter_by(**filters).values(**changes))
            await session.commit()

    @classmethod
    async def delete(cls, model, **filters):
        # Deletes rows from the DB
        async with cls._AsyncSession() as session:
            await session.execute(delete(model).filter_by(**filters))
            await session.commit()

    @classmethod
    def write_sync(cls, instance):
        # Stores a new row in the DB
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                session.add(instance)
                session.commit()

    @classmethod
    def read_sync(cls, model, **filters):
        # Reads rows from the DB
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                q = select(model)
                if filters:
                    q = q.filter_by(**filters)
                return session.scalars(q).all()

    @classmethod
    def modify_sync(cls, model, filters, changes):
        # Updates rows in the DB
        cls.start_sync()
        changes = clamp_text_changes(model, changes)
        with cls._sync_lock:
            with cls._SyncSession() as session:
                session.execute(update(model).filter_by(**filters).values(**changes))
                session.commit()

    @classmethod
    def delete_sync(cls, model, **filters):
        # Deletes rows from the DB
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                q = delete(model)
                if filters:
                    q = q.filter_by(**filters)
                result = session.execute(q)
                session.commit()
                return result.rowcount or 0

    @classmethod
    def record_run(cls, tag, ok):
        # Stores the last run and bumps the success or error count
        cls.start_sync()
        values = {"last_run": utc_now()}
        if ok:
            values["success_count"] = NukeScripts.success_count + 1
        else:
            values["errors_count"] = NukeScripts.errors_count + 1
        with cls._sync_lock:
            with cls._SyncSession() as session:
                session.execute(update(NukeScripts).filter_by(tag=tag).values(**values))
                session.commit()

    @classmethod
    async def get_host_delay(cls, tag):
        # Returns the delay of the host
        async with cls._AsyncSession() as session:
            result = await session.execute(select(Host.delay).filter_by(tag=tag).limit(1))
            delay = result.scalar()
            return float(delay) if delay is not None else 0.0

    @classmethod
    async def get_host_info(cls, tag):
        # Returns the host row as a dict
        async with cls._AsyncSession() as session:
            result = await session.execute(select(Host).filter_by(tag=tag).limit(1))
            row = result.scalars().first()
            if row is None:
                return None
            return {
                "id": row.id,
                "tag": row.tag,
                "ip": row.ip,
                "host_server": row.host_server,
                "host_port": row.host_port,
                "os": row.os,
                "first_seen": row.first_seen.isoformat() if row.first_seen else None,
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                "delay": row.delay,
                "implant_config": row.implant_config,
            }

    @classmethod
    async def wait_response(cls, host_tag, cmd_tag, delay=None):
        # Waits for the terminal output or returns timeout
        if delay is None:
            delay = 60

        host = await cls.get_host_info(host_tag)
        security_margin = 30
        delay = delay + int(host["delay"]) + security_margin

        for _ in range(delay):
            await asyncio.sleep(1)
            async with cls._AsyncSession() as session:
                result = await session.execute(
                    select(Terminal).filter_by(host=host_tag, tag=cmd_tag)
                )
                row = result.scalars().first()
                if row and row.output:
                    return row.output

        return "timeout waiting for response"

    @classmethod
    def wait_response_sync(cls, host_tag, cmd_tag, delay=None):
        # Waits for the terminal output or returns timeout
        if delay is None:
            delay = 60

        host = cls.get_host_info_sync(host_tag)
        security_margin = 30
        delay = delay + int(host["delay"]) + security_margin

        for _ in range(delay):
            time.sleep(1)
            cls.start_sync()
            with cls._sync_lock:
                with cls._SyncSession() as session:
                    result = session.execute(
                        select(Terminal).filter_by(host=host_tag, tag=cmd_tag)
                    )
                    row = result.scalars().first()
                    if row and row.output:
                        return row.output

        return "timeout waiting for response"

    @classmethod
    async def check_task_error(cls, tag):
        # Returns the queue error for the tag
        async with cls._AsyncSession() as session:
            result = await session.execute(select(Queue.error).filter_by(tag=tag).limit(1))
            error = result.scalar()
            if error:
                return error
            return False

    @classmethod
    async def check_task_custom_response(cls, tag):
        # Returns the custom response of the queue line
        async with cls._AsyncSession() as session:
            result = await session.execute(
                select(Queue.custom_response).filter_by(tag=tag).limit(1)
            )
            custom = result.scalar()
            if custom:
                return custom
            return False

    @classmethod
    def get_host_delay_sync(cls, tag):
        # Returns the delay of the host
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                result = session.execute(select(Host.delay).filter_by(tag=tag).limit(1))
                delay = result.scalar()
                return float(delay) if delay is not None else 0.0

    @classmethod
    def get_host_info_sync(cls, tag):
        # Returns the host row as a dict
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                result = session.execute(select(Host).filter_by(tag=tag).limit(1))
                row = result.scalars().first()
                if row is None:
                    return None
                return {
                    "id": row.id,
                    "tag": row.tag,
                    "ip": row.ip,
                    "host_server": row.host_server,
                    "host_port": row.host_port,
                    "os": row.os,
                    "first_seen": row.first_seen.isoformat() if row.first_seen else None,
                    "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                    "delay": row.delay,
                    "implant_config": row.implant_config,
                }

    @classmethod
    def check_task_error_sync(cls, tag):
        # Returns the queue error for the tag
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                result = session.execute(select(Queue.error).filter_by(tag=tag).limit(1))
                error = result.scalar()
                if error:
                    return error
                return False

    @classmethod
    def check_task_custom_response_sync(cls, tag):
        # Returns the custom response of the queue line
        cls.start_sync()
        with cls._sync_lock:
            with cls._SyncSession() as session:
                result = session.execute(
                    select(Queue.custom_response).filter_by(tag=tag).limit(1)
                )
                custom = result.scalar()
                if custom:
                    return custom
                return False

    @classmethod
    def database_path(cls):
        # Returns the path of the database file
        return Path(config["paths"]["database"])

    @classmethod
    def check_sqlite_file(cls, path):
        # Checks if the file is a valid SQLite database
        src = Path(path).expanduser().resolve()
        try:
            with sqlite3.connect(f"file:{src}?mode=ro", uri=True) as conn:
                conn.execute("SELECT 1 FROM sqlite_master LIMIT 1")
        except sqlite3.Error as exc:
            return str(exc)
        return None

    @classmethod
    def table_sizes(cls):
        # Returns the size of each table
        cls.start_sync()
        sizes = []
        with cls.sync_session() as session:
            for table in _Base.metadata.sorted_tables:
                size = session.execute(
                    text("SELECT COALESCE(SUM(pgsize), 0) FROM dbstat WHERE name = :name"),
                    {"name": table.name},
                ).scalar()
                sizes.append((table.name, int(size or 0)))
        return sizes

    @classmethod
    def export_to(cls, dest):
        # Exports the database to the given path
        dest_path = str(Path(dest).expanduser().resolve())
        with cls.sync_session() as session:
            src = session.connection().connection.dbapi_connection
            with sqlite3.connect(dest_path) as dst:
                src.backup(dst)

    @classmethod
    def import_from(cls, src):
        # Replaces the current database with the given file
        src_path = str(Path(src).expanduser().resolve())
        with cls.sync_session() as session:
            dst = session.connection().connection.dbapi_connection
            with sqlite3.connect(f"file:{src_path}?mode=ro", uri=True) as ext:
                ext.backup(dst)
            session.commit()

        db_path = cls.database_path()
        for suffix in ("-wal", "-shm"):
            sidecar = Path(str(db_path) + suffix)
            if sidecar.is_file():
                os.remove(sidecar)


class sqlite_db_sync:
    start = staticmethod(sqlite_db.start_sync)
    session = staticmethod(sqlite_db.session)
    read = staticmethod(sqlite_db.read_sync)
    write = staticmethod(sqlite_db.write_sync)
    modify = staticmethod(sqlite_db.modify_sync)
    delete = staticmethod(sqlite_db.delete_sync)
    record_run = staticmethod(sqlite_db.record_run)
    get_host_delay = staticmethod(sqlite_db.get_host_delay_sync)
    get_host_info = staticmethod(sqlite_db.get_host_info_sync)
    wait_response = staticmethod(sqlite_db.wait_response_sync)
    check_task_error = staticmethod(sqlite_db.check_task_error_sync)
    check_task_custom_response = staticmethod(sqlite_db.check_task_custom_response_sync)
    put = staticmethod(sqlite_db.put_sync)
    store_get = staticmethod(sqlite_db.store_get_sync)
    store_set = staticmethod(sqlite_db.store_set_sync)
    store_update = staticmethod(sqlite_db.store_update_sync)
    database_path = staticmethod(sqlite_db.database_path)
    check_sqlite_file = staticmethod(sqlite_db.check_sqlite_file)
    table_sizes = staticmethod(sqlite_db.table_sizes)
    export_to = staticmethod(sqlite_db.export_to)
    import_from = staticmethod(sqlite_db.import_from)
