#!/bin/sh
set -eu
umask 077
: "${CI_SERVER_URL:?GitLab environment required}"
: "${CI_PROJECT_NAMESPACE:?GitLab namespace required}"
: "${CI_JOB_TOKEN:?GitLab job credential required}"
: "${CONSOLE_CORE_REF:?Set the reviewed Sprint 6B Core commit SHA; the baseline lacks storage APIs}"
: "${CONSOLE_ERP_REF:?Set the reviewed ERP OIDC bridge commit SHA for real shared-session integration}"
validate_ref() {
  case "$1" in
    *[!0-9a-f]*|'') echo "$2 must be a complete immutable commit SHA"; exit 1 ;;
  esac
  test "${#1}" -eq 40 || { echo "$2 must contain 40 hexadecimal characters"; exit 1; }
}
validate_ref "$CONSOLE_CORE_REF" CONSOLE_CORE_REF
validate_ref "$CONSOLE_ERP_REF" CONSOLE_ERP_REF
core_dir="${CI_PROJECT_DIR:?}/.console-core"
erp_dir="$CI_PROJECT_DIR/.console-erp"
test ! -e "$core_dir" || { echo 'Refusing to overwrite an existing Core checkout'; exit 1; }
test ! -e "$erp_dir" || { echo 'Refusing to overwrite an existing ERP checkout'; exit 1; }
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
git -C "$core_dir" checkout --quiet --detach "$CONSOLE_CORE_REF"
test "$(git -C "$core_dir" rev-parse HEAD)" = "$CONSOLE_CORE_REF"
git clone --quiet --no-checkout "$CI_SERVER_URL/$CI_PROJECT_NAMESPACE/xarionix-erp.git" "$erp_dir"
git -C "$erp_dir" checkout --quiet --detach "$CONSOLE_ERP_REF"
test "$(git -C "$erp_dir" rev-parse HEAD)" = "$CONSOLE_ERP_REF"
