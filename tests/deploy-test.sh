#!/usr/bin/env bash
# Tests server-deploy against a temporary home directory, with a stub server-restart in the
# bundles it installs. Run from anywhere: tests/deploy-test.sh
#
# Where flock is installed (Linux), deploys take their lock as on the server, and the lock tests
# run; elsewhere they run with SERVER_DEPLOY_NO_LOCK=1.
set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
SERVER_DEPLOY=${SCRIPT_DIR}/../server-deploy

WORK=$(mktemp -d)
trap 'rm -rf "${WORK}"' EXIT
FAILURES=0

fail() {
    echo "FAIL: $*" >&2
    FAILURES=$((FAILURES + 1))
}

expect_file() { [ -f "$1" ] || fail "${CURRENT}: expected $1"; }
expect_no_path() { [ ! -e "$1" ] && [ ! -L "$1" ] || fail "${CURRENT}: expected no $1"; }

# Starts a test with a fresh home directory and an empty bundle directory
start() {
    CURRENT=$1
    TEST_HOME=${WORK}/${CURRENT}/home
    BUNDLE=${WORK}/${CURRENT}/bundle
    mkdir -p "${TEST_HOME}" "${BUNDLE}"
    echo "--- ${CURRENT}"
}

# Adds files to the bundle, each holding its own path and a version
add() {
    local path
    [ "${1:-}" != -- ] || shift
    for path in "$@"; do
        mkdir -p "$(dirname -- "${BUNDLE}/${path}")"
        echo "${path} ${VERSION:-1}" > "${BUNDLE}/${path}"
    done
}

