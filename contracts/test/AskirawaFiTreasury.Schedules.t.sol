// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AskirawaFiTreasuryTestBase} from "./AskirawaFiTreasury.Base.t.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/// @dev createSchedule, executeSchedule, pauseSchedule, resumeSchedule,
///      cancelSchedule, getDueSchedules, checkExpiry
contract AskirawaFiTreasurySchedulesTest is AskirawaFiTreasuryTestBase {

    uint256 internal sid; // reusable schedule id

    function setUp() public override {
        super.setUp();
        // Create a daily schedule (frequency=0 → interval=1 day)
        vm.prank(owner);
        sid = treasury.createSchedule(alice, 50e6, 0, "daily pay");
    }

    // ── createSchedule ────────────────────────────────────────────────────────

    function test_CreateSchedule_HappyPath() public view {
        assertEq(_schedId(sid), 1);
        assertEq(_schedRecipient(sid), alice);
        assertEq(_schedAmount(sid), 50e6);
        assertEq(_schedFrequency(sid), 0);
        assertEq(_schedNextExec(sid), uint64(block.timestamp + 1 days));
        assertTrue(_schedActive(sid));
        assertFalse(_schedCancelled(sid));
        assertEq(_schedCreatedBy(sid), owner);
    }

    function test_CreateSchedule_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ScheduleCreated(2, bob, 10e6, 1, 0, owner, 0, "weekly");
        treasury.createSchedule(bob, 10e6, 1, "weekly");
    }

    function test_CreateSchedule_RevertNonApprover() public {
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.createSchedule(alice, 10e6, 0, "");
    }

    function test_CreateSchedule_RevertZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ZeroAddress.selector);
        treasury.createSchedule(address(0), 10e6, 0, "");
    }

    function test_CreateSchedule_RevertZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidAmount.selector);
        treasury.createSchedule(alice, 0, 0, "");
    }

    function test_CreateSchedule_RevertInvalidFrequency() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidFrequency.selector);
        treasury.createSchedule(alice, 10e6, 5, "");
    }

    // ── executeSchedule ───────────────────────────────────────────────────────

    function test_ExecuteSchedule_KeeperCanExecuteDue() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(keeper);
        treasury.executeSchedule(sid);

        assertEq(usdc.balanceOf(alice), 50e6);
        assertEq(_schedExecCount(sid), 1);
        assertGt(_schedNextExec(sid), uint64(block.timestamp));
    }

    function test_ExecuteSchedule_EmitsScheduleExecuted() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(keeper);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ScheduleExecuted(sid, alice, 50e6, 0, 1);
        treasury.executeSchedule(sid);
    }

    function test_ExecuteSchedule_RevertNonKeeper() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.executeSchedule(sid);
    }

    function test_ExecuteSchedule_RevertNotDue() public {
        vm.prank(keeper);
        vm.expectRevert(AskirawaFiTreasury.ScheduleNotDue.selector);
        treasury.executeSchedule(sid);
    }

    function test_ExecuteSchedule_NextExecUpdatedBeforeTransfer() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(keeper);
        treasury.executeSchedule(sid);

        // Immediately trying again should fail because nextExecTime was advanced
        vm.prank(keeper);
        vm.expectRevert(AskirawaFiTreasury.ScheduleNotDue.selector);
        treasury.executeSchedule(sid);
    }

    function test_ExecuteSchedule_FailCountOnTransferFailure() public {
        usdc.setRevertNextTransfer(true);

        vm.warp(block.timestamp + 1 days);
        vm.prank(keeper);
        treasury.executeSchedule(sid); // caught internally via try/catch

        assertEq(_schedFailCount(sid), 1);
        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_ExecuteSchedule_RevertIfCancelled() public {
        vm.prank(owner);
        treasury.cancelSchedule(sid);
        vm.warp(block.timestamp + 1 days);

        vm.prank(keeper);
        vm.expectRevert(AskirawaFiTreasury.ScheduleInactive.selector);
        treasury.executeSchedule(sid);
    }

    function test_ExecuteSchedule_RevertIfPaused() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.warp(block.timestamp + 1 days);

        vm.prank(keeper);
        vm.expectRevert(AskirawaFiTreasury.ScheduleInactive.selector);
        treasury.executeSchedule(sid);
    }

    // ── pauseSchedule ─────────────────────────────────────────────────────────

    function test_PauseSchedule_HappyPath() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        assertFalse(_schedActive(sid));
        assertFalse(_schedCancelled(sid));
    }

    function test_PauseSchedule_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.SchedulePaused(sid, owner);
        treasury.pauseSchedule(sid);
    }

    function test_PauseSchedule_RevertUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.pauseSchedule(sid);
    }

    function test_PauseSchedule_RevertAlreadyPaused() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ScheduleInactive.selector);
        treasury.pauseSchedule(sid);
    }

    // ── resumeSchedule ────────────────────────────────────────────────────────

    function test_ResumeSchedule_HappyPath() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.prank(owner);
        treasury.resumeSchedule(sid);
        assertTrue(_schedActive(sid));
    }

    function test_ResumeSchedule_ResetsNextExecIfStale() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.warp(block.timestamp + 2 days); // past original nextExecTime
        vm.prank(owner);
        treasury.resumeSchedule(sid);

        // nextExecTime must be in the future (reset to now + 1 day)
        assertGt(_schedNextExec(sid), uint64(block.timestamp));
    }

    function test_ResumeSchedule_EmitsEvent() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ScheduleResumed(sid, owner, 0);
        treasury.resumeSchedule(sid);
    }

    function test_ResumeSchedule_RevertUnauthorized() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.resumeSchedule(sid);
    }

    function test_ResumeSchedule_RevertIfNotPaused() public {
        // schedule is active — resume should revert with InvalidProposalStatus
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidProposalStatus.selector);
        treasury.resumeSchedule(sid);
    }

    // ── cancelSchedule ────────────────────────────────────────────────────────

    function test_CancelSchedule_HappyPath() public {
        vm.prank(owner);
        treasury.cancelSchedule(sid);
        assertFalse(_schedActive(sid));
        assertTrue(_schedCancelled(sid));
    }

    function test_CancelSchedule_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ScheduleCancelled(sid, owner);
        treasury.cancelSchedule(sid);
    }

    function test_CancelSchedule_RevertUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.cancelSchedule(sid);
    }

    function test_CancelSchedule_RevertAlreadyCancelled() public {
        vm.prank(owner);
        treasury.cancelSchedule(sid);
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ErrScheduleCancelled.selector);
        treasury.cancelSchedule(sid);
    }

    // ── getDueSchedules ───────────────────────────────────────────────────────

    function test_GetDueSchedules_ReturnsDueIds() public {
        vm.prank(owner);
        treasury.createSchedule(bob, 10e6, 1, "weekly");   // sid=2, 7-day interval
        vm.prank(owner);
        treasury.createSchedule(carol, 5e6, 2, "monthly"); // sid=3, 30-day interval

        vm.warp(block.timestamp + 8 days); // sid 1 (daily) and 2 (weekly) due; 3 not
        uint256[] memory due = treasury.getDueSchedules(10);
        assertEq(due.length, 2);
        assertEq(due[0], 1);
        assertEq(due[1], 2);
    }

    function test_GetDueSchedules_EmptyWhenNothingDue() public view {
        uint256[] memory due = treasury.getDueSchedules(10);
        assertEq(due.length, 0);
    }

    function test_GetDueSchedules_MaxCountRespected() public {
        vm.prank(owner);
        treasury.createSchedule(bob, 1e6, 0, "");   // sid=2
        vm.prank(owner);
        treasury.createSchedule(carol, 1e6, 0, ""); // sid=3

        vm.warp(block.timestamp + 2 days); // all 3 daily schedules are due
        uint256[] memory due = treasury.getDueSchedules(2);
        assertEq(due.length, 2);
    }

    function test_GetDueSchedules_SkipsPausedAndCancelled() public {
        vm.prank(owner);
        treasury.pauseSchedule(sid);
        vm.warp(block.timestamp + 2 days);
        uint256[] memory due = treasury.getDueSchedules(10);
        assertEq(due.length, 0);
    }

    // ── checkExpiry ───────────────────────────────────────────────────────────

    function test_CheckExpiry_MarksExpired() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.warp(block.timestamp + 8 days);
        treasury.checkExpiry(pid);
        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Expired)
        );
    }

    function test_CheckExpiry_RevertNotExpiredYet() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.expectRevert(AskirawaFiTreasury.NotExpired.selector);
        treasury.checkExpiry(pid);
    }
}
