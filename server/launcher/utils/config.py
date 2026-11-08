import base64
import configparser
import os
import re
import secrets
import shutil
import subprocess
from pathlib import Path

cell_unit_scale = {
    "b": 1,
    "byte": 1,
    "bytes": 1,
    "k": 1024,
    "kb": 1024,
    "m": 1024**2,
    "mb": 1024**2,
    "g": 1024**3,
    "gb": 1024**3,
}
default_cell_amount = 5120
default_cell_unit = "mb"


def max_cell_value_bytes_from_conf(parser):
    # Reads the max cell size from the config and returns it in bytes
    amount = default_cell_amount
    unit = default_cell_unit

    if parser.has_section("server.database"):
        unit = (
            parser.get(
                "server.database",
                "max_cell_value_size_unit",
                fallback=default_cell_unit,
            )
            .strip()
            .lower()
        )
        raw = parser.get("server.database", "max_cell_value_bytes", fallback="").strip()
        if raw:
            try:
                amount = max(0, int(raw))
            except ValueError:
                amount = default_cell_amount

    return amount * cell_unit_scale.get(unit, 1)


def config_operations(operation, *args):
    # Here is where path, read, write and split of the config happen
    conf_path = Path(__file__).resolve().parents[2] / "server.conf"
    sections = (
        "server",
        "server.tls",
        "server.keys",
        "server.database",
        "server.runtime",
        "server.compiler",
        "server.nukescripts",
        "server.sandbox",
        "server.armory",
        "implants",
    )

    if operation == "path":
        return conf_path

    if operation == "read":
        parser = configparser.ConfigParser()
        parser.read(conf_path, encoding="utf-8")
        return parser

    if operation == "write":
        parser = args[0]
        with open(conf_path, "w", encoding="utf-8") as f:
            parser.write(f)
        return None

    if operation == "split":
        key = args[0]
        for section in sorted(sections, key=len, reverse=True):
            prefix = section + "."
            if key.startswith(prefix):
                return section, key[len(prefix) :]
        return None, None

    raise ValueError(f"unknown config operation: {operation}")


def create_default_config():
    # Creates the default server.conf with new secrets
    conf_path = config_operations("path")
    jwt_secret = secrets.token_hex(64)
    relay_aes_key = base64.b64encode(secrets.token_bytes(32)).decode("ascii")

    content = f"""[server]
host = 0.0.0.0
port = 9000

[server.tls]
tls = false
certfile =
keyfile =

[server.keys]
jwt.duration = 7d
jwt_secret = {jwt_secret}

[server.aes_sync]
secret_key =
sync_path = /sync

[server.database]
max_cell_value_size_unit = mb
max_cell_value_bytes = 5120

[server.runtime]
workers = 4
reload = false
loop = auto
http = auto
backlog = 2048
limit_concurrency = 100
limit_max_requests = 10000
timeout_keep_alive = 75
timeout_worker_healthcheck = 5
proxy_headers = true
forwarded_allow_ips = 127.0.0.1

[server.compiler]
sandbox = false

[server.nukescripts]
sandbox = false

[server.sandbox]
memory_max = 512M
memory_swap_max = 0
cpu_quota = 150%
tasks_max = 128
runtime_max = 20min
allowed_paths = /tmp, /var/tmp

[server.armory]
repository = https://github.com/nukeratframework/armory/

[implants]
relay_aes_key = {relay_aes_key}
"""
    conf_path.write_text(content, encoding="utf-8")
    return conf_path