# Adds the scripts every bundle must ship: a stand-in server-deploy (the tests run the real one)
# and a stub server-restart, which records that it ran, runs its arguments as a command, and
# exits with RESTART_STATUS
add_restart() {
    add server-deploy
    {
        echo '#!/usr/bin/env bash'
        echo 'echo restarted >> "${HOME}/restarts"'
        [ $# -eq 0 ] || echo "$*"
        echo 'exit ${RESTART_STATUS:-0}'
    } > "${BUNDLE}/server-restart"
    chmod +x "${BUNDLE}/server-restart"
}

# Zips the bundle, with a MANIFEST of its files unless one is already there, and clears it for
# the next one
pack() {
    # Runs in a command substitution, so it can't count; zip would add to an existing archive
    local zip
    zip=$(mktemp "${WORK}/${CURRENT}/bundle-XXXXXX")
    rm "${zip}"
    zip=${zip}.zip
    (
        cd "${BUNDLE}"
        if [ ! -f MANIFEST ]; then
            find . -type f | sed 's|^\./||' | LC_ALL=C sort > ../MANIFEST
            mv ../MANIFEST MANIFEST
        fi
        zip -qry "${zip}" .
    )
    rm -rf "${BUNDLE}"
    mkdir -p "${BUNDLE}"
    echo "${zip}"
}

if command -v flock > /dev/null; then
    HAVE_FLOCK=1
    NO_LOCK=
else
    HAVE_FLOCK=0
    NO_LOCK=1
fi

# Runs server-deploy as the server would, with the zip on stdin; sets STATUS
deploy() {
    STATUS=0
    HOME=${TEST_HOME} SERVER_DEPLOY_NO_LOCK=${NO_LOCK} "${SERVER_DEPLOY}" < "$1" \
        > "${WORK}/${CURRENT}/out" 2>&1 || STATUS=$?
}

expect_status() {
    if [ "${STATUS}" -ne "$1" ]; then
        fail "${CURRENT}: server-deploy exited ${STATUS}, expected $1"
        sed 's/^/    /' "${WORK}/${CURRENT}/out" >&2
    fi
}

restarts() { [ -f "${TEST_HOME}/restarts" ] && wc -l < "${TEST_HOME}/restarts" | tr -d ' ' || echo 0; }

# A first deploy, with no previous manifest, installs everything and deletes nothing
start first-run
mkdir -p "${TEST_HOME}/resources"
echo config > "${TEST_HOME}/resources/application.conf"
echo legacy > "${TEST_HOME}/legacy.txt"
add build/index.html assets/index-A.js app.jar
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/build/index.html"
expect_file "${TEST_HOME}/assets/index-A.js"
expect_file "${TEST_HOME}/app.jar"
expect_file "${TEST_HOME}/resources/application.conf"
expect_file "${TEST_HOME}/legacy.txt"
expect_file "${TEST_HOME}/.deploy/MANIFEST"
grep -qx 'assets/index-A.js' "${TEST_HOME}/.deploy/MANIFEST" || fail "${CURRENT}: manifest not kept"
grep -qx MANIFEST "${TEST_HOME}/.deploy/MANIFEST" && fail "${CURRENT}: manifest lists itself"
expect_no_path "${TEST_HOME}/MANIFEST"
expect_no_path "${TEST_HOME}/.deploy/staging"
[ "$(restarts)" = 1 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 1"

# The next deploy deletes what the previous one shipped and it doesn't, along with directories that
# leaves empty, and replaces what both ship
start cleanup
add build/index.html assets/index-A.js assets/ppu/old/game.js assets/keep/a.txt assets/keep/b.txt
add_restart
deploy "$(pack)"
expect_status 0
VERSION=2 add build/index.html assets/index-B.js assets/keep/a.txt
add_restart
deploy "$(pack)"
expect_status 0
grep -q ' 2$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: build/index.html not replaced"
expect_file "${TEST_HOME}/assets/index-B.js"
expect_file "${TEST_HOME}/assets/keep/a.txt"
expect_no_path "${TEST_HOME}/assets/index-A.js"
expect_no_path "${TEST_HOME}/assets/keep/b.txt"
expect_no_path "${TEST_HOME}/assets/ppu"
[ -d "${TEST_HOME}/assets" ] || fail "${CURRENT}: deleted a directory that isn't empty"
grep -qx 'assets/index-A.js' "${TEST_HOME}/.deploy/MANIFEST" && fail "${CURRENT}: manifest not updated"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"

# Deletion never touches what the server keeps for itself, or anything outside the home
# directory, even if the previous manifest lists it
start safety
mkdir -p "${TEST_HOME}/resources" "${TEST_HOME}/assets/seamcarver/output" "${WORK}/${CURRENT}/outside"
echo config > "${TEST_HOME}/resources/application.conf"
echo carved > "${TEST_HOME}/assets/seamcarver/output/x.png"
echo log > "${TEST_HOME}/server.log"
echo log > "${TEST_HOME}/assets/callTrace.log"
echo outside > "${WORK}/${CURRENT}/outside.txt"
echo outside > "${WORK}/${CURRENT}/outside/file.txt"
ln -s "${WORK}/${CURRENT}/outside" "${TEST_HOME}/link"
mkdir -p "${TEST_HOME}/.deploy"
echo state > "${TEST_HOME}/.deploy/other"
cat > "${TEST_HOME}/.deploy/MANIFEST" <<LIST
resources/application.conf
assets/seamcarver/output/x.png
server.log
assets/callTrace.log
../outside.txt
${WORK}/${CURRENT}/outside.txt
link/file.txt
.deploy/other
./assets/seamcarver/output/x.png
assets//seamcarver/output/x.png
assets/seamcarver/../seamcarver/output/x.png
LIST
add build/index.html
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/resources/application.conf"
expect_file "${TEST_HOME}/assets/seamcarver/output/x.png"
expect_file "${TEST_HOME}/server.log"
expect_file "${TEST_HOME}/assets/callTrace.log"
expect_file "${WORK}/${CURRENT}/outside.txt"
expect_file "${WORK}/${CURRENT}/outside/file.txt"
expect_file "${TEST_HOME}/.deploy/other"
expect_file "${TEST_HOME}/build/index.html"

# A bundle that ships what the server keeps for itself is refused before anything changes
for protected in resources/levels.txt assets/seamcarver/output/y.png callTrace.log .deploy/MANIFEST; do
    start "refuses-$(echo "${protected}" | tr '/.' '--')"
    add build/index.html
    add_restart
    deploy "$(pack)"
    expect_status 0
    VERSION=2 add build/index.html "${protected}"
    add_restart
    deploy "$(pack)"
    expect_status 1
    grep -q ' 1$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: installed a refused bundle"
    [ "${protected}" = .deploy/MANIFEST ] || expect_no_path "${TEST_HOME}/${protected}"
    [ "$(restarts)" = 1 ] || fail "${CURRENT}: restarted for a refused bundle"
done

# A manifest that doesn't match the bundle's files, or a bundle without one, is refused
start manifest-mismatch
add build/index.html extra.txt
echo build/index.html > "${BUNDLE}/MANIFEST"
add_restart
deploy "$(pack)"
expect_status 1
expect_no_path "${TEST_HOME}/build/index.html"
expect_no_path "${TEST_HOME}/.deploy/MANIFEST"
start no-manifest
add build/index.html
add_restart
zip=$(pack)
zip -qd "${zip}" MANIFEST
deploy "${zip}"
expect_status 1
expect_no_path "${TEST_HOME}/build/index.html"

# A failed unzip, of a truncated or empty upload, leaves the old deployment as it was
for upload in truncated empty; do
    start "failed-unzip-${upload}"
    add build/index.html assets/index-A.js
    add_restart
    deploy "$(pack)"
    expect_status 0
    cp "${TEST_HOME}/.deploy/MANIFEST" "${WORK}/${CURRENT}/manifest-before"
    VERSION=2 add build/index.html assets/index-B.js
    add_restart
    zip=$(pack)
    broken=${WORK}/${CURRENT}/broken.zip
    if [ "${upload}" = truncated ]; then
        head -c $(( $(wc -c < "${zip}") / 2 )) "${zip}" > "${broken}"
    else
        : > "${broken}"
    fi
    deploy "${broken}"
    expect_status 1
    grep -q ' 1$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: build/index.html changed"
    expect_file "${TEST_HOME}/assets/index-A.js"
    expect_no_path "${TEST_HOME}/assets/index-B.js"
    cmp -s "${TEST_HOME}/.deploy/MANIFEST" "${WORK}/${CURRENT}/manifest-before" ||
        fail "${CURRENT}: manifest changed"
    expect_no_path "${TEST_HOME}/.deploy/staging"
    expect_no_path "${TEST_HOME}/.deploy/upload.zip"
    [ "$(restarts)" = 1 ] || fail "${CURRENT}: restarted after a failed unzip"
done

# A failing server-restart fails the deploy, which is then installed and its manifest kept
start restart-fails
add build/index.html
add_restart
RESTART_STATUS=3 deploy "$(pack)"
expect_status 3
expect_file "${TEST_HOME}/build/index.html"
expect_file "${TEST_HOME}/.deploy/MANIFEST"

# A bundle without the scripts deploys need is refused, as deleting them would end deploys
for missing in server-deploy server-restart; do
    start "requires-${missing}"
    add build/index.html
    add_restart
    deploy "$(pack)"
    expect_status 0
    VERSION=2 add build/index.html
    add_restart
    rm "${BUNDLE}/${missing}"
    deploy "$(pack)"
    expect_status 1
    expect_file "${TEST_HOME}/${missing}"
    grep -q ' 1$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: installed a refused bundle"
done

# A bundle holding a symlink is refused
start bundle-symlink
add build/index.html
add_restart
ln -s /etc "${BUNDLE}/etc-link"
deploy "$(pack)"
expect_status 1
expect_no_path "${TEST_HOME}/build/index.html"
expect_no_path "${TEST_HOME}/etc-link"

# A bundle is refused before anything changes if a file would land on a directory, through a
# symlinked directory outside the home directory or into what the server keeps for itself, or on
# a symlink to a directory
for case in directory outside protected link-to-directory; do
    start "install-${case}"
    mkdir -p "${WORK}/${CURRENT}/outside" "${TEST_HOME}/assets/seamcarver/output"
    case "${case}" in
        directory) mkdir -p "${TEST_HOME}/target/file";;
        outside) ln -s "${WORK}/${CURRENT}/outside" "${TEST_HOME}/target";;
        protected) ln -s assets/seamcarver/output "${TEST_HOME}/target";;
        link-to-directory) mkdir -p "${TEST_HOME}/target"
            ln -s "${WORK}/${CURRENT}/outside" "${TEST_HOME}/target/file";;
    esac
    add build/index.html target/file
    add_restart
    deploy "$(pack)"
    expect_status 1
    expect_no_path "${TEST_HOME}/build/index.html"
    expect_no_path "${WORK}/${CURRENT}/outside/file"
    expect_no_path "${TEST_HOME}/assets/seamcarver/output/file"
    [ "$(restarts)" = 0 ] || fail "${CURRENT}: restarted for a refused bundle"
