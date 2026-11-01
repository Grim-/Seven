# Network

## Goal

Nothing in Seven goes online without the user knowing. The same ethos as tool approvals, one level down: every outward request is to a site the user has allowed, and anything that can't be held to that says so up front.

## Rules

- **The site is the unit, not the request.** Approvals are per host (`en.wikipedia.org`). One page pulls in dozens of resources; asking for each would be unusable.
- **The same choices as tools:** allow once, allow for this chat, allow always for this site, deny. Deny always is the other side of allow always.
- **The user's own actions are their approval.** Clicking a link in the browser, importing a file from a URL, anything the user does by hand goes through without asking; it's still recorded.
- **Agents never decide.** An agent can ask to reach a site; only the user answers, and only the user changes a site's standing.
- **Honest where it can't be enforced.** Separate programs can't be held to this; they're labelled instead of pretended about.
- **Remote agents are outside it.** Setting one up is the approval for its host.

## What goes through it

Everything inside Seven's own processes:

- Web search, page fetch and every built-in tool that reaches out (web, browser, weather).
- Add-ons: the engine wraps `fetch`, `http` and `https` at start, so every request from an add-on passes the same check, including ones written later that never think about it.
- The in-app browser: Electron sees each request before it leaves. An allowed site covers what its page loads.

## What can't

Separate programs Seven starts: MCP servers, Python scripts, shell commands, the vision and voice tools. Seven can't see their traffic, and an OS firewall is out of scope. Turning one on shows that it **can reach the network without asking**, so the choice is made knowingly.

## Sites

A kind. Each entry is a host: allowed, denied or ask; when it was last reached and by whom (an agent, an add-on, the user). Linkable as `@site:en.wikipedia.org`, readable by agents, changeable only by the user. The existing web log becomes each site's history rather than a separate thing.

## Asking

A request to a site with no standing waits on an approval card in the chat that caused it: who wants it, which site, through which tool. Outside a chat (a routine, a widget, an add-on's view) it waits as a notification. A request that gets no answer fails like a denied one and says why.

## Phases

1. **The gate:** one choke point in the engine, the site store, the approval card, the Sites kind; built-in web tools and add-ons go through it.
2. **The browser:** the in-app browser's requests checked against the same sites.
3. **Labels:** MCP servers, Python and the other separate programs marked as able to go online unsupervised.
