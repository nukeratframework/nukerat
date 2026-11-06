import os
import shlex
import shutil

from launcher.utils.config import config, sandbox_scope


def create_syntax_for_sandbox_build(
    args,
    cwd,
    env=None,
    ro_binds=None,
    rw_binds=None,
):
    # Wraps the build command in the sandbox
    argv = list(args)
    workdir = os.path.abspath(cwd)

    if not config.get("compiler", {}).get("sandbox"):
        return argv

    raw = os.environ.get("IMPLANT_NIM_BUILD_PREFIX", "").strip()
    if raw:
        template = raw.replace("{cwd}", workdir)
        return sandbox_scope(shlex.split(template) + argv)

    bwrap = shutil.which("bwrap") or shutil.which("bubblewrap")
    if not bwrap:
        return argv

    choosenim = os.path.realpath(os.path.join(os.path.expanduser("~"), ".choosenim"))
    prefix = [
        bwrap,
        "--unshare-all",
        "--die-with-parent",
        "--new-session",
        "--clearenv",
        "--setenv",
        "PATH",
        "/usr/bin:/bin:/usr/sbin:/sbin",
        "--setenv",
        "HOME",
        workdir,
        "--setenv",
        "TMPDIR",
        "/tmp",
        "--setenv",
        "LANG",
        os.environ.get("LANG", "C.UTF-8") or "C.UTF-8",
        "--proc",
        "/proc",
        "--dev-bind",
        "/dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--ro-bind",
        "/usr",
        "/usr",
        "--ro-bind",
        "/lib",
        "/lib",
        "--ro-bind",
        "/etc",
        "/etc",
        "--bind",
        workdir,
        workdir,
        "--chdir",
        workdir,
    ]
    for key in (
        "NIM_BIN",
        "MINGW64_GCC",
        "MINGW32_GCC",
        "AARCH64_LINUX_GNU_GCC",
    ):
        val = os.environ.get(key, "").strip()
        if val:
            prefix.extend(["--setenv", key, val])
    for syspath in ("/bin", "/sbin"):
        if os.path.lexists(syspath):
            prefix.extend(["--ro-bind", syspath, syspath])
    lib64 = "/lib64"
    if os.path.isdir(lib64):
        prefix.extend(["--ro-bind", lib64, lib64])
    lib_machine = os.path.join("/lib", os.uname().machine)
    if os.path.isdir(lib_machine):
        prefix.extend(["--ro-bind", lib_machine, lib_machine])
    if os.path.isdir(choosenim):
        prefix.extend(["--ro-bind", choosenim, choosenim])
    for host_path in ro_binds or []:
        resolved = os.path.realpath(host_path)
        if os.path.exists(resolved):
            prefix.extend(["--ro-bind", resolved, resolved])
    for host_path in rw_binds or []:
        resolved = os.path.realpath(host_path)
        if os.path.exists(resolved):
            prefix.extend(["--bind", resolved, resolved])
    if env:
        for key, value in env.items():
            if value is not None and str(value) != "":
                prefix.extend(["--setenv", key, str(value)])
    extra = os.environ.get("IMPLANT_NIM_BUILD_BWRAP_BIND", "").strip()
    if extra:
        prefix.extend(shlex.split(extra.replace("{cwd}", workdir)))
    prefix.append("--")
    return sandbox_scope(prefix + argv)
