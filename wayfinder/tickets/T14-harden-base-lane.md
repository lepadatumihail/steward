---
id: T14
title: Harden the Base data lane
type: task
status: open
assignee:
blocked-by: []
---

## Question

Per [Approvals and token-risk data sources](T03-approvals-data-sources.md): mainnet approvals are solid keyless, but Blockscout **Base** 500s/429s (sticky ~5–15min IP throttle) on event-spammed wallets, and Base logs are paid-tier-only on Etherscan v2. Pick and execute one hardening step — the account-creation options are the human's to perform (assistants must not create accounts or enter credentials):

- (a) Free Blockscout API key (human creates the account, key goes in `.env`).
- (b) Free Envio HyperSync token (same).
- (c) Settle the Moralis unpaid invoices — its `/wallets/{addr}/approvals` endpoint would collapse the whole pipeline to one call (also un-breaks Moralis for other projects).
- (d) Accept degraded Base coverage for pathological wallets — normal wallets work keyless today; demo addresses can be chosen to avoid the throttle (coordinate with [Demo arc and burner wallet plan](T08-demo-arc.md)).

Resolution records the chosen option, where the credential lives (`.env`, never committed), and a verified working probe against the previously-failing wallet (jesse.base.eth).
