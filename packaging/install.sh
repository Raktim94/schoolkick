#!/usr/bin/env bash
# Install the current SchoolKick source with Docker Compose. Existing installs are never overwritten.
set -euo pipefail
umask 077
fail() { printf 'SchoolKick: %s\n' "$*" >&2; exit 1; }
for dependency in git docker openssl curl; do
  command -v "$dependency" >/dev/null 2>&1 || fail "Install $dependency first, then run this command again."
done
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.'
docker info >/dev/null 2>&1 || fail 'Start Docker and ensure your user can access it.'
[[ -z "$(docker ps -aq --filter label=com.docker.compose.project=schoolkick)" ]] || fail 'A SchoolKick Docker installation already exists. Manage it from its original directory.'
[[ -z "$(docker volume ls -q --filter label=com.docker.compose.project=schoolkick)" ]] || fail 'SchoolKick data volumes already exist. Use the original installation and password; existing data has not been changed.'
install_dir="${SCHOOLKICK_DIR:-$PWD/schoolkick}"
install_port="${SCHOOLKICK_PORT:-3847}"
[[ "$install_port" =~ ^[0-9]{1,5}$ ]] || fail 'SCHOOLKICK_PORT must be a number from 1 to 65535.'
install_port=$((10#$install_port))
(( install_port >= 1 && install_port <= 65535 )) || fail 'SCHOOLKICK_PORT must be from 1 to 65535.'
[[ ! -e "$install_dir" && ! -L "$install_dir" ]] || fail "Directory already exists: $install_dir. Choose a new SCHOOLKICK_DIR; your files have not been changed."
git clone --depth 1 --branch main https://github.com/Raktim94/schoolkick.git "$install_dir"
cd "$install_dir"
database_password="$(openssl rand -hex 32)"
cat > deploy/.env <<ENV
POSTGRES_PASSWORD=$database_password
SITE_URL=http://localhost:$install_port
HTTP_PORT=$install_port
BIND_ADDRESS=127.0.0.1
ALLOW_SIGNUP=1
ENV
unset database_password
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build --wait --wait-timeout 180
curl -fsS "http://127.0.0.1:$install_port/readyz" >/dev/null || fail 'The app did not pass its readiness check. Inspect docker compose logs.'
printf '\nSchoolKick is ready: http://localhost:%s/app/\nSettings: %s/deploy/.env\nCreate your school owner, then set ALLOW_SIGNUP=0 and run Compose again.\nFor remote access, configure HTTPS and SITE_URL before inviting users.\n' "$install_port" "$install_dir"