def validate_config():
    # Checks if server.conf has the required keys and valid values
    sections = {
        "server": ("host", "port"),
        "server.tls": ("tls", "certfile", "keyfile"),
        "server.keys": ("jwt.duration", "jwt_secret"),
        "implants": ("relay_aes_key",),
    }
    bool_values = ("0", "1", "false", "true", "no", "yes", "off", "on")
    jwt_secret_min_len = 32
    relay_aes_key_min_len = 32

    conf_path = config_operations("path")
    if not conf_path.is_file():
        return f"Error: server.conf not found ({conf_path})"

    parser = config_operations("read")

    for section, keys in sections.items():
        if not parser.has_section(section):
            return f"Error: missing section [{section}] in server.conf"
        for key in keys:
            if not parser.has_option(section, key):
                return f"Error: missing key {key} in [{section}]"
            if section == "server.tls" and key in ("certfile", "keyfile"):
                continue
            if not str(parser.get(section, key)).strip():
                return f"Error: empty value for {key} in [{section}]"

    host = parser.get("server", "host").strip()
    if not host:
        return "Error: server.host must not be empty"

    try:
        port = int(parser.get("server", "port").strip())
    except ValueError:
        return "Error: server.port must be an integer"

    if port < 1 or port > 65535:
        return "Error: server.port must be between 1 and 65535"

    tls_raw = parser.get("server.tls", "tls").strip()
    if tls_raw.lower() not in bool_values:
        return f"Error: server.tls.tls must be one of {', '.join(sorted(bool_values))}"

    tls_on = tls_raw.lower() in ("1", "true", "yes", "on")
    if tls_on:
        certfile = parser.get("server.tls", "certfile").strip()
        keyfile = parser.get("server.tls", "keyfile").strip()
        if not certfile:
            return "Error: server.tls.certfile is required when tls is enabled"
        if not keyfile:
            return "Error: server.tls.keyfile is required when tls is enabled"
        if not os.path.isfile(certfile):
            return f"Error: TLS certfile not found ({certfile})"
        if not os.path.isfile(keyfile):
            return f"Error: TLS keyfile not found ({keyfile})"

    duration = parser.get("server.keys", "jwt.duration").strip().lower()
    if duration.isdigit():
        pass
    elif len(duration) >= 2 and duration[-1] in "dhms" and duration[:-1].isdigit():
        pass
    else:
        return "Error: server.keys.jwt.duration must be like 7d, 24h, 30m or minutes as integer"

    jwt_secret = parser.get("server.keys", "jwt_secret").strip()
    if len(jwt_secret) < jwt_secret_min_len:
        return f"Error: server.keys.jwt_secret must be at least {jwt_secret_min_len} characters"

    relay_key = parser.get("implants", "relay_aes_key").strip()
    if len(relay_key) < relay_aes_key_min_len:
        return f"Error: implants.relay_aes_key must be at least {relay_aes_key_min_len} characters"

    if parser.has_section("server.database"):
        raw_bytes = parser.get("server.database", "max_cell_value_bytes", fallback="").strip()
        if raw_bytes:
            try:
                if int(raw_bytes) < 0:
                    return "Error: server.database.max_cell_value_bytes must be >= 0"
            except ValueError:
                return "Error: server.database.max_cell_value_bytes must be an integer"

    if parser.has_section("server.nukescripts"):
        raw = parser.get("server.nukescripts", "sandbox", fallback="false").strip().lower()
        if raw not in bool_values:
            return (
                "Error: server.nukescripts.sandbox must be one of "
                + ", ".join(sorted(bool_values))
            )

    return None


def config_list():
    # Prints every config key and its value
    parser = config_operations("read")
    for section in parser.sections():
        for key, value in parser.items(section):
            print(f"{section}.{key} = {value}")


def config_set(key, value):
    # Sets a config key and writes it to server.conf
    section, option = config_operations("split", key.strip())
    if not section or not option:
        print(f"Error: unknown config key {key}")
        return 1

    parser = config_operations("read")
    if not parser.has_section(section):
        parser.add_section(section)
    parser.set(section, option, value)
    config_operations("write", parser)

    err = validate_config()
    if err:
        print(err)
        return 1

    return 0