done

# Deletion through a symlink into what the server keeps for itself is refused
start delete-through-link
mkdir -p "${TEST_HOME}/assets/seamcarver/output" "${TEST_HOME}/.deploy"
echo carved > "${TEST_HOME}/assets/seamcarver/output/x.png"
ln -s assets/seamcarver/output "${TEST_HOME}/pics"
echo pics/x.png > "${TEST_HOME}/.deploy/MANIFEST"
add build/index.html
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/assets/seamcarver/output/x.png"

# A file that can't be deleted doesn't stop the deploy, which restarts the server, keeps the new
# manifest and then fails
start delete-fails
add build/index.html locked/old.txt
add_restart
deploy "$(pack)"
expect_status 0
chmod 555 "${TEST_HOME}/locked"
VERSION=2 add build/index.html
add_restart
deploy "$(pack)"
chmod 755 "${TEST_HOME}/locked"
expect_status 1
grep -q ' 2$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: build/index.html not replaced"
grep -qx locked/old.txt "${TEST_HOME}/.deploy/MANIFEST" && fail "${CURRENT}: manifest not updated"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"
grep -q "Couldn't delete locked/old.txt" "${TEST_HOME}/.deploy/log" || fail "${CURRENT}: not logged"

# An old deploy's file where the next one has a directory, or its directory where the next one
# has a file, is deleted first
start file-becomes-directory
add a.txt assets/foo
add_restart
deploy "$(pack)"
expect_status 0
add a2.txt assets/foo/bar zz.txt
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/assets/foo/bar"
expect_file "${TEST_HOME}/zz.txt"
expect_no_path "${TEST_HOME}/a.txt"
grep -qx assets/foo/bar "${TEST_HOME}/.deploy/MANIFEST" || fail "${CURRENT}: manifest not updated"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"

