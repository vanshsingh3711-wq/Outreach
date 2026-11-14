# Configuration and commands

## Configuration

Two files, both plain text.

**`.env`** — credentials. Every variable documented inline with where to get it. The only required one is a mail provider; everything else is optional.

**`outreach.yaml`** — who Outreach is and who it sells to:

```yaml
persona:      { name, company, role, email, tone }
product:      { name, description, pricing, key_benefits, objection_responses, offer }
icp:          { industries, titles, company_size, geography, hiring_signals, geo_coordinates }
channels:
  email:      { provider: gmail | microsoft | smtp | instantly, max_daily_sends, per_inbox_daily_cap,
                require_approval, send_to_risky, min_write_score, max_bounce_rate, follow_ups, warmup, send_window, signature }
usage:        { max_daily_claude_percent, heartbeat_interval_minutes, quiet_hours }
brain:        { provider: claude | codex, model, reasoning_effort }   # optional; claude by default
writer:       { humanizer, site_facts, require_tip }   # optional; humanizer true adds one editing pass per batch using ~/.claude/skills/humanizer/SKILL.md
              # site_facts (default true): the Writer sees what the free homepage signals found (no structured data,
              # a stale or very small site, AI crawlers blocked) so an email can name one concrete thing to change.
              # They come from an automated read of one page and can be wrong, so check a draft's claim
              # against the site before approving it. false keeps them away from the Writer.
              # require_tip (default false): true writes a first email only for a prospect with something concrete to
              # build its one tip on (a site finding, a startup fact, a signal or the Scout's notes). The others are
              # marked "no_tip" and skipped, instead of getting a draft that says it has no advice. The dashboard shows
              # them as "Nothing to write about yet"; `outreach retry-writes --no-tip` puts them back in line.
              # email_rules: your own markdown rules for the emails' shape (see The skills library)
```

`min_write_score` (0-100, default 0) is the lowest Scout fit score the writer
drafts for: a prospect below it keeps its deliverable address but gets no
sequence, so Claude calls and sends go to the best matches first.

`follow_ups` (default true) set to `false` makes a campaign stage only its first email on Gmail, Microsoft and SMTP. Steps 2 and 3 are never prepared, so none can go out to someone who has not answered. A reply is still read, and the answer waits in the Outbox for you as usual. The Writer still drafts the whole sequence; the Sender just doesn't stage the later steps.

`max_daily_claude_percent` caps whichever subscription `brain.provider` uses (the name predates Codex support).

If `outreach.local.yaml` exists it wins. It's gitignored, so a fork can carry real product configuration while the tracked `outreach.yaml` stays a template — nobody publishes their positioning and pricing by accident.

### Commands

```bash
outreach run                   # the heartbeat loop
outreach dashboard             # web UI at 127.0.0.1:5555 (--url: print the unlock link)
outreach signals               # review/confirm what to prospect against
outreach discover              # find businesses; --providers / --estimate
outreach profile               # read discovered companies' sites (free)
outreach train <url>           # learn a product from its website (--provider codex --model gpt-5.5)
outreach status                # pipeline summary
outreach usage                 # active provider's quota + per-agent tokens
outreach outbox                # review queued email
outreach export                # deliverable prospects → CSV
outreach precleared-key        # free key for the cold-email check, saved to .env
outreach companies             # company register → CSV: every company, fit, and why it wasn't contacted
outreach sending pause|resume  # kill switch
outreach suppressions [add|remove <value>]  # addresses and domains never emailed
outreach inboxes list|connect|test|pause|resume|cap|name|remove|use  # several sending inboxes
outreach tray                  # menu-bar (macOS) / tray (Windows) icon; --status prints the state
outreach autostart install|uninstall|status  # start the tray at login
outreach mcp install [claude|codex]  # let your coding agent read Outreach and pause sending
outreach warmup [domain]       # is the sending domain ready? (SPF/DKIM/DMARC, age, blocklists, warmup)
outreach trulyinbox connect    # connect TrulyInbox so Outreach reads the mailbox's warmup
outreach retry-writes          # retry prospects the Writer gave up on
outreach gmail auth            # one-time Gmail OAuth
outreach microsoft auth|test  # one-time Microsoft 365 sign-in (docs/microsoft365.md)
```

Prospect CSV exports exclude opted-out contacts, including when using
`--status` or `--email-status` filters. `outreach export --all` is an unfiltered
raw-data export for inspection: it includes opted-out and unverified contacts
and should not be imported as an outreach list. The dashboard's prospect CSV
download follows the same policy; `?all=true` selects its raw export.

