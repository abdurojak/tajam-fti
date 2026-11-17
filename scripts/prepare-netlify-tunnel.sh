#!/bin/bash
set -euo pipefail
test -f /srv/tajam/shared/postgres.env
getent passwd tajam-netlify >/dev/null || useradd -m -s /bin/bash tajam-netlify
if passwd -S tajam-netlify | grep -q ' LK '; then
  usermod -p "$(openssl rand -hex 48 | openssl passwd -6 -stdin)" tajam-netlify
fi
install -d -m 700 -o tajam-netlify -g tajam-netlify /home/tajam-netlify/.ssh
target=$(docker inspect tajam-db --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
test -n "$target"
printf 'restrict,port-forwarding,permitopen="%s:5432",command="/bin/false" %s\n' "$target" "$(cat /root/tajam-netlify.pub)" > /home/tajam-netlify/.ssh/authorized_keys
chown tajam-netlify:tajam-netlify /home/tajam-netlify/.ssh/authorized_keys
chmod 600 /home/tajam-netlify/.ssh/authorized_keys
restorecon -R /home/tajam-netlify/.ssh
if ! test -f /srv/tajam/shared/netlify-database.env; then
  set -a
  source /srv/tajam/shared/postgres.env
  set +a
  password=$(openssl rand -hex 32)
  docker exec -i tajam-db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE tajam_netlify LOGIN PASSWORD '$password';
GRANT CONNECT ON DATABASE tajam TO tajam_netlify;
GRANT USAGE ON SCHEMA public TO tajam_netlify;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tajam_netlify;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tajam_netlify;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tajam_netlify;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tajam_netlify;
SQL
  umask 077
  printf 'DATABASE_URL=postgresql://tajam_netlify:%s@127.0.0.1:5432/tajam\nDB_SSH_TARGET=%s\n' "$password" "$target" > /srv/tajam/shared/netlify-database.env
fi
echo 'Restricted SSH account and database role prepared.'
