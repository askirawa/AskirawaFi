// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AskirawaFiTreasuryTestBase} from "./AskirawaFiTreasury.Base.t.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/// @dev Multi-approver quorum, addApprover, removeApprover, setQuorum, setKeeper
contract AskirawaFiTreasuryQuorumTest is AskirawaFiTreasuryTestBase {

    // ── addApprover ───────────────────────────────────────────────────────────

    function test_AddApprover_HappyPath() public {
        vm.prank(owner);
        treasury.addApprover(alice);
        assertTrue(treasury.isApprover(alice));
        assertEq(treasury.approverCount(), 2);
    }

    function test_AddApprover_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(treasury));
        emit AskirawaFiTreasury.ApproverAdded(alice);
        treasury.addApprover(alice);
    }

    function test_AddApprover_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        treasury.addApprover(alice);
    }

    function test_AddApprover_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ZeroAddress.selector);
        treasury.addApprover(address(0));
    }

    function test_AddApprover_RevertDuplicate() public {
        vm.prank(owner);
        treasury.addApprover(alice);

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ApproverExists.selector);
        treasury.addApprover(alice);
    }

    // ── removeApprover ────────────────────────────────────────────────────────

    function test_RemoveApprover_HappyPath() public {
        vm.prank(owner);
        treasury.addApprover(alice);
        vm.prank(owner);
        treasury.setQuorum(1); // quorum=1 so removing alice still satisfies it

        vm.prank(owner);
        treasury.removeApprover(alice);
        assertFalse(treasury.isApprover(alice));
        assertEq(treasury.approverCount(), 1);
    }

    function test_RemoveApprover_EmitsEvent() public {
        vm.prank(owner);
        treasury.addApprover(alice);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(treasury));
        emit AskirawaFiTreasury.ApproverRemoved(alice);
        treasury.removeApprover(alice);
    }

    function test_RemoveApprover_RevertMissing() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ApproverMissing.selector);
        treasury.removeApprover(stranger);
    }

    function test_RemoveApprover_RevertBreaksQuorum() public {
        // quorum=1, approverCount=1 → removing the only approver would drop count to 0 < quorum
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidQuorum.selector);
        treasury.removeApprover(owner);
    }

    // ── setQuorum ─────────────────────────────────────────────────────────────

    function test_SetQuorum_HappyPath() public {
        vm.prank(owner);
        treasury.addApprover(alice);

        vm.prank(owner);
        treasury.setQuorum(2);
        assertEq(treasury.quorumThreshold(), 2);
    }

    function test_SetQuorum_EmitsEvent() public {
        vm.prank(owner);
        treasury.addApprover(alice);

        vm.prank(owner);
        vm.expectEmit(false, false, false, true, address(treasury));
        emit AskirawaFiTreasury.QuorumUpdated(2);
        treasury.setQuorum(2);
    }

    function test_SetQuorum_RevertZero() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidQuorum.selector);
        treasury.setQuorum(0);
    }

    function test_SetQuorum_RevertExceedsApprovers() public {
        // approverCount=1, asking for quorum=2
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidQuorum.selector);
        treasury.setQuorum(2);
    }

    function test_SetQuorum_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        treasury.setQuorum(1);
    }

    // ── multi-approver quorum scenario ────────────────────────────────────────

    function test_MultiApprover_ProposalNeedsQuorum() public {
        // Setup: add alice, set quorum=2
        vm.prank(owner);
        treasury.addApprover(alice);
        vm.prank(owner);
        treasury.setQuorum(2);

        uint256 pid = _createTransferProposal(bob, 100e6);

        // First approval → still Pending
        vm.prank(owner);
        treasury.approve(pid);
        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Pending)
        );

        // Cannot execute yet
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidProposalStatus.selector);
        treasury.execute(pid);

        // Second approval → moves to Approved
        vm.prank(alice);
        treasury.approve(pid);
        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Approved)
        );

        // Now executes
        vm.prank(owner);
        treasury.execute(pid);
        assertEq(usdc.balanceOf(bob), 100e6);
    }

    // ── setKeeper ─────────────────────────────────────────────────────────────

    function test_SetKeeper_HappyPath() public {
        vm.prank(owner);
        treasury.setKeeper(alice);
        assertEq(treasury.keeper(), alice);
    }

    function test_SetKeeper_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(treasury));
        emit AskirawaFiTreasury.KeeperSet(alice);
        treasury.setKeeper(alice);
    }

    function test_SetKeeper_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        treasury.setKeeper(alice);
    }
}
