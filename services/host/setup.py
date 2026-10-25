"""Host service — installs systemd units for host-api, backup timers, timesyncd, and docker."""
from __future__ import annotations

import os
import pwd
import grp
import shlex
import shutil
import sys
import tempfile

from setup.service import Service
from setup.ui import error, ok, section, skip, step, warn
from setup.utils import load_env, prompt_yes_no, run_cmd, substitute_env_vars


def _username_for_puid(puid: str) -> str | None:
    """Resolve OS login name for a numeric PUID (systemd User= may be numeric)."""
    try:
        return pwd.getpwuid(int(puid)).pw_name
    except (KeyError, ValueError, OverflowError, TypeError):
        return None


def _host_user_group() -> tuple[str, str]:
    """User/group when PUID cannot be resolved (e.g. sudo session)."""
    sudo_user = os.environ.get("SUDO_USER")
    if os.geteuid() == 0 and sudo_user:
        pw = pwd.getpwnam(sudo_user)
    else:
        pw = pwd.getpwuid(os.getuid())
    return pw.pw_name, grp.getgrgid(pw.pw_gid).gr_name


class HostService(Service):
    name = "host"
    volume_dirs = []

    def setup(self, env: dict, interactive: bool = True) -> None:
        section("Host Systemd Units", emoji="⚙️")
        if interactive and not prompt_yes_no(
            "Install host units (host-api, backup timer, docker, timesyncd)? [Y/n]: ",
            default=True,
        ):
            skip("Skipped")
            return

        project_root = os.path.abspath(os.getcwd())
        units_src = os.path.join(project_root, "services", "host", "systemd", "system")
        if not os.path.isdir(units_src):
            warn(f"Missing {units_src}; skipping")
            return

        # Prefer the setup-generated .env for PROJECT_ROOT / PUID / PGID.
        if os.path.isfile(".env"):
            load_env(".env")
        os.environ["PROJECT_ROOT"] = os.environ.get("PROJECT_ROOT") or project_root
        os.environ["PROJECT_ROOT"] = os.path.abspath(os.environ["PROJECT_ROOT"])
        os.environ.setdefault("PUID", str(os.getuid()))
        os.environ.setdefault("PGID", str(os.getgid()))
        os.environ["PYTHON"] = sys.executable or "/usr/bin/python3"

        for name in sorted(os.listdir(units_src)):
            if not name.endswith((".service", ".timer")):
                continue
            src = os.path.join(units_src, name)
            with open(src, encoding="utf-8") as f:
                content = substitute_env_vars(f.read())
            if "${" in content or "$PUID" in content or "$PROJECT_ROOT" in content:
                error(f"Unsubstituted variables in {name}")
                step("Ensure .env defines PROJECT_ROOT, PUID, and PGID.")
                sys.exit(1)
            dest = f"/etc/systemd/system/{name}"
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=f"-{name}") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                run_cmd(f"sudo cp {shlex.quote(tmp_path)} {shlex.quote(dest)}")
                run_cmd(f"sudo chmod 644 {shlex.quote(dest)}")
            finally:
                os.unlink(tmp_path)

        host_api = os.path.join(os.environ["PROJECT_ROOT"], "services", "dashboard", "host-api")
        if not shutil.which("npm"):
            error("npm is required for the host API (install Node.js / npm)")
            sys.exit(1)
        step(f"npm install → {host_api}")
        run_cmd("npm install", cwd=host_api, capture=False)

        run_cmd("sudo systemctl daemon-reload")

        # Docker Desktop / WSL often has no docker.socket unit; docker may already be available.
        if run_cmd("sudo systemctl enable --now docker.socket docker.service", check=False) is None:
            skip("docker.socket/docker.service (common on WSL / Docker Desktop)")
        elif not shutil.which("docker"):
            warn("docker.service enabled but `docker` not found on PATH")

        for unit in (
            "homelab-host-api.service",
            "homelab-backup.timer",
        ):
            run_cmd(f"sudo systemctl enable --now {unit}")

        if shutil.which("pacman"):
            run_cmd("sudo systemctl enable --now pacman-sync.timer")

        run_cmd("sudo systemctl restart homelab-host-api.service", check=False)
        run_cmd("sudo systemctl enable --now systemd-timesyncd.service", check=False)
        sync = run_cmd("timedatectl show -p NTPSynchronized --value", check=False) or ""
        if sync.strip() != "yes":
            warn("Clock not NTP-synchronized yet (check systemd-timesyncd)")

        user = _username_for_puid(os.environ["PUID"]) or _host_user_group()[0]
        added_docker_group = False
        if user != "root":
            groups = run_cmd(f"id -nG {user}", check=False) or ""
            if "docker" not in groups.split():
                step(f"Adding {user} to docker group")
                run_cmd(f"sudo usermod -aG docker {shlex.quote(user)}")
                added_docker_group = True

        ok("Host units installed")

        if added_docker_group and os.geteuid() != 0:
            setup_py = shlex.quote(os.path.abspath(sys.argv[0]))
            py = shlex.quote(sys.executable)
            root = shlex.quote(project_root)
            section("Re-running setup with docker group…", emoji="🔄")
            os.execvp(
                "sg",
                [
                    "sg",
                    "docker",
                    "-c",
                    f"cd {root} && {py} {setup_py}",
                ],
            )


service = HostService()
