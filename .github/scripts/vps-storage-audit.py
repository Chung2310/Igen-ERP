"""Read Docker storage metadata and cache sizes without modifying containers."""

import datetime
import glob
import json
import os
import re
import subprocess
import sys


def command(args, timeout=60):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def checked(args, timeout=60):
    result = command(args, timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "Command failed: " + args[0])
    return result.stdout


def byte_size(value):
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    match = re.fullmatch(r"([\d.]+)\s*([KMGT]?B)", text, re.IGNORECASE)
    if not match:
        return None
    return int(float(match[1]) * 1000 ** ["B", "KB", "MB", "GB", "TB"].index(match[2].upper()))


def layer_summary(layer):
    instruction = layer.get("CreatedBy", "")
    lowered = instruction.lower()
    recursive = bool(re.search(r"\bchown\s+-[a-zA-Z]*R[a-zA-Z]*\b", instruction)) or "chown --recursive" in lowered
    install = next((name for name in ["yarn install", "npm ci", "npm install", "pnpm install"] if name in lowered), None)
    if install:
        operation = install
    elif recursive:
        operation = "recursive ownership change"
    elif "apk add" in lowered or "apt-get install" in lowered:
        operation = "system packages"
    elif "copy " in lowered:
        operation = "COPY"
    elif "add " in lowered:
        operation = "ADD"
    else:
        operation = "other build step"
    return {"bytes": byte_size(layer.get("Size", 0)), "operation": operation,
            "system_install": "apk add" in lowered or "apt-get install" in lowered,
            "recursive_chown": recursive, "dependency_install": install}


cache_paths = [
    "/usr/local/share/.cache/yarn", "/root/.cache/yarn", "/home/node/.cache/yarn",
    "/root/.npm", "/home/node/.npm", "/root/.cache/ffmpeg-static-nodejs",
    "/home/node/.cache/ffmpeg-static-nodejs", "/app/.cache",
    "/app/node_modules", "/usr/local/lib/node_modules/n8n", "/tmp",
]
report = {"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "containers": [], "images": [], "errors": []}
report["docker_version"] = checked(["docker", "version", "--format", "{{.Server.Version}}"]).strip()
fields = checked(["df", "-B1", "--output=size,used,avail,pcent", "/"]).strip().splitlines()[-1].split()
report["filesystem"] = {"size_bytes": int(fields[0]), "used_bytes": int(fields[1]),
                        "available_bytes": int(fields[2]), "used_percent": int(fields[3].rstrip("%"))}
report["docker_disk_usage"] = checked(["docker", "system", "df", "-v"], timeout=120)
container_ids = checked(["docker", "ps", "-aq", "--no-trunc"]).split()
container_template = (
    '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},'
    '"image_id":{{json .Image}},"status":{{json .State.Status}},"writable_bytes":{{.SizeRw}},'
    '"log_path":{{json .LogPath}},"log_driver":{{json .HostConfig.LogConfig.Type}},'
    '"mounts":{{json .Mounts}}}'
)
if container_ids:
    output = checked(["docker", "inspect", "--size", "--format", container_template, *container_ids], timeout=120)
    for line in output.splitlines():
        row = json.loads(line)
        row["name"] = row["name"].lstrip("/")
        row["mounts"] = [{"type": mount.get("Type"), "destination": mount.get("Destination")}
                         for mount in row.get("mounts", [])]
        row["log_bytes"] = 0
        log_path = row.pop("log_path", "")
        if log_path:
            try:
                for filename in glob.glob(log_path + "*"):
                    if os.path.isfile(filename):
                        info = os.stat(filename)
                        row["log_bytes"] += getattr(info, "st_blocks", 0) * 512 or info.st_size
            except OSError as error:
                row["log_probe_error"] = error.strerror
        row["path_bytes"] = {}
        if row["status"] == "running":
            try:
                usage = command(["docker", "exec", "--user", "0", row["id"], "du", "-sk", *cache_paths], timeout=30)
                for entry in usage.stdout.splitlines():
                    pieces = entry.split(None, 1)
                    if len(pieces) == 2 and pieces[0].isdigit():
                        row["path_bytes"][pieces[1]] = int(pieces[0]) * 1024
                if not row["path_bytes"] and usage.returncode:
                    row["cache_probe_note"] = "Requested paths or du unavailable in this container"
            except subprocess.TimeoutExpired:
                row["cache_probe_note"] = "Cache measurement timed out"
        report["containers"].append(row)

image_ids = set(checked(["docker", "image", "ls", "-q", "--no-trunc"]).split())
image_ids.update(row["image_id"] for row in report["containers"])
image_template = '{"id":{{json .Id}},"tags":{{json .RepoTags}},"size_bytes":{{.Size}}}'
for image_id in sorted(image_ids):
    try:
        row = json.loads(checked(["docker", "image", "inspect", "--format", image_template, image_id]))
        row["used_by"] = [container["name"] for container in report["containers"] if container["image_id"] == row["id"]]
        output = checked(["docker", "history", "--human=false", "--no-trunc", "--format", "{{json .}}", image_id])
        layers = [layer_summary(json.loads(line)) for line in output.splitlines() if line.strip()]
        row["large_layers"] = sorted([layer for layer in layers if (layer["bytes"] or 0) >= 16 * 1000 ** 2],
                                      key=lambda layer: layer["bytes"], reverse=True)[:10]
        row["standalone_ownership_layer_bytes"] = sum(
            layer["bytes"] or 0 for layer in layers
            if layer["recursive_chown"] and not layer["dependency_install"] and not layer["system_install"])
        report["images"].append(row)
    except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
        report["errors"].append({"image_id": image_id, "message": str(error)})

report["containers"].sort(key=lambda row: row["name"])
report["images"].sort(key=lambda row: row["size_bytes"], reverse=True)
report["total_writable_bytes"] = sum(row.get("writable_bytes") or 0 for row in report["containers"])
report["total_log_bytes"] = sum(row.get("log_bytes") or 0 for row in report["containers"])
json.dump(report, sys.stdout, ensure_ascii=True, indent=2)
sys.stdout.write("\n")
