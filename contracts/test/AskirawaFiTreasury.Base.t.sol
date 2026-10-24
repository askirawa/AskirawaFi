// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AskirawaFiTreasury} from "../AskirawaFiTreasury.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ERC-20 mock with configurable revert-on-transfer
// ─────────────────────────────────────────────────────────────────────────────
contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public decimals;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    bool public revertNextTransfer;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name     = _name;
        symbol   = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }

    function setRevertNextTransfer(bool value) external {
        revertNextTransfer = value;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (revertNextTransfer) {
            revertNextTransfer = false;
            revert("MockERC20: transfer reverted");
        }
        require(balanceOf[msg.sender] >= amount, "MockERC20: insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "MockERC20: insufficient");
        require(allowance[from][msg.sender] >= amount, "MockERC20: allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared base – no test/fuzz/invariant functions here
// ─────────────────────────────────────────────────────────────────────────────
abstract contract AskirawaFiTreasuryTestBase is Test {
    AskirawaFiTreasury internal treasury;
    MockERC20          internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");
    address internal keeper  = makeAddr("keeper");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant TREASURY_SEED = 100_000e6; // 100k USDC

    function setUp() public virtual {
        usdc     = new MockERC20("Mock USDC", "mUSDC", 6);
        treasury = new AskirawaFiTreasury(owner, address(usdc), keeper, 1);

        // Fund the treasury
        usdc.mint(address(treasury), TREASURY_SEED);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// Create a transfer proposal as `owner`, return proposalId.
    function _createTransferProposal(address recipient, uint256 amount)
        internal returns (uint256 pid)
    {
        vm.prank(owner);
        pid = treasury.createTransferProposal(recipient, amount, "memo");
    }

    /// Approve + execute a proposal as `owner` (quorum=1 scenario).
    function _approveAndExecute(uint256 pid) internal {
        vm.prank(owner);
        treasury.approve(pid);
        vm.prank(owner);
        treasury.execute(pid);
    }

    // ── getSchedule field accessors ───────────────────────────────────────────
    // Each function scopes its own return to avoid stack-too-deep on the 12-tuple.

    function _schedActive(uint256 id) internal view returns (bool v) {
        bool[2] memory flags = _schedFlags(id);
        v = flags[0];
    }
    function _schedCancelled(uint256 id) internal view returns (bool v) {
        bool[2] memory flags = _schedFlags(id);
        v = flags[1];
    }
    /// Returns [active, cancelled]
    function _schedFlags(uint256 id) internal view returns (bool[2] memory flags) {
        ScheduleView memory s = _getScheduleView(id);
        flags[0] = s.active;
        flags[1] = s.cancelled;
    }
    function _schedExecCount(uint256 id) internal view returns (uint256 v) {
        v = _getScheduleView(id).execCount;
    }
    function _schedFailCount(uint256 id) internal view returns (uint256 v) {
        v = _getScheduleView(id).failCount;
    }
    function _schedNextExec(uint256 id) internal view returns (uint64 v) {
        v = _getScheduleView(id).nextExecTime;
    }
    function _schedRecipient(uint256 id) internal view returns (address v) {
        v = _getScheduleView(id).recipient;
    }
    function _schedAmount(uint256 id) internal view returns (uint256 v) {
        v = _getScheduleView(id).amount;
    }
    function _schedFrequency(uint256 id) internal view returns (uint8 v) {
        v = _getScheduleView(id).frequency;
    }
    function _schedCreatedBy(uint256 id) internal view returns (address v) {
        v = _getScheduleView(id).createdBy;
    }
    function _schedId(uint256 id) internal view returns (uint256 v) {
        v = _getScheduleView(id).scheduleId;
    }

    struct ScheduleView {
        uint256 scheduleId;
        address recipient;
        uint256 amount;
        uint8   frequency;
        uint64  nextExecTime;
        bool    active;
        bool    cancelled;
        uint256 execCount;
        uint256 failCount;
        address createdBy;
    }

    function _getScheduleView(uint256 id) internal view returns (ScheduleView memory sv) {
        (
            sv.scheduleId,
            sv.recipient,
            sv.amount,
            sv.frequency,
            sv.nextExecTime,
            sv.active,
            sv.cancelled,
            sv.execCount,
            sv.failCount,
            ,   // memo — skip
            sv.createdBy,
            // linkedProposalId — skip
        ) = treasury.getSchedule(id);
    }

    // ── getProposal status helper ─────────────────────────────────────────────
    function _proposalStatus(uint256 pid)
        internal view returns (AskirawaFiTreasury.ProposalStatus s)
    {
        (,,,, s,,,,) = treasury.getProposal(pid);
    }
}