def config_reset(key):
    # Resets a config key back to the default value
    defaults = {
        "server.host": "0.0.0.0",
        "server.port": "9000",
        "server.tls.tls": "false",
        "server.tls.certfile": "",
        "server.tls.keyfile": "",
        "server.keys.jwt.duration": "7d",
        "server.runtime.workers": "4",
        "server.runtime.reload": "false",
        "server.runtime.loop": "auto",
        "server.runtime.http": "auto",
        "server.runtime.backlog": "2048",
        "server.runtime.limit_concurrency": "100",
        "server.runtime.limit_max_requests": "10000",
        "server.runtime.timeout_keep_alive": "75",
        "server.runtime.timeout_worker_healthcheck": "5",
        "server.runtime.proxy_headers": "true",
        "server.runtime.forwarded_allow_ips": "127.0.0.1",
    }
    key = key.strip()
    if key == "server.keys.jwt_secret":
        value = secrets.token_hex(64)
    elif key == "implants.relay_aes_key":
        value = secrets.token_hex(64)
    elif key in defaults:
        value = defaults[key]
    else:
        print(f"Error: unknown config key {key}")
        return 1

    return config_set(key, value)


def config_load(path):
    # Copies a config file over server.conf and validates it
    src = Path(path).expanduser()
    if not src.is_file():
        print(f"Error: file not found ({src})")
        return 1

    shutil.copy(src, config_operations("path"))

    err = validate_config()
    if err:
        print(err)
        return 1

    return 0


def config_create_tls():
    # Creates a self signed certificate and enables TLS
    server_root = Path(__file__).resolve().parents[2]
    certs_dir = (server_root / "infra" / "certs").resolve()
    certs_dir.mkdir(parents=True, exist_ok=True)

    certfile = certs_dir / "cert.pem"
    keyfile = certs_dir / "key.pem"
    parser = config_operations("read")
    conf_cert = ""
    conf_key = ""
    if parser.has_section("server.tls"):
        conf_cert = parser.get("server.tls", "certfile", fallback="").strip()
        conf_key = parser.get("server.tls", "keyfile", fallback="").strip()

    if conf_cert or conf_key:
        print(
            f"Current TLS paths: certfile={conf_cert or '(unset)'}, "
            f"keyfile={conf_key or '(unset)'}"
        )
        answer = input(
            "Replace existing TLS certificate paths with a new self-signed certificate? [y/N]: "
        ).strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled.")
            return 0

    if conf_cert and conf_key:
        cp = Path(conf_cert).expanduser().resolve()
        kp = Path(conf_key).expanduser().resolve()
        if cp.parent == certs_dir:
            certfile = cp
        if kp.parent == certs_dir:
            keyfile = kp

    for path in (certfile, keyfile):
        if path.is_file():
            path.unlink()

    try:
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-keyout",
                str(keyfile),
                "-out",
                str(certfile),
                "-days",
                "365",
                "-nodes",
                "-subj",
                "/CN=localhost",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        print("Error: openssl not found")
        return 1
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        print(f"Error: openssl failed ({detail})")
        return 1

    cert_path = str(certfile)
    key_path = str(keyfile)
    if not parser.has_section("server.tls"):
        parser.add_section("server.tls")
    parser.set("server.tls", "tls", "true")
    parser.set("server.tls", "certfile", cert_path)
    parser.set("server.tls", "keyfile", key_path)
    config_operations("write", parser)

    err = validate_config()
    if err:
        print(err)
        return 1

    print(f"TLS enabled (cert={cert_path}, key={key_path})")
    return 0


def ensure_secrets(parser):
    # Fills jwt secret and relay key when they are empty
    changed = False
    if not parser.has_section("server.keys"):
        parser.add_section("server.keys")
    if not parser.get("server.keys", "jwt_secret", fallback="").strip():
        parser.set("server.keys", "jwt_secret", secrets.token_hex(64))
        changed = True

    if not parser.has_section("implants"):
        parser.add_section("implants")
    if not parser.get("implants", "relay_aes_key", fallback="").strip():
        parser.set(
            "implants",
            "relay_aes_key",
            base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
        )
        changed = True

    if changed:
        config_operations("write", parser)


