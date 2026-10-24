// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AskirawaFiTreasuryTestBase} from "./AskirawaFiTreasury.Base.t.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";

/// @dev createTransferProposal, createPayrollBatch, approve, reject, cancel, execute
contract AskirawaFiTreasuryProposalsTest is AskirawaFiTreasuryTestBase {

    // ── createTransferProposal ────────────────────────────────────────────────

    function test_CreateTransferProposal_HappyPath() public {
        vm.prank(owner);
        uint256 pid = treasury.createTransferProposal(alice, 500e6, "pay alice");
        assertEq(pid, 1);
        assertEq(treasury.proposalCount(), 1);

        {
            (uint8 kind,,, uint256 expiresAt, AskirawaFiTreasury.ProposalStatus status,,,, ) =
                treasury.getProposal(pid);
            assertEq(kind, 0);
            assertEq(uint8(status), uint8(AskirawaFiTreasury.ProposalStatus.Pending));
            assertEq(expiresAt, block.timestamp + 7 days);
        }
    }

    function test_CreateTransferProposal_RevertZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ZeroAddress.selector);
        treasury.createTransferProposal(address(0), 100e6, "");
    }

    function test_CreateTransferProposal_RevertZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidAmount.selector);
        treasury.createTransferProposal(alice, 0, "");
    }

    function test_CreateTransferProposal_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, false, address(treasury));
        emit AskirawaFiTreasury.ProposalCreated(1, 0, owner, block.timestamp + 7 days, "memo");
        treasury.createTransferProposal(alice, 100e6, "memo");
    }

    // ── createPayrollBatch ────────────────────────────────────────────────────

    function test_CreatePayrollBatch_HappyPath() public {
        address[] memory r = new address[](3);
        uint256[] memory a = new uint256[](3);
        r[0] = alice; r[1] = bob; r[2] = carol;
        a[0] = 100e6; a[1] = 200e6; a[2] = 300e6;

        vm.prank(owner);
        uint256 pid = treasury.createPayrollBatch(r, a, "payroll");
        assertEq(pid, 1);

        (uint8 kind,,,,,,,,) = treasury.getProposal(pid);
        assertEq(kind, 1);

        (address[] memory gotR, uint256[] memory gotA) = treasury.getProposalRecipients(pid);
        assertEq(gotR.length, 3);
        assertEq(gotR[0], alice);
        assertEq(gotA[1], 200e6);
    }

    function test_CreatePayrollBatch_RevertLengthMismatch() public {
        address[] memory r = new address[](2);
        uint256[] memory a = new uint256[](3);
        r[0] = alice; r[1] = bob;
        a[0] = 1e6; a[1] = 2e6; a[2] = 3e6;

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidLength.selector);
        treasury.createPayrollBatch(r, a, "");
    }

    function test_CreatePayrollBatch_RevertEmptyArray() public {
        address[] memory r = new address[](0);
        uint256[] memory a = new uint256[](0);
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidLength.selector);
        treasury.createPayrollBatch(r, a, "");
    }

    function test_CreatePayrollBatch_RevertTooManyEntries() public {
        address[] memory r = new address[](51);
        uint256[] memory a = new uint256[](51);
        for (uint256 i = 0; i < 51; i++) {
            r[i] = address(uint160(i + 1));
            a[i] = 1e6;
        }
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.TooManyEntries.selector);
        treasury.createPayrollBatch(r, a, "");
    }

    function test_CreatePayrollBatch_RevertZeroAddressInArray() public {
        address[] memory r = new address[](2);
        uint256[] memory a = new uint256[](2);
        r[0] = alice; r[1] = address(0);
        a[0] = 1e6;   a[1] = 2e6;
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ZeroAddress.selector);
        treasury.createPayrollBatch(r, a, "");
    }

    // ── approve ───────────────────────────────────────────────────────────────

    function test_Approve_HappyPath() public {
        uint256 pid = _createTransferProposal(alice, 100e6);

        vm.prank(owner);
        treasury.approve(pid);

        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Approved)
        );
        (,,,,, uint256 approvalCount,,,) = treasury.getProposal(pid);
        assertEq(approvalCount, 1);
        assertTrue(treasury.hasApproved(pid, owner));
    }

    function test_Approve_EmitsApprovedAndReady() public {
        uint256 pid = _createTransferProposal(alice, 100e6);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(treasury));
        emit AskirawaFiTreasury.ProposalApproved(pid, owner, 1);
        treasury.approve(pid);
    }

    function test_Approve_RevertDoubleApprove() public {
        // quorum=1: first approve moves status to Approved.
        // Second approve hits InvalidProposalStatus (status != Pending) before AlreadyApproved.
        // This is a known ordering issue in the contract (see suspected contract bugs).
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        treasury.approve(pid);

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidProposalStatus.selector);
        treasury.approve(pid);
    }

    function test_Approve_RevertNonApprover() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.approve(pid);
    }

    function test_Approve_RevertExpiredProposal() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.warp(block.timestamp + 8 days); // past 7-day expiry

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ErrProposalExpired.selector);
        treasury.approve(pid);
    }

    // ── reject ────────────────────────────────────────────────────────────────

    function test_Reject_HappyPath() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        treasury.reject(pid);

        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Rejected)
        );
    }

    function test_Reject_EmitsEvent() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ProposalRejected(pid, owner);
        treasury.reject(pid);
    }

    function test_Reject_RevertNonApprover() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.reject(pid);
    }

    // ── cancel ────────────────────────────────────────────────────────────────

    function test_Cancel_ByProposer() public {
        vm.prank(alice);
        uint256 pid = treasury.createTransferProposal(bob, 50e6, "");

        vm.prank(alice);
        treasury.cancel(pid);

        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Cancelled)
        );
    }

    function test_Cancel_ByOwner() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        treasury.cancel(pid);

        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Cancelled)
        );
    }

    function test_Cancel_RevertUnauthorized() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(stranger);
        vm.expectRevert(AskirawaFiTreasury.Unauthorized.selector);
        treasury.cancel(pid);
    }

    function test_Cancel_EmitsEvent() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ProposalCancelled(pid, owner);
        treasury.cancel(pid);
    }

    // ── execute ───────────────────────────────────────────────────────────────

    function test_Execute_TransferHappyPath() public {
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 pid = _createTransferProposal(alice, 500e6);

        vm.prank(owner);
        treasury.approve(pid);
        vm.prank(owner);
        treasury.execute(pid);

        assertEq(usdc.balanceOf(alice), aliceBefore + 500e6);
        assertEq(
            uint8(_proposalStatus(pid)),
            uint8(AskirawaFiTreasury.ProposalStatus.Executed)
        );
    }

    function test_Execute_EmitsEvent() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        treasury.approve(pid);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(treasury));
        emit AskirawaFiTreasury.ProposalExecuted(pid, owner, bytes32(0), 0);
        treasury.execute(pid);
    }

    function test_Execute_RevertIfNotApproved() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidProposalStatus.selector);
        treasury.execute(pid);
    }

    function test_Execute_RevertReplay() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        _approveAndExecute(pid);

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.InvalidProposalStatus.selector);
        treasury.execute(pid);
    }

    function test_Execute_PayrollBatch() public {
        address[] memory r = new address[](3);
        uint256[] memory a = new uint256[](3);
        r[0] = alice; r[1] = bob; r[2] = carol;
        a[0] = 100e6; a[1] = 200e6; a[2] = 300e6;

        vm.prank(owner);
        uint256 pid = treasury.createPayrollBatch(r, a, "payroll");
        vm.prank(owner);
        treasury.approve(pid);
        vm.prank(owner);
        treasury.execute(pid);

        assertEq(usdc.balanceOf(alice), 100e6);
        assertEq(usdc.balanceOf(bob),   200e6);
        assertEq(usdc.balanceOf(carol), 300e6);
    }

    function test_Execute_PayrollBatch_AtomicRevertOnFailedTransfer() public {
        address[] memory r = new address[](2);
        uint256[] memory a = new uint256[](2);
        r[0] = alice; r[1] = bob;
        a[0] = 100e6; a[1] = 200e6;

        vm.prank(owner);
        uint256 pid = treasury.createPayrollBatch(r, a, "payroll");
        vm.prank(owner);
        treasury.approve(pid);

        // make the next transfer call fail (hits first transfer → alice)
        usdc.setRevertNextTransfer(true);

        vm.prank(owner);
        vm.expectRevert();
        treasury.execute(pid);

        // alice's balance must be unchanged (atomicity)
        assertEq(usdc.balanceOf(alice), 0);
    }

    // ── proposal expiry via execute ───────────────────────────────────────────

    function test_Execute_RevertExpiredProposal() public {
        uint256 pid = _createTransferProposal(alice, 100e6);
        vm.prank(owner);
        treasury.approve(pid); // Approved
        vm.warp(block.timestamp + 8 days);

        vm.prank(owner);
        vm.expectRevert(AskirawaFiTreasury.ErrProposalExpired.selector);
        treasury.execute(pid);
    }
}
