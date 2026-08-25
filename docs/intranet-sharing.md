# Intranet sharing on the AVD

How the app is hosted: it runs on the host's AVD and teammates open it over the
corporate network, signed in silently with their Windows domain account and checked
against an allowlist. Set up with the `share-with-auth` skill
(`https://dacazscegit001.dymonasia.com/hk.msif.qs.intern.1/share-with-auth`).

Nothing here needs IT: no Azure app registration, no certificate, no admin rights.

## Shape

The Fastify process serves `dist/client` and `/api` on one port, so only one port has
to reach the network. It stays on `127.0.0.1:3001`; `sharing/auth_server.py` holds the
public port and forwards to it, so the network never reaches the app or the database
directly.

```text
teammate ──▶ http://<computer-name>:8000  (auth_server.py: NTLM + allowlist + log)
                        └──▶ 127.0.0.1:3001  (Fastify: client + /api)
                                    └──▶ Supabase transaction pooler
```

`HOST` selects the bind address (`server/config.ts`), defaulting to `0.0.0.0` so a
container or another host can bind every interface. The start script sets `HOST=127.0.0.1`
so only the proxy can reach the app.

## Running it

Double-click `sharing/start_sharing.bat`. Two windows open: the app, and the sharing
window that prints the link. Closing the sharing window stops sharing; closing the app
window stops the app. `.env.local` must hold `DATABASE_URL` — the app exits without it.

Share the link by **bare computer name** (`http://se-avd-445:8000`). The dotted FQDN
and the raw IP both reach the page but land in the browser's Internet zone, which
turns the silent sign-in into a username/password box.

## Database connection

The app reaches Supabase from the AVD over the transaction pooler, and the SSL
parameters in `DATABASE_URL` are load-bearing:

```text
...@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?uselibpqcompat=true&sslmode=require
```

`createPool` (`server/db/pool.ts`) passes no `ssl` option, so TLS has to be requested in
the URL. A bare `sslmode=require` fails: pg 8.22 still treats `require` as `verify-full`,
and the pooler's chain does not resolve to a public root, so the connection dies with
`SELF_SIGNED_CERT_IN_CHAIN`. `uselibpqcompat=true` restores libpq's meaning of `require`
— encrypt, do not verify the chain — and also silences pg's deprecation warning. To
verify as well, download the project CA from the Supabase dashboard and use
`sslmode=verify-full&sslrootcert=<path>`.

This is not corporate TLS interception: Node reaches `nodejs.org` and the npm registry
with verification intact, so it is the pooler's certificate specifically.

## Who can open it

`sharing/allowed_users.txt` — one domain account per line, real name as a comment:

```text
sg.bizdev.intern      # Efan Dang (host)
```

The file is re-read whenever it changes, so adding a line applies to the next request
with no restart. A lone `*` opens it to everyone on the domain. An account that is not
listed gets a 403 naming the account it saw and who to ask.

Accounts are not reliably `first.last` (intern accounts look like `hk.msif.qs.intern.1`,
and a mail local part can differ from the account). Resolve a name before adding it:

```powershell
([adsisearcher]"(&(objectCategory=person)(displayname=*Efan Dang*))").FindOne().Properties['samaccountname']
```

## Anonymity

`auth_server.py` logs every request to `sharing/access.log` as time, account, IP, path.
Left alone that would defeat the survey's anonymity: the log would show which account
posted a response, and the response row carries its own timestamp, so the two could be
joined. The copy in `sharing/` is therefore patched — successful requests to
`/api/survey*` are logged with `-` for both account and IP:

```text
2026-08-24 09:37:59  DYMONASIACOM\sg.bizdev.intern  172.16.2.67  /                      OK
2026-08-24 09:37:59  -                              -            /api/survey            OK
2026-08-24 09:37:59  DYMONASIACOM\sg.bizdev.intern  172.16.2.67  /api/admin/meetings    OK
```

Denials keep the account and IP: a denied visitor never answered, and the point of that
entry is knowing who to add. Page loads are logged as `/` because the app uses hash
routes, so the log cannot tell a survey visit from a report visit. The app itself
ignores the proxy's `X-Authenticated-User` header, so no identity reaches the database.

## Cautions

- Hash routes never reach the server, so one port cannot gate `/#/admin` differently
  from `/#/survey/<secret>`. Everyone on the allowlist can reach the admin screen,
  which still has no login of its own, and read every meeting's access links. Run a
  second `auth_server.py` on another port with a narrower allowlist if that matters.
- Everything runs on the host's machine with the host's access.
- Inbound port 8000 has only been proven from the AVD itself. Confirm from another
  machine before sending the link out.
- The `sharing/` folder is untracked (`.gitignore`): it holds the allowlist, the access
  log and machine-specific paths, none of which belong in the repository.
