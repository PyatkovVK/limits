#!/bin/sh
set -eu
task_pid=$1
task_source=$2
task_target=$3
task_job=$4
task_result=$5
task_parent=$(/usr/bin/dirname "$task_target")
task_staging=''
task_success=0
cleanup() {
  if [ -n "$task_staging" ]; then
    if [ -d "$task_staging/Previous.app" ] && [ ! -e "$task_target" ]; then
      /bin/mv "$task_staging/Previous.app" "$task_target" || true
    fi
    /bin/rm -rf "$task_staging"
  fi
  if [ "$task_success" = 1 ]; then
    printf '{"status":"installed"}\n' > "$task_result"
  else
    printf '{"status":"failed"}\n' > "$task_result"
    /usr/bin/open "$task_target" || true
  fi
  /bin/rm -rf "$task_job"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
task_staging=$(/usr/bin/mktemp -d "$task_parent/.Limits-update.XXXXXX")
/usr/bin/ditto "$task_source" "$task_staging/Limits.app"
task_wait=0
while /bin/kill -0 "$task_pid" 2>/dev/null; do
  task_wait=$((task_wait + 1))
  [ "$task_wait" -lt 60 ] || exit 1
  /bin/sleep 1
done
/bin/mv "$task_target" "$task_staging/Previous.app"
/bin/mv "$task_staging/Limits.app" "$task_target"
if ! /usr/bin/open "$task_target"; then
  /bin/rm -rf "$task_target"
  /bin/mv "$task_staging/Previous.app" "$task_target"
  exit 1
fi
task_success=1
