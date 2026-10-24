// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/**
 * @title DeployTreasury
 * @notice Deploys AskirawaFiTreasury to Arc Mainnet (chain ID 5042).
 *
 * Usage:
 *   forge script contracts/script/DeployTreasury.s.sol \
 *     --rpc-url arc_mainnet \
 *     --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     -vvvv
 *
 * Required env vars (never commit values):
 *   DEPLOYER_PRIVATE_KEY   — 0x... private key of the deploying wallet (becomes owner)
 *
 * The deployer wallet address is used as initialOwner.
 * USDC on Arc Mainnet: 0x3600000000000000000000000000000000000000
 * Initial keeper:      address(0)  — disabled until owner calls setKeeper()
 * Initial quorum:      1           — single-approver (owner) can approve proposals
 *
 * After deployment, record the treasury address in .env as VITE_TREASURY_ADDRESS.
 * Do NOT call setKeeper() or fund the treasury until you have verified the deployment.
 */
contract DeployTreasury is Script {
    // Arc Mainnet USDC (ERC-20 view, 6 decimals)
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        // Validate we are on Arc Mainnet
        require(block.chainid == 5042, "DeployTreasury: must run on Arc Mainnet (chain ID 5042)");

        vm.startBroadcast();

        AskirawaFiTreasury treasury = new AskirawaFiTreasury(
            deployer,      // initialOwner — becomes the first approver
            USDC,          // usdcToken   — Arc Mainnet USDC
            address(0),    // initialKeeper — disabled; owner must call setKeeper() later
            1              // initialQuorum — quorum = 1 (single-approver mode)
        );

        vm.stopBroadcast();

        console.log("=== AskirawaFiTreasury deployed ===");
        console.log("Address:     ", address(treasury));
        console.log("Owner:       ", treasury.owner());
        console.log("USDC:        ", address(treasury.usdc()));
        console.log("Keeper:      ", treasury.keeper(), "(disabled - call setKeeper() to activate)");
        console.log("Quorum:      ", treasury.quorumThreshold());
        console.log("Chain ID:    ", block.chainid);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set VITE_TREASURY_ADDRESS=", address(treasury), "in .env");
        console.log("  2. Deploy frontend (bun run build)");
        console.log("  3. Transfer USDC to the treasury address before any payroll execution");
        console.log("  4. When keeper EOA is ready, call setKeeper(<keeperAddress>) from the owner wallet");
    }
}