start directory-becomes-file
add x/y x/sub/z
add_restart
deploy "$(pack)"
expect_status 0
add x
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/x"
grep -qx x "${TEST_HOME}/.deploy/MANIFEST" || fail "${CURRENT}: manifest not updated"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"

# Something in the way that isn't an old deploy's is refused before anything changes: a
# directory holding another file, a file, an empty directory, a symlink to nothing or to a file
for case in directory-with-other-files file empty-directory dangling-link link-to-file; do
    start "blocked-${case}"
    add build/index.html x/y
    add_restart
    deploy "$(pack)"
    expect_status 0
    case "${case}" in
        directory-with-other-files) echo mine > "${TEST_HOME}/x/user.txt"; next=x;;
        file) echo mine > "${TEST_HOME}/other"; next=other/file;;
        empty-directory) mkdir "${TEST_HOME}/other"; next=other;;
        dangling-link) ln -s "${WORK}/${CURRENT}/nothing" "${TEST_HOME}/other"; next=other/file;;
        link-to-file) ln -s x/y "${TEST_HOME}/other"; next=other/file;;
    esac
    VERSION=2 add build/index.html "${next}"
    add_restart
    deploy "$(pack)"
    expect_status 1
    blocker=${next%%/*}
    grep -q "${blocker} on the server is in the way" "${WORK}/${CURRENT}/out" ||
        fail "${CURRENT}: the refusal doesn't name ${blocker}"
    grep -q ' 1$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: installed a refused bundle"
    expect_file "${TEST_HOME}/x/y"
    [ "$(restarts)" = 1 ] || fail "${CURRENT}: restarted for a refused bundle"
done

# A directory in the way is only deleted if everything in it is an old deploy's, with the server's
# symlinks resolved: not through a symlinked parent into what the server keeps for itself, not with
# a directory no old deploy file was in, and not with a file whose name has a line break
for case in symlinked-parent foreign-directory line-break; do
    start "blocked-directory-${case}"
    case "${case}" in
        symlinked-parent) add build/index.html p/seamcarver/output/r.png; next=p/seamcarver;;
        foreign-directory) add build/index.html x/y; next=x;;
        line-break) add build/index.html x/a x/b; next=x;;
    esac
    add_restart
    deploy "$(pack)"
    expect_status 0
    case "${case}" in
        symlinked-parent)
            rm -rf "${TEST_HOME}/p"
            mkdir -p "${TEST_HOME}/assets/seamcarver/output"
            echo result > "${TEST_HOME}/assets/seamcarver/output/r.png"
            ln -s assets "${TEST_HOME}/p"
            kept=${TEST_HOME}/assets/seamcarver/output/r.png;;
        foreign-directory)
            mkdir "${TEST_HOME}/x/empty"
            kept=${TEST_HOME}/x/y;;
        line-break)
            echo mine > "${TEST_HOME}/x/$(printf 'a\nb')"
            kept=${TEST_HOME}/x/$(printf 'a\nb');;
    esac
    VERSION=2 add build/index.html "${next}"
    add_restart
    deploy "$(pack)"
    expect_status 1
    expect_file "${kept}"
    grep -q ' 1$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: installed a refused bundle"
    [ "$(restarts)" = 1 ] || fail "${CURRENT}: restarted for a refused bundle"
done

# A directory that old deploy files were in counts as an old deploy's even once empty
start directory-emptied-by-hand
add x/y x/sub/z
add_restart
deploy "$(pack)"
expect_status 0
rm "${TEST_HOME}/x/sub/z"
add x
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/x"

# Deleting an old deploy's path that is now a symlink to a directory removes the link only
start delete-link-to-directory
mkdir -p "${WORK}/${CURRENT}/outside" "${TEST_HOME}/.deploy"
echo outside > "${WORK}/${CURRENT}/outside/file.txt"
ln -s "${WORK}/${CURRENT}/outside" "${TEST_HOME}/dlink"
echo dlink > "${TEST_HOME}/.deploy/MANIFEST"
add build/index.html
add_restart
deploy "$(pack)"
expect_status 0
expect_no_path "${TEST_HOME}/dlink"
expect_file "${WORK}/${CURRENT}/outside/file.txt"

# A path starting with a dash is an ordinary file
start leading-dash
add -- -dash
add_restart
deploy "$(pack)"
expect_status 0
expect_file "${TEST_HOME}/-dash"

# A log that can't be written doesn't stop the deploy
start unwritable-log
add build/index.html old.txt
add_restart
deploy "$(pack)"
expect_status 0
rm "${TEST_HOME}/.deploy/log"
mkdir "${TEST_HOME}/.deploy/log"
VERSION=2 add build/index.html
add_restart
deploy "$(pack)"
expect_status 0
expect_no_path "${TEST_HOME}/old.txt"
grep -q "Deleted old.txt" "${WORK}/${CURRENT}/out" || fail "${CURRENT}: message not printed"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"

# A dropped ssh session, whose output pipe closes after the upload, doesn't stop the deploy
start dropped-session
add build/index.html assets/index-A.js
add_restart
deploy "$(pack)"
expect_status 0
VERSION=2 add build/index.html assets/index-B.js
add_restart
zip=$(pack)
STATUS=0
HOME=${TEST_HOME} SERVER_DEPLOY_NO_LOCK=${NO_LOCK} "${SERVER_DEPLOY}" < "${zip}" 2>&1 | true ||
    STATUS=$?
: > "${WORK}/${CURRENT}/out"
expect_status 0
grep -q ' 2$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: build/index.html not replaced"
expect_no_path "${TEST_HOME}/assets/index-A.js"
[ "$(restarts)" = 2 ] || fail "${CURRENT}: server-restart ran $(restarts) times, expected 2"
grep -q "Deleted assets/index-A.js" "${TEST_HOME}/.deploy/log" || fail "${CURRENT}: not logged"

# Without flock, and without the tests' opt-out, a deploy refuses to run. PATH holds only the
# commands the script uses besides flock.
start no-flock
bin=${WORK}/${CURRENT}/bin
mkdir -p "${bin}"
for tool in bash cat mkdir rm unzip sort find sed cmp grep mv dirname basename rmdir comm; do
    ln -s "$(command -v "${tool}")" "${bin}/${tool}"
done
add build/index.html
add_restart
zip=$(pack)
STATUS=0
HOME=${TEST_HOME} PATH=${bin} /bin/bash "${SERVER_DEPLOY}" < "${zip}" \
    > "${WORK}/${CURRENT}/out" 2>&1 || STATUS=$?
expect_status 1
grep -q "flock isn't installed" "${WORK}/${CURRENT}/out" || fail "${CURRENT}: no flock message"
expect_no_path "${TEST_HOME}/build/index.html"

if [ "${HAVE_FLOCK}" = 1 ]; then
    # A deploy refuses to run while another holds the lock
    start lock-held
    mkdir -p "${TEST_HOME}/.deploy"
    flock "${TEST_HOME}/.deploy/lock" sleep 5 &
    holder=$!
    for _ in $(seq 50); do
        flock -n "${TEST_HOME}/.deploy/lock" true || break
        sleep 0.1
    done
    add build/index.html
    add_restart
    deploy "$(pack)"
    expect_status 1
    expect_no_path "${TEST_HOME}/build/index.html"
    kill "${holder}" 2> /dev/null || true
    wait "${holder}" 2> /dev/null || true

    # The server that server-restart starts in the background doesn't keep the lock
    start lock-released
    add build/index.html
    add_restart 'nohup sleep 5 > /dev/null 2>&1 < /dev/null &'
    deploy "$(pack)"
    expect_status 0
    VERSION=2 add build/index.html
    add_restart
    deploy "$(pack)"
    expect_status 0
    grep -q ' 2$' "${TEST_HOME}/build/index.html" || fail "${CURRENT}: second deploy not installed"
else
    echo "--- lock tests skipped: flock isn't installed"
fi

if [ "${FAILURES}" -ne 0 ]; then
    echo "${FAILURES} check(s) failed" >&2
    exit 1
fi
echo "All deploy tests passed"
