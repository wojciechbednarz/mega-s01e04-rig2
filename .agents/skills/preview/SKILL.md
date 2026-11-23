---
name: preview
description: Put a page up as a public preview for a reviewer, check it from outside before the link is sent, and later upload it again without the lane marker. Use for a plan's "Preview for review" and "Clean up" sections (ADR 0003).
---

# preview

A reviewer has no lane access. They open the preview from their own machine, on a network
that is not ours. So the link is checked the way they will open it, not only from this shell.

## Who opens the link

- The reviewer, from any network, with a browser. No login, no VPN, no lane.
- Anyone else who gets the link: it is public. So the page holds only the template's sample
  data and the lane marker, nothing else (ADR 0003, brief).
- Nobody else gets the link. The reviewer is the first to open it: it goes only into the send
  to the reviewer, never into an issue, comment, PR, commit or chat. A link that was posted
  anywhere is burnt: put the page under a new key, don't reuse it.

## Steps

1. Run rig and save the page as one file, **outside the repo** (no previews in git, ADR 0003):

   ```sh
   curl -fsS http://localhost:${PORT:-8787}/digest/<night> -o <outside-dir>/digest.html
   ```

2. Ask the human before it goes up: what, why, where, who can see it, how to undo it.
3. Put it on the public host and keep the URL: clean-up uploads over the same link. The host
   is GitHub Pages in a **separate** public repo that holds only the preview (never this repo,
   ADR 0003). The routine has two commands, one up and one down (read `gh help` for the flags,
   don't guess them):

   ```sh
   # put: one commit holding only the page, pushed over the preview repo's history
   #      the link is https://<owner>.github.io/<preview-repo>/digest.html
   .agents/skills/preview/pages.sh put <owner>/<preview-repo> <outside-dir>/digest.html
   # take down: Pages off, the link answers 404 afterwards
   .agents/skills/preview/pages.sh down <owner>/<preview-repo>
   ```

   `put` force-pushes a single commit, so a clean upload leaves no marked page in the preview
   repo's history. Pages builds in about a minute and caches for up to 10 minutes: run the check
   only once the link serves the saved file. A link you can't take down is not a preview host.
4. **Check before sending**, with the saved file and the marker in the environment:

   ```sh
   LANE_MARKER=<marker> .agents/skills/preview/check.sh <url> <outside-dir>/digest.html marker
   ```

   It checks: a real HTTPS host (not an IP, not localhost) · 200 `text/html` · the bytes on the
   link are the saved file · self-contained (no script, no outside resources) · the marker is
   there · the link is not published (repo, history, issues, PRs, comments) · **the link opens from outside**: several public check nodes in other countries
   fetch it and must all get 200. It prints an evidence block; nothing is sent if it fails.

   **The harness runs it, not only the agent:** `gate.sh` takes the send on stdin, renders the
   page fresh (`render.ts`, no server), runs `check.sh` and blocks the send (exit 2) on FAIL; on
   PASS it shows the human the evidence and asks before the send. Claude Code wires it in
   `.claude/settings.json` (PreToolUse on the claim). Another harness: call `gate.sh` the same way
   from its own hook or extension. Don't copy the check.
5. Send the reviewer the link and the plan's issues. Post the evidence block on the preview
   issue: it names the host, never the link (`check.sh` prints `<preview link>`). Close it (AGENTS.md closing comment, `commit: none`) only once its "Done when" holds.

## Clean up (once the review is in)

1. Save the same page with `LANE_MARKER` unset (banner shows `no marker set`).
2. Ask the human, then upload over the **same** link.
3. `LANE_MARKER=<marker> .agents/skills/preview/check.sh <url> <file> clean` — the marker
   must be gone from the link, seen from outside too.

## Don'ts

- Don't send a link this check did not pass.
- Don't commit the saved page, and don't attach it to an issue or chat.
- Don't print the marker in logs or comments.
- Don't post the link anywhere but the send: `check.sh` fails a link found in the repo, its
  history, its issues, PRs or comments.
