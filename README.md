# AskirawaFi

Programmable USDC treasury on Arc Mainnet. Supports atomic on-chain payroll batches, multi-approver proposal workflows, recurring automated payment schedules, automation registry integration, and persistent organization management.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry (94 tests)
- Backend: Bun server, SQLite (`bun:sqlite`), SIWE authentication
- Chain: Arc Mainnet (chain ID 5042), USDC at `0x3600000000000000000000000000000000000000`

## Features

- **Payroll** — atomic USDC batch proposals; all recipients pay in a single transaction or nothing
- **Approvals** — on-chain multi-approver voting with configurable quorum, expiry, and cancellation
- **Schedules** — recurring daily/weekly/monthly USDC payments executed by the keeper worker
- **Automations** — keeper integration with the deployed Automation Registry (ABI verification required)
- **Team** — SIWE-authenticated organization management with roles stored in a SQLite database

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.x
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Install

```bash
bun install
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_TREASURY_ADDRESS` | After deploy | Deployed AskirawaFiTreasury contract address |
| `SESSION_SECRET` | Server | Random 32-byte hex string for session cookies |
| `DATABASE_URL` | No | SQLite file path (default: `./askira.db`) |
| `KEEPER_PRIVATE_KEY` | Keeper | Private key of the keeper EOA wallet |
| `POLL_INTERVAL_MS` | No | Keeper poll frequency in ms (default: 60000) |
| `MAX_SCHEDULES_PER_POLL` | No | Max schedules checked per round (default: 20) |
| `RETRY_MAX` | No | Max retries per failed schedule (default: 1) |
| `RPC_PROXY_BASE_URL` | No | Arc Studio provisioned RPC proxy (optional outside Arc Studio) |
| `RPC_PROXY_TOKEN` | No | Arc Studio RPC proxy token |
| `RPC_PROXY_CHAINS` | No | Comma-separated proxy chain keys |

### Run

```bash
# Frontend (port 5173)
bun run dev

# Backend server — SIWE auth + org management (port 3001)
bun run server:dev

# Keeper worker — recurring payment automation
bun run keeper:dev
```

### Build

```bash
bunx vite build
```

### Test

```bash
# Smart contract tests (Foundry)
bun run contracts:test

# Lint + typecheck
bun run check
```

## Contract Deployment

The `AskirawaFiTreasury` contract is not yet deployed. See `docs/deployment-checklist.md` for the full ordered process. Quick reference:

```bash
# 1. Build contracts
bun run contracts:build

# 2. Set your deployer wallet address, then run the deployment script
export DEPLOYER_PRIVATE_KEY=0x<your-private-key>   # set in shell — never commit
export DEPLOYER_ADDRESS=$(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY)

DEPLOYER_ADDRESS=$DEPLOYER_ADDRESS \
forge script contracts/script/DeployTreasury.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  -vvvv

# 3. Record the deployed address, then add to .env
#    VITE_TREASURY_ADDRESS=0x<deployed-address>
```

The script deploys to Arc Mainnet (chain ID 5042), enforces this with a `require(block.chainid == 5042)` guard, and prints next steps. Constructor arguments are hardcoded in the script: USDC at `0x3600000000000000000000000000000000000000`, keeper disabled (`address(0)`), quorum = 1.

## Keeper Setup

1. Create a funded EOA wallet for the keeper
2. Set it as the treasury's keeper address: call `setKeeper(keeperEOA)` on the deployed treasury
3. Set `KEEPER_PRIVATE_KEY` in the keeper's environment
4. Run `bun run keeper:start` on a persistent host

See `AGENTS.md` for the full deployment checklist and remaining external setup steps.

## Security Notes

- Treasury contract has been reviewed with 94 Foundry tests. It has NOT been independently audited
- On-chain proposal payloads are immutable once created
- Keeper can only call `executeSchedule` — it cannot create or modify proposals
- SIWE nonces are single-use and expire after 5 minutes
- All backend role checks are server-side; frontend role values are never trusted
