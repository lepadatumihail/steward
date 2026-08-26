# T03 — Approvals & token-risk data sources (findings)

Probed live 2026-08-26 with curl from a residential IP. Chain heads at probe time: Ethereum mainnet 25,839,460; Base 50,479,421. Every claim below is live-probed unless explicitly marked "docs, not probed". Vendor docs lag reality in both directions (project rule) — all verdicts here are from real requests.

Probe addresses (documented as required):
- `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (vitalik.eth) — mainnet stress case: 4,608 unique Approval logs as owner (incl. an Apr-2026 spam wave), plus modest Base activity (41 approvals).
- `0x020cA66C30beC2c4Fe3861a94E4DB4A498A35872` (machibigbrother.eth) — second busy mainnet wallet.
- `0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1` (commonly labeled jesse.base.eth; EOA per Blockscout) — hyperactive/event-spammed Base wallet; the Base worst case.
- Tokens: PEPE `0x6982…1933` (eth), BRETT `0x532f…42e4` (base), USDT/USDC/WETH for allowance calls, and two real spam tokens harvested from vitalik's approval-spam wave (`0x13a5bc10…`, `0x13ca9c89…`).

---

## Recommended stack

### `list_token_approvals(address)` — architecture: log scan → dedupe → live-verify
The correct shape on free infra is a three-stage pipeline, because Approval *events* are attacker-forgeable (any contract can emit `Approval(owner, spender, value)` naming anyone — vitalik's wallet shows ~4 pages of fake approvals from one Apr-2026 spam wave):
1. **Candidate scan**: fetch all `Approval(address,address,uint256)` logs with `topic1 = owner` (full history once, then incremental from a stored cursor).
2. **Dedupe** to latest event per `(token, spender)`; keep block timestamp = approval age. Drop 4-topic logs (ERC-721 `Approval` shares the same topic0; ERC-20 is 3 topics + value in `data`).
3. **Ground truth**: batch `allowance(owner, spender)` through Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, both chains) — this kills revoked/expired entries and is the only trustworthy allowance value.

| Stage | Ethereum mainnet | Base |
|---|---|---|
| Primary log source | **Blockscout** `eth.blockscout.com/api?module=logs&action=getLogs` — keyless, full history in one query, 1000 rows/page, `timeStamp` included. Probed: worst-case wallet = 5 pages / 6.7 s total. | **Blockscout** `base.blockscout.com` same API — keyless, works for normal wallets (vitalik full history 7.5–9.9 s), but see Base risk below. |
| Fallback log source | **Routescan** keyless (`api.routescan.io/...evm/1/etherscan/api`, 500 rows/page @ ~4 s) or **Etherscan v2 with free key** (mainnet is on the free tier; 3 calls/s, 100k/day). | **Envio HyperSync** with free token (user must create at app.envio.dev — purpose-built full-history log scans), else **paid Etherscan** (Base is NOT on Etherscan's free tier — verified today) or free Blockscout API key (dev.blockscout.com). |
| Live allowance verify | Multicall3 `eth_call` via `eth.drpc.org` — probed 50 allowances in one call, 0.27 s. | Multicall3 via `mainnet.base.org` — probed 0.22–0.35 s. |
| Incremental updates | RPC `eth_getLogs` windows: dRPC free allows 10k-block ranges w/ archive (mainnet ~7.2k blocks/day → 1 call/day/wallet). | dRPC Base free handles 1k-block ranges (~43k blocks/day → ~44 calls/day, or Blockscout incremental `fromBlock=cursor`). |

Fan-out reality check (measured): vitalik's 4,608 logs reduce to 2,291 distinct ERC-20 `(token,spender)` pairs → 46 Multicall3 batches of 50 ≈ 12 s sequential / ~4 s at 4-way parallel. Normal wallets are 10–100× smaller. Sampled 50 pairs live: 50/50 calls succeeded, 27 nonzero allowances (many of those are spam tokens — risk-weight by token value from the assess stack, don't alarm on worthless allowances).

### `assess_token(address)` — keyless, all probed working on BOTH chains
- **Primary: GoPlus** `api.gopluslabs.io/api/v1/token_security/{1|8453}?contract_addresses=…` — keyless, ~0.3 s, burst of 6 rapid calls all 200. Richest single source: honeypot/buy-sell-transfer tax, mintable, owner powers (`can_take_back_ownership`, `owner_change_balance`, `hidden_owner`, `selfdestruct`), `is_open_source`/`is_proxy`, `holder_count` + top-holder list w/ percents, LP holders/liquidity, per-DEX pools, `is_in_cex/dex`.
- **Liquidity/age cross-check: DexScreener** `api.dexscreener.com/token-pairs/v1/{ethereum|base}/{addr}` — keyless, CDN-cached (~0.1–0.25 s): liquidity USD, 24h volume/txns, price, `pairCreatedAt` (token age). Empty array `[]` = strong junk/unlisted signal (verified on a real spam token GoPlus under-flags). Docs: 300 req/min.
- **Honeypot verdict cross-check: Honeypot.is** `api.honeypot.is/v2/IsHoneypot?address=…&chainID={1|8453}` — keyless, ~0.2–0.3 s, simulation-backed buy/sell tax, holder success stats, `summary.risk`. Covers exactly our two chains.
- **Spender risk (feeds the approvals tool)**: GoPlus `approval_security/{chain}?contract_addresses={spender}` (probed: Permit2 → `trust_list/doubt_list/malicious_behavior`) + Blockscout `api/v2/smart-contracts/{addr}` `is_verified` (0.23 s) — Etherscan-quality verification status without a key. Note: Etherscan free key DOES cover source/ABI endpoints on all chains incl. Base (docs state explicitly), so `getsourcecode` on Base is free-key-viable too.
- Verdict rule: **never single-source**. GoPlus returned no scary flags on two live spam tokens (open-source, not honeypot) — the catch came from $2k liquidity (GoPlus dex field) + DexScreener absence.

### `simulate_transaction` — FEASIBLE on free infra (surprise finding)
`eth_simulateV1` works keyless on all four probed endpoints: `ethereum-rpc.publicnode.com`, `eth.drpc.org`, `mainnet.base.org`, `base-rpc.publicnode.com` — 0.16–0.35 s, returns per-call `status`, `gasUsed`, and full logs; `traceTransfers: true` (adds synthetic native-ETH transfer logs) and `validation: false` both accepted on publicnode. Decoding emitted Transfer/Approval logs + traceTransfers gives Alchemy-style "asset changes" without Alchemy. Alchemy `alchemy_simulateAssetChanges` needs a real (free-tier) key — the public `demo` key 429s. Tenderly API requires an account (unauth probe → 401); free tier exists — treat as optional premium upgrade, not a dependency.

---

## Per-candidate probe logs

### 1. Moralis — BLOCKED (account-level), endpoint exists
- Key found in ai-frontend `.env` (used in headers only; never logged).
- `GET deep-index.moralis.io/api/v2.2/wallets/{addr}/approvals?chain=eth&limit=3` → **HTTP 401** in 0.16–0.29 s:
  `{"message":"Validation service blocked: You have unpaid invoices … admin.moralis.io/account/billing"}`
- Same 401 on `/info/endpointWeights` (normally 0 CU) and `/erc20/metadata` → block is account-wide, not endpoint-specific. **The key is dead until the invoice is paid.**
- Public swagger (`deep-index.moralis.io/api-docs-2.2/v2.2/swagger.json`, fetched keyless) confirms `GET /wallets/{address}/approvals` exists (operationId `getWalletApprovals`, params chain/limit/cursor). Documented response: `{page, page_size, cursor, result: tokenApproval[]}` where each item has `block_number`, `block_timestamp`, `transaction_hash`, `value`, `value_formatted`, `token{}`, `spender{}` — i.e. the entire tool in one endpoint, **but unverifiable live** (and per project history, Moralis docs cannot be trusted without a probe). CU cost unknown (weights endpoint also 401).
- Verdict: would collapse the whole approvals pipeline to one call IF billing is fixed — re-probe before relying on it.

### 2. Etherscan v2 — key required for everything; Base logs are PAID-tier
- Keyless `module=logs&action=getLogs` (chainid=1) → 200 `{"status":"0","message":"NOTOK","result":"Missing/Invalid API Key"}` (0.36 s). Keyless `getsourcecode` → same. **Nothing works keyless.**
- Live docs (fetched today): Free = **3 calls/s, 100k/day, "selected chains only"**; Lite $ = 5/s; Standard = 10/s 200k/day.
- Live docs supported-chains table: `["Ethereum Mainnet", 1, …, true]` but **`["Base Mainnet", 8453, …, false]` — Base is paid-tier-only** (as are BNB, OP, Avalanche). Exception in docs: "Source code and ABI endpoints are available on all chains for every API plan, including the Free Tier."
- Also noted in docs: Gnosis moves to paid Sep 1 2026 → the free-chain table is actively shrinking; re-check at build time.
- Verdict: free key = good mainnet log fallback + free `getsourcecode` on both chains; NOT a Base approvals source without paying. (Unprobed with a key — no Etherscan key exists in the env; verify once one is issued.)

### 3. Public RPC + getLogs scan — dead for full history, alive for verify/incremental
Approval topic0 `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`, topic1 = padded owner.

| Endpoint | getLogs limit (probed) | Notes |
|---|---|---|
| eth.llamarpc.com | DOWN — HTTP 521 | public-RPC churn is real |
| ethereum-rpc.publicnode.com | historical ranges → 403 "Archive requests require a personal token" | recent-state fine; eth_call/simulate fine |
| eth.drpc.org | "ranges over 10000 blocks are not supported on free plan"; 10k-block archive range OK, 0.25 s | best free mainnet RPC scanner |
| eth-mainnet.public.blastapi.io | 10-block range max | unusable for scans |
| 1rpc.io/eth | 50-block range max | — |
| cloudflare-eth.com | 800-block range max | — |
| eth.meowrpc.com | eth_getLogs not supported | — |
| rpc.ankr.com/eth | key required (-32000 Unauthorized) | — |
| eth-mainnet.g.alchemy.com/v2/demo | HTTP 429 (demo key exhausted) | real free key needed |
| mainnet.base.org | **range must be ≤ 100 blocks** (101 → "Invalid params"; 100 → OK, ~0.16 s). Bonus: logs include `blockTimestamp` | fine for eth_call/simulate; useless for scans |
| base-rpc.publicnode.com | archive gated (same 403 as eth) | — |
| base.drpc.org | 1k-block range OK (0.5 s); 10k → "Request timeout on the free plan" | incremental only |

Full-history wall-clock estimates (sequential, measured per-call latencies, ignoring free-tier CU throttles which would make it worse):
- Mainnet via dRPC 10k chunks: ~2,590 calls × ~0.25 s ≈ **11 min** per wallet. Not interactive.
- Base via base.org 100-block cap: ~505,000 calls — **non-starter**. Via dRPC 1k chunks: ~50,500 calls ≈ hours.
- Verdict: raw RPC is NOT the scan layer. It is the **live-allowance layer** (Multicall3: 50 allowances in 0.27 s on dRPC, 3 in 0.35 s on base.org — probed with real pairs) and the **incremental-delta layer** after a first sync (mainnet 1 call/day/wallet, Base ~44).

### 4. Blockscout (not in the original candidate list — decisive find)
Etherscan-compatible, keyless: `{eth|base}.blockscout.com/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=…&topic1=…&topic0_1_opr=and`.
- Mainnet: vitalik full history = 1000 rows/page, page 1 3.4–4.5 s, subsequent pages ~0.8 s; **4,608 unique logs in 5 pages / 6.7 s**. Pagination = advance `fromBlock` to last returned block (1-row overlap; dedupe on `(txHash, logIndex)`). Rows carry `timeStamp` (hex) → approval age with zero extra calls. Sample row: `{"address":"0xd654…9179","topics":["0x8c5b…","0x…d8da…96045","0x…f51b…e82f",null],"data":"0x…","blockNumber":"0x179531","timeStamp":"0x573d9db0"}`. Second busy wallet (machibigbrother) page 1 OK in 8.5 s. ~15 rapid mainnet calls → zero 429s.
- Base: vitalik full history OK (41 logs, 7.5–9.9 s). **Hyperactive wallet (jesse) breaks it**: fast HTTP 500 "Something went wrong", then 40–90 s timeouts even on 100k–5M-block chunks, then hard **429 "Too many requests. Increase limits now at https://dev.blockscout.com"** for my whole IP. Throttle was sticky ~5–15 min, then recovered (probed: 200 again, though 6.2 s for a 1k-block window — the Base instance is slow generally).
- Contract verification keyless: `module=contract&action=getsourcecode` works; REST `GET /api/v2/smart-contracts/{addr}` → `{"name":"Permit2","is_verified":true,…}` in 0.23 s.
- Verdict: mainnet primary, comfortably. Base primary-with-caveats: cache aggressively, back off on 429, get the free API key (dev.blockscout.com — requires creating an account; user action), and expect the worst 1% of wallets (event-spammed) to need HyperSync/paid Etherscan instead.

### 5. Routescan (bonus candidate) — mainnet-only keyless fallback
`api.routescan.io/v2/network/mainnet/evm/{chainId}/etherscan/api`, keyless:
- chainId 1: full-history query returns 100 rows default (0.1 s, has `timeStamp`); `&page=N&offset=500` works (500 rows, 4.3 s/page); `offset=1000` → `{"status":"0","message":"Timeout reached, please use a narrower block range"}` after 13–21 s.
- chainId 8453: `{"status":"0","message":"chain not supported"}` — **no Base**.

### 6. Token safety APIs
- **GoPlus** (keyless): `token_security/1` PEPE → full risk object in 0.3 s (fields incl. `buy_tax`, `sell_tax`, `is_honeypot`, `is_mintable`, `can_take_back_ownership`, `hidden_owner`, `holder_count`, `holders[]` w/ percents, `lp_holders`, per-DEX `dex[]` liquidity, `is_open_source`, `is_proxy`, `is_in_cex/dex`, `honeypot_with_same_creator`…). `token_security/8453` BRETT → same shape. `approval_security/1` Permit2 → `{"contract_name":"Permit2","is_open_source":1,"trust_list":0,"doubt_list":0,"malicious_behavior":[],"contract_scan":{…"approval_abuse":0}}` in 0.37 s. Burst 6 rapid calls: all 200, no visible rate-limit headers. Docs advertise higher limits with a (free) access token — not probed.
  - Signal-quality caveat (probed on 2 real spam tokens from vitalik's wave): GoPlus says open-source/not-honeypot/holder_count 0–173 — junkiness only shows via its `dex[].liquidity` (~$2k) — combine with DexScreener.
- **DexScreener** (keyless): PEPE → pair array with `liquidity.usd` 28.09M, `volume.h24` 1.24M, txn counts, `priceUsd`, `pairCreatedAt`, `marketCap` (0.24 s, `cf-cache-status: HIT`). Spam token → `[]` (0.24 s) — clean junk detector. No rate-limit headers; docs say 300 req/min.
- **Honeypot.is** (keyless): PEPE (eth) and BRETT (chainID 8453) → `summary.risk: "low"`, `honeypotResult.isHoneypot: false`, simulated buy/sell/transfer tax, gas, holder-success analysis, `contractCode.openSource` (0.18–0.3 s). Only eth/bsc/base — exactly our chains. No key, no published SLA; treat as enrichment, not backbone.
- **Codex.io**: `graph.codex.io/graphql` with the `.env` key → **HTTP 403 `"Your account has exceeded its monthly limit, please upgrade your plan"`** (0.32 s). Unusable this billing month. (Prior project knowledge: `filterTokens` exposes `top10HoldersPercent`, `sniperCount`, holders — a good holder-concentration source when quota exists; introspection disabled, probe with real queries.)

### 7. Simulation
- `eth_simulateV1` `[{"blockStateCalls":[{"calls":[{from,to,data}]}]},"latest"]` probed with a real `approve(Permit2, 1000)`:
  - publicnode-eth OK `status 0x1 gasUsed 0xbd5d logs 1` (0.18 s); drpc-eth OK (0.17 s); base.org OK `gasUsed 0xd845` (0.22 s); publicnode-base OK (0.16 s).
  - With `"traceTransfers":true,"validation":false` on publicnode-eth: OK — returns the emitted Approval log with correct topics/data; native transfers arrive as synthetic logs.
- Alchemy `alchemy_simulateAssetChanges` on `/v2/demo` → HTTP 429 (demo key). Needs a real free-tier key (docs: included in free tier; not probed).
- Tenderly unauth → 401; free plan exists (docs, not probed). Optional premium (bundle simulation, human-readable asset diffs, state overrides UI).

---

## Open risks / blockers
1. **Base full-history for pathological wallets is the weak link.** Keyless Blockscout Base times out / 429s on event-spammed wallets (probed); Etherscan Base is paid-only (verified in live docs today); HyperSync needs a token (free, but an account must be created — user action); base.org caps getLogs at 100 blocks. Mitigations, in order: free Blockscout API key + aggressive caching and incremental cursors; free HyperSync token; paid Etherscan Lite if needed. For MVP, a "history truncated for this unusually noisy wallet" degradation path is acceptable.
2. **Both existing vendor keys are dead**: Moralis 401 unpaid-invoice (account-wide, probed on 3 endpoints), Codex 403 monthly cap. Org decision needed; neither is required for the recommended free stack.
3. **Approval-event forgery** inflates and pollutes log scans of any wallet (4/5 of vitalik's approval logs are one spam wave). The live-allowance multicall stage is mandatory, and displayed risk should be weighted by token value/liquidity — a nonzero allowance on a $2k-liquidity spam token is noise; the same on USDC is critical.
4. **Coverage gaps in the basic ERC-20 pipeline** (design items, not probed): `ApprovalForAll` (NFT/operator, different topic0) needs a parallel scan; Permit2 sub-allowances require `Permit2.allowance(owner, token, spender)` reads to itemize (an `approve` to Permit2 itself is visible normally); ERC-721 `Approval` shares topic0 with ERC-20 — filter by topic count (4 vs 3).
5. **No SLA on any keyless source**; throttles are per-IP and sticky (observed 5–15 min on base.blockscout.com), and public RPCs churn (llamarpc down today). Production shape: server-side proxy with response cache, request coalescing, exponential backoff, multi-provider rotation — never browser-direct.
6. **Free-tier terms drift** (Etherscan just moved free tier to 3 calls/s and is moving Gnosis to paid Sep 1 2026; HyperSync recently added mandatory tokens; publicnode gates archive). Re-probe the whole table before build freeze — endpoints listed in docs may not behave as documented (bidirectionally; this file is probe-truth as of 2026-08-26).