def load_config():
    # Main function that reads server.conf and builds the runtime config
    server_root = Path(__file__).resolve().parents[2]
    conf_path = config_operations("path")
    if not conf_path.is_file():
        create_default_config()

    parser = configparser.ConfigParser()
    parser.read(conf_path, encoding="utf-8")
    ensure_secrets(parser)

    tls = ""
    if parser.has_section("server.tls"):
        tls = parser.get("server.tls", "tls", fallback="false")
    ssl = str(tls).strip().lower() in ("1", "true", "yes", "on")

    certfile = None
    keyfile = None
    if parser.has_section("server.tls"):
        certfile = parser.get("server.tls", "certfile", fallback="").strip() or None
        keyfile = parser.get("server.tls", "keyfile", fallback="").strip() or None
    if not ssl:
        certfile = None
        keyfile = None

    database = os.path.abspath(server_root / "infra" / "database" / "database.db")

    host = "0.0.0.0"
    port = 9000
    if parser.has_section("server"):
        host = parser.get("server", "host", fallback="0.0.0.0").strip()
        port = int(parser.get("server", "port", fallback="9000").strip())

    jwt_duration = "7d"
    jwt_secret = ""
    if parser.has_section("server.keys"):
        jwt_duration = parser.get("server.keys", "jwt.duration", fallback="7d").strip()
        jwt_secret = parser.get("server.keys", "jwt_secret", fallback="").strip()

    jwt_expire_minutes = 10080
    duration = str(jwt_duration).strip().lower()
    if duration.isdigit():
        jwt_expire_minutes = int(duration)
    elif duration and duration[-1] in "dhms":
        try:
            n = int(duration[:-1])
            if duration[-1] == "d":
                jwt_expire_minutes = n * 24 * 60
            elif duration[-1] == "h":
                jwt_expire_minutes = n * 60
            elif duration[-1] == "m":
                jwt_expire_minutes = n
            else:
                jwt_expire_minutes = max(1, n // 60)
        except ValueError:
            jwt_expire_minutes = 10080

    relay_aes_key = ""
    if parser.has_section("implants"):
        relay_aes_key = parser.get("implants", "relay_aes_key", fallback="").strip()

    aes_sync_secret = ""
    aes_sync_path = "/sync"
    if parser.has_section("server.aes_sync"):
        aes_sync_secret = parser.get("server.aes_sync", "secret_key", fallback="").strip()
        aes_sync_path = parser.get("server.aes_sync", "sync_path", fallback="/sync").strip() or "/sync"
    if not aes_sync_path.startswith("/"):
        aes_sync_path = f"/{aes_sync_path}"

    max_cell_value_bytes = max_cell_value_bytes_from_conf(parser)

    armory_repository = "https://github.com/nukeratframework/armory/"
    if parser.has_section("server.armory"):
        raw = parser.get("server.armory", "repository", fallback="").strip()
        if raw:
            armory_repository = raw

    build_sandbox = False
    if parser.has_section("server.compiler"):
        raw = parser.get("server.compiler", "sandbox", fallback="false").strip().lower()
        build_sandbox = raw in ("1", "true", "yes", "on")

    nukescripts_sandbox = False
    if parser.has_section("server.nukescripts"):
        raw = parser.get("server.nukescripts", "sandbox", fallback="false").strip().lower()
        nukescripts_sandbox = raw in ("1", "true", "yes", "on")

    def sandbox_value(key, default):
        # Reads one sandbox limit from the config
        if not parser.has_section("server.sandbox"):
            return default
        raw = parser.get("server.sandbox", key, fallback="", raw=True).strip()
        return raw if raw else default

    sandbox_limits = {
        "memory_max": sandbox_value("memory_max", "512M"),
        "memory_swap_max": sandbox_value("memory_swap_max", "0"),
        "cpu_quota": sandbox_value("cpu_quota", "150%"),
        "tasks_max": sandbox_value("tasks_max", "128"),
        "runtime_max": sandbox_value("runtime_max", "20min"),
        "allowed_paths": [
            part
            for part in re.split(r"[, \t]+", sandbox_value("allowed_paths", "/tmp, /var/tmp"))
            if part
        ],
    }

    def runtime_bool(key, default=False):
        # Reads a bool from the runtime section
        if not parser.has_section("server.runtime"):
            return default
        raw = parser.get("server.runtime", key, fallback="").strip().lower()
        if not raw:
            return default
        return raw in ("1", "true", "yes", "on")

    def runtime_str(key, default):
        # Reads a string from the runtime section
        if not parser.has_section("server.runtime"):
            return default
        raw = parser.get("server.runtime", key, fallback="").strip()
        return raw if raw else default

    def runtime_int(key, default):
        # Reads an integer from the runtime section
        raw = runtime_str(key, "")
        if not raw:
            return default
        return int(raw)

    def runtime_optional_int(key, section_default=None):
        # Reads an optional integer from the runtime section
        if not parser.has_section("server.runtime"):
            return section_default
        raw = parser.get("server.runtime", key, fallback="").strip()
        if not raw:
            return None
        return int(raw)

    workers = runtime_int("workers", 4)
    web_concurrency = os.environ.get("WEB_CONCURRENCY", "").strip()
    if web_concurrency:
        try:
            workers = max(1, int(web_concurrency))
        except ValueError:
            pass

    return {
        "paths": {"database": database},
        "database": {"max_cell_value_bytes": max_cell_value_bytes},
        "config": {
            "host": host,
            "port": port,
            "protocol": "https" if ssl else "http",
            "certfile": certfile,
            "keyfile": keyfile,
            "jwt_secret": jwt_secret,
            "jwt_expire_minutes": jwt_expire_minutes,
            "workers": workers,
            "reload": runtime_bool("reload", False),
            "loop": runtime_str("loop", "auto"),
            "http": runtime_str("http", "auto"),
            "backlog": runtime_int("backlog", 2048),
            "limit_concurrency": runtime_optional_int("limit_concurrency", 100),
            "limit_max_requests": runtime_optional_int("limit_max_requests", 10000),
            "timeout_keep_alive": runtime_int("timeout_keep_alive", 75),
            "timeout_worker_healthcheck": runtime_int("timeout_worker_healthcheck", 5),
            "proxy_headers": runtime_bool("proxy_headers", True),
            "forwarded_allow_ips": runtime_str("forwarded_allow_ips", "127.0.0.1"),
        },
        "implants": {"relay_aes_key": relay_aes_key},
        "aes_sync": {"secret_key": aes_sync_secret, "sync_path": aes_sync_path},
        "armory": {"repository": armory_repository.rstrip("/")},
        "compiler": {"sandbox": build_sandbox},
        "nukescripts": {"sandbox": nukescripts_sandbox},
        "sandbox": sandbox_limits,
    }


config = load_config()


def sandbox_scope(argv):
    # Wraps the command with the sandbox limits from the config
    run = shutil.which("systemd-run")
    if not run:
        return list(argv)

    limits = config.get("sandbox") or {}
    pairs = (
        ("MemoryMax", "memory_max"),
        ("MemorySwapMax", "memory_swap_max"),
        ("CPUQuota", "cpu_quota"),
        ("TasksMax", "tasks_max"),
        ("RuntimeMaxSec", "runtime_max"),
    )
    prefix = [run, "--user", "--scope", "--quiet", "--collect"]
    for prop, key in pairs:
        value = str(limits.get(key, "")).strip()
        if value:
            prefix.extend(["-p", f"{prop}={value}"])
    prefix.append("--")
    return prefix + list(argv)
