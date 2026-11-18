#!/bin/sh
set -eu
task_pid=$1
task_source=$2
task_target=$3
task_job=$4
task_result=$5
task_stage=''
task_success=0
cleanup() {
  if [ -n "$task_stage" ]; then
    if [ -f "$task_stage/Previous" ]; then
      if [ "$task_success" != 1 ]; then
        rm -f -- "$task_target"
        if ! mv -- "$task_stage/Previous" "$task_target"; then task_stage=''; fi
      fi
    fi
    if [ -n "$task_stage" ]; then rm -rf -- "$task_stage"; fi
  fi
  if [ "$task_success" = 1 ]; then printf '{"status":"installed"}\n' > "$task_result";
  else
    printf '{"status":"failed"}\n' > "$task_result"
    "$task_target" --hidden >/dev/null 2>&1 &
  fi
  rm -rf -- "$task_job"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
task_stage=$(mktemp -d "$(dirname "$task_target")/.Limits-update.XXXXXX")
cp -- "$task_source" "$task_stage/Next"
chmod 755 "$task_stage/Next"
task_wait=0
while kill -0 "$task_pid" 2>/dev/null; do
  task_wait=$((task_wait + 1)); [ "$task_wait" -lt 60 ] || exit 1
  sleep 1
done
mv -- "$task_target" "$task_stage/Previous"
mv -- "$task_stage/Next" "$task_target"
"$task_target" --hidden >/dev/null 2>&1 &
task_launched=$!
sleep 1
kill -0 "$task_launched" 2>/dev/null || exit 1
task_success=1
