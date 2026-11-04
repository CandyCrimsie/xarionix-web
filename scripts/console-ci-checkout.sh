#!/bin/sh
set -eu
umask 077
: "${CI_SERVER_URL:?GitLab environment required}"
: "${CI_PROJECT_NAMESPACE:?GitLab namespace required}"
: "${CI_JOB_TOKEN:?GitLab job credential required}"
core_dir="${CI_PROJECT_DIR:?}/.console-core"
test ! -e "$core_dir" || { echo 'Refusing to overwrite an existing Core checkout'; exit 1; }
askpass=$(mktemp)
trap 'rm -f "$askpass"' EXIT HUP INT TERM
cat > "$askpass" <<'EOF'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' gitlab-ci-token ;;
  *Password*) printf '%s\n' "$CI_JOB_TOKEN" ;;
  *) exit 1 ;;
esac
EOF
chmod 700 "$askpass"
export GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0
git clone --quiet --no-checkout "$CI_SERVER_URL/$CI_PROJECT_NAMESPACE/xarionix-core.git" "$core_dir"
git -C "$core_dir" checkout --quiet "${CONSOLE_CORE_REF:-c6ab57707a0b2b486715017316e67d52b80b6d4e}"