## Several sending inboxes

The main mailbox is the one `channels.email.provider` sets up. You can send
from more inboxes you already own, besides it:

```bash
outreach inboxes connect gmail --address two@yourdomain.co      # browser sign-in
outreach inboxes connect microsoft --address three@yourdomain.co
outreach inboxes connect smtp --address four@yourdomain.co --smtp-host smtp.example.com
outreach inboxes list                                           # each inbox and today's cold sends
```

- **Where sign-ins live.** In your system keychain (service `outreach`), never
  in the database or a file. A Gmail or Microsoft inbox keeps only its refresh
  token; an SMTP inbox's password is asked for at the prompt, never on the
  command line. Signing in as a different account than `--address` connects
  nothing. Docker and other headless machines have no keychain, so extra
  inboxes can't be connected there yet.
- **Which inbox sends what.** A prospect's first email goes from the inbox
  with the most room left today. Once anything in a thread has gone out, its
  follow-ups and Outreach's replies leave from that same inbox. A reply is
  answered from the inbox it arrived in.
- **Caps.** Each inbox, the main one included, sends up to
  `per_inbox_daily_cap` cold emails a day (default 30), or the number you set
  with `outreach inboxes cap <address> <n>`. An inbox connected with
  `--warmup-started YYYY-MM-DD` ramps up from that day like
  `channels.email.warmup` describes; the main mailbox ramps from
  `warmup.start_date`. `max_daily_sends` stays the ceiling on everything sent
  in a day, so raise it when you add inboxes.
- **Pausing and removing.** `outreach inboxes pause <address>` stops one inbox.
  Its unsent first emails move to the others, and threads it started wait for
  it. `remove` stops using it for good: threads it started end. Its sign-in
  stays in your keychain until you delete it there.
- **Choosing inboxes per campaign.** `outreach inboxes use <campaign>
  <address>...` limits a campaign's new threads to those inboxes (`main` is
  the main mailbox); with no addresses it uses every inbox again.
- Replies are read from every inbox each cycle. If one can't be read,
  nothing is sent that cycle, as with one inbox, and the Today page says
  which inbox.
- The dashboard's **Inboxes** tab shows every inbox with today's cold sends
  against its cap. Click one to pause, resume, cap, rename, check or remove
  it. **Add inbox** connects one: Gmail and Microsoft 365 open their sign-in
  in the browser on the computer running Outreach (it needs the same
  `GMAIL_CLIENT_ID`/`M365_CLIENT_ID` setup as the main mailbox), and an SMTP
  password goes straight to your system keychain and is never shown again.
  On a server with no browser, use `outreach inboxes connect` instead.
- Your coding agent can list inboxes and pause one (`inboxes_list`,
  `inbox_pause`); only you resume one or change its cap.
- An extension can add another way to connect an inbox with
  `registry.add_mailbox_connection` ([docs/extensions.md](extensions.md)).

## The menu-bar app

`outreach tray` puts Outreach in the macOS menu bar (the Windows tray). It
starts the dashboard if it isn't running, then lets you start and stop
Outreach, pause and resume sending, and open the dashboard, already unlocked.
Quitting the icon leaves Outreach running. `outreach autostart install` starts
the icon when you log in: a LaunchAgent on macOS, a Startup-folder shortcut on
Windows. It only ever touches its own entry, and refuses if something else is
at that path. Linux has no tray: run `outreach dashboard` and `outreach run`
as services instead.

## Your coding agent (MCP)

`outreach mcp install` adds Outreach to Claude Code (`outreach mcp install codex`
for Codex). It shows the exact change to your agent's config first and applies it
only on a yes, touches only its own entry, and refuses if a Outreach entry it
didn't write is already there. `--print` shows the entry to add by hand to any
other MCP client; `outreach mcp uninstall` takes it out again.

Your agent then talks to the running dashboard (`outreach dashboard`) with its
own token, `data/agent-token`, never yours. With it the agent can read
everything Outreach knows (Today, campaigns, prospects, companies,
conversations, the Outbox, signals, usage, setup), estimate what a discovery
run would cost, and pause sending. It can't approve or send email, resume
sending, confirm signals, start discovery, change settings or keys, or delete
anything: the dashboard answers 403 to the agent's token for every route that
isn't on its short allowlist (`outreach/agent_policy.py`).

