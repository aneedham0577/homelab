"""Pi-hole service — bind-mount volume dirs owned by PUID/PGID."""
from __future__ import annotations

import os
from pathlib import Path
import shutil

from setup.service import Service, VolumeDir
from setup.ui import ok, warn
from setup.utils import docker_exec, gen_secret, wait_for_container_healthy


class PiholeService(Service):
    name = "pihole"

    def setup(self, env: dict) -> None:
        puid = int(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = int(env.get("PGID") or os.environ.get("PGID") or "1000")
        self.volume_dirs = [
            VolumeDir("./services/pihole/volumes/etc-pihole", uid=puid, gid=pgid, mode=0o700),
            VolumeDir("./services/pihole/volumes/logs", uid=puid, gid=pgid, mode=0o700),
        ]
        super().setup(env)
        gen_secret("pihole_admin_password", 32)

    def postsetup(self, env: dict) -> None:
        if not shutil.which("docker"):
            return
        pw_file = Path("./volumes/secrets/pihole_admin_password")
        if not pw_file.is_file():
            warn("pihole_admin_password missing; skip Pi-hole admin password sync")
            return
        password = pw_file.read_text(encoding="utf-8").strip()
        if not password:
            return

        if not wait_for_container_healthy("pihole", timeout=60):
            warn("Pi-hole container not healthy; skip admin password sync")
            return

        # pihole setpassword takes password directly or via non-interactive argument
        out = docker_exec("pihole", "pihole", "setpassword", password, check=False)
        if "Password reset" in out or "Password changed" in out or "New password set" in out or out == "":
            ok("Pi-hole admin password synchronized")
        else:
            warn(f"Pi-hole setpassword output: {out}")


service = PiholeService()
