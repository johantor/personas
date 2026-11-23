# Security

personas drives a real browser against sites you name, as a Claude Code agent that reads what the
pages show. Its boundary: a run reaches only the hosts on the brief's allowlist, submits no form
and sends no non-GET page request unless the persona sets `allowWrites`, and treats page text as
data, never as instructions. Login state for test accounts stays in `.personas/auth/`.

Report a way around that boundary (navigation off the allowlist, a write without `allowWrites`, a
page that makes a visitor act on its text, one session reading another's cookies or login)
privately through
[a security advisory](https://github.com/johantor/personas/security/advisories/new), not in a
public issue.
