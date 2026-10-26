// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AskirawaFiTreasuryTestBase, MockERC20} from "./AskirawaFiTreasury.Base.t.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/// @dev Deployment & initialisation tests
contract AskirawaFiTreasuryDeployTest is AskirawaFiTreasuryTestBase {

    // ── constructor happy path ────────────────────────────────────────────────

    function test_Constructor_SetsOwner() public view {
        assertEq(treasury.owner(), owner);
    }

    function test_Constructor_SetsUsdc() public view {
        assertEq(address(treasury.usdc()), address(usdc));
    }

    function test_Constructor_SetsKeeper() public view {
        assertEq(treasury.keeper(), keeper);
    }

    function test_Constructor_SetsQuorum() public view {
        assertEq(treasury.quorumThreshold(), 1);
    }

    function test_Constructor_OwnerIsApprover() public view {
        assertTrue(treasury.isApprover(owner));
    }

    function test_Constructor_ApproverCount() public view {
        assertEq(treasury.approverCount(), 1);
    }

    // ── constructor reverts ───────────────────────────────────────────────────

    function test_Constructor_RevertZeroOwner() public {
        // OZ Ownable(address(0)) fires OwnableInvalidOwner before our ZeroAddress check.
        // The contract's own ZeroAddress revert for owner is unreachable (see suspected bugs).
        MockERC20 token = new MockERC20("T", "T", 6);
        vm.expectRevert(); // OwnableInvalidOwner fires from OZ Ownable constructor
        new AskirawaFiTreasury(address(0), address(token), keeper, 1);
    }

    function test_Constructor_RevertZeroUsdc() public {
        vm.expectRevert(AskirawaFiTreasury.ZeroAddress.selector);
        new AskirawaFiTreasury(owner, address(0), keeper, 1);
    }

    function test_Constructor_RevertQuorumZero() public {
        MockERC20 token = new MockERC20("T", "T", 6);
        vm.expectRevert(AskirawaFiTreasury.InvalidQuorum.selector);
        new AskirawaFiTreasury(owner, address(token), keeper, 0);
    }

    function test_Constructor_RevertQuorumExceedsApprovers() public {
        MockERC20 token = new MockERC20("T", "T", 6);
        vm.expectRevert(AskirawaFiTreasury.InvalidQuorum.selector);
        new AskirawaFiTreasury(owner, address(token), keeper, 2);
    }
}
