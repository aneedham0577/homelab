# 🖥️ Host System Services

Manages systemd unit templates and host-level services for the homelab host OS.

## Included Units

* **`homelab-host-api.service`**: Privileged host daemon listening on port 5001 for system updates, monitoring, and WoL.
* **`homelab-backup.service` & `homelab-backup.timer`**: Daily automated Restic backups.
* **`pacman-sync.service` & `pacman-sync.timer`**: Periodic pacman repository sync (Arch Linux).
* **`timesyncd.conf`**: NTP configuration.

## Usage

To install or reinstall host units:

```bash
python3 setup.py setup -s host
```
