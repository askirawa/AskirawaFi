// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AskirawaFiTreasuryTestBase} from "./AskirawaFiTreasury.Base.t.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/// @dev Fuzz tests for key arithmetic surfaces
contract AskirawaFiTreasuryFuzzTest is AskirawaFiTreasuryTestBase {

    /// Any valid amount creates a proposal and records it faithfully.
    function testFuzz_CreateTransferProposal_AmountRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        usdc.mint(address(treasury), amount); // make sure treasury can cover it later

        vm.prank(owner);
        uint256 pid = treasury.createTransferProposal(alice, amount, "fuzz");
        assertEq(pid, treasury.proposalCount());

        (address[] memory r, uint256[] memory a) = treasury.getProposalRecipients(pid);
        assertEq(r[0], alice);
        assertEq(a[0], amount);
    }

    /// Approval counter increments correctly for any quorum up to approverCount.
    function testFuzz_ApprovalCount_MatchesQuorum(uint8 rawQ) public {
        uint8 q = uint8(bound(rawQ, 1, 2));

        if (q == 2) {
            vm.prank(owner);
            treasury.addApprover(alice);
            vm.prank(owner);
            treasury.setQuorum(2);
        }

        uint256 pid = _createTransferProposal(bob, 100e6);

        vm.prank(owner);
        treasury.approve(pid);

        if (q == 2) {
            // After one approval, still Pending
            assertEq(
                uint8(_proposalStatus(pid)),
                uint8(AskirawaFiTreasury.ProposalStatus.Pending)
            );

            vm.prank(alice);
            treasury.approve(pid);
        }

        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Approved)
        );
        (,,,,, uint256 ac,,,) = treasury.getProposal(pid);
        assertEq(ac, uint256(q));
    }

    /// Transfer amount is exactly what recipient receives.
    function testFuzz_Execute_CorrectAmountReceived(uint256 amount) public {
        amount = bound(amount, 1, TREASURY_SEED);
        uint256 before = usdc.balanceOf(alice);

        uint256 pid = _createTransferProposal(alice, amount);
        _approveAndExecute(pid);

        assertEq(usdc.balanceOf(alice), before + amount);
        assertEq(usdc.balanceOf(address(treasury)), TREASURY_SEED - amount);
    }

    /// Expired proposals revert on approve regardless of how long ago they expired.
    function testFuzz_Approve_ExpiredProposalReverts(uint256 warpSeconds) public {
        warpSeconds = bound(warpSeconds, 7 days + 1, 365 days);
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.warp(block.timestamp + warpSeconds);

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ErrProposalExpired.selector);
        treasury.approve(pid);
    }

    /// Schedule execCount increments monotonically with repeated executions.
    function testFuzz_Schedule_ExecCountMonotonic(uint8 execTimes) public {
        execTimes = uint8(bound(execTimes, 1, 10));

        // Fund treasury with enough for all executions
        usdc.mint(address(treasury), uint256(execTimes) * 100e6);

        vm.prank(owner);
        uint256 schedId = treasury.createSchedule(alice, 100e6, 0, "daily");

        for (uint256 i = 0; i < execTimes; i++) {
            // Warp to exactly nextExecTime + 1 so the schedule is always due
            uint64 due = _schedNextExec(schedId);
            vm.warp(uint256(due) + 1);
            vm.prank(keeper);
            treasury.executeSchedule(schedId);
        }

        assertEq(_schedExecCount(schedId), execTimes);
        assertEq(usdc.balanceOf(alice), uint256(execTimes) * 100e6);
    }
}
