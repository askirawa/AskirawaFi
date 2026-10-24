// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AskirawaFiTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ProposalStatus {
        Pending,
        Approved,
        Executed,
        Rejected,
        Cancelled,
        Expired
    }

    struct Proposal {
        uint8 kind; // 0=transfer, 1=payroll_batch, 2=recurring_setup
        address proposer;
        uint256 createdAt;
        uint256 expiresAt;
        ProposalStatus status;
        uint256 approvalCount;
        mapping(address => bool) hasApproved;
        address[] recipients;
        uint256[] amounts;
        uint256 scheduleId;
        string memo;
    }

    struct Schedule {
        uint256 id;
        address recipient;
        uint256 amount;
        uint8 frequency; // 0=daily, 1=weekly, 2=monthly
        uint64 nextExecTime;
        bool active;
        bool cancelled;
        uint256 execCount;
        uint256 failCount;
        string memo;
        address createdBy;
        uint256 linkedProposalId;
    }

    error Unauthorized();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidLength();
    error TooManyEntries();
    error InvalidProposal();
    error InvalidProposalStatus();
    error ErrProposalExpired();
    error AlreadyApproved();
    error NotExpired();
    error InvalidQuorum();
    error InvalidFrequency();
    error InvalidSchedule();
    error ScheduleNotDue();
    error ScheduleInactive();
    error ErrScheduleCancelled();
    error ApproverExists();
    error ApproverMissing();

    event ProposalCreated(uint256 indexed proposalId, uint8 indexed kind, address indexed proposer, uint256 expiresAt, string memo);
    event ProposalApproved(uint256 indexed proposalId, address indexed approver, uint256 approvalCount);
    event ProposalReadyToExecute(uint256 indexed proposalId, uint256 approvalCount);
    event ProposalRejected(uint256 indexed proposalId, address indexed approver);
    event ProposalCancelled(uint256 indexed proposalId, address indexed caller);
    event ProposalExpired(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor, bytes32 txHashLog, uint256 nonce);

    event ScheduleCreated(uint256 indexed scheduleId, address indexed recipient, uint256 amount, uint8 frequency, uint64 nextExecTime, address indexed createdBy, uint256 linkedProposalId, string memo);
    event SchedulePaused(uint256 indexed scheduleId, address indexed caller);
    event ScheduleResumed(uint256 indexed scheduleId, address indexed caller, uint64 nextExecTime);
    event ScheduleCancelled(uint256 indexed scheduleId, address indexed caller);
    event ScheduleExecuted(uint256 indexed scheduleId, address indexed recipient, uint256 amount, uint64 nextExecTime, uint256 execCount);
    event ScheduleFailed(uint256 indexed scheduleId, address indexed recipient, uint256 amount, uint256 failCount);

    event KeeperSet(address indexed keeper);
    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event QuorumUpdated(uint8 quorumThreshold);

    IERC20 public immutable usdc;
    address public keeper;
    uint8 public quorumThreshold;

    mapping(address => bool) private _approvers;
    uint256 public approverCount;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => uint256) public proposalNonce;
    uint256 public proposalCount;

    mapping(uint256 => Schedule) private _schedules;
    uint256 public scheduleCount;

    constructor(
        address initialOwner,
        address usdcToken,
        address initialKeeper,
        uint8 initialQuorum
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || usdcToken == address(0)) revert ZeroAddress();

        usdc = IERC20(usdcToken);
        keeper = initialKeeper;

        _approvers[initialOwner] = true;
        approverCount = 1;
        emit ApproverAdded(initialOwner);

        if (initialQuorum == 0 || initialQuorum > approverCount) revert InvalidQuorum();
        quorumThreshold = initialQuorum;
        emit QuorumUpdated(initialQuorum);

        emit KeeperSet(initialKeeper);
    }

    modifier onlyApprover() {
        if (!_approvers[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyApproverOrKeeper() {
        if (!_approvers[msg.sender] && msg.sender != keeper) revert Unauthorized();
        _;
    }

    modifier onlyScheduleController(uint256 scheduleId) {
        Schedule storage schedule = _schedules[scheduleId];
        if (schedule.id == 0) revert InvalidSchedule();
        if (msg.sender != owner() && msg.sender != schedule.createdBy) revert Unauthorized();
        _;
    }

    function createTransferProposal(address recipient, uint256 amount, string calldata memo)
        external
        nonReentrant
        returns (uint256 proposalId)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        proposalId = ++proposalCount;
        Proposal storage proposal = _proposals[proposalId];

        proposal.kind = 0;
        proposal.proposer = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.expiresAt = block.timestamp + 7 days;
        proposal.status = ProposalStatus.Pending;
        proposal.recipients.push(recipient);
        proposal.amounts.push(amount);
        proposal.memo = memo;

        proposalNonce[proposalId] = 1;

        emit ProposalCreated(proposalId, 0, msg.sender, proposal.expiresAt, memo);
    }

    function createPayrollBatch(address[] calldata recipients, uint256[] calldata amounts, string calldata memo)
        external
        nonReentrant
        returns (uint256 proposalId)
    {
        uint256 length = recipients.length;
        if (length == 0 || length != amounts.length) revert InvalidLength();
        if (length > 50) revert TooManyEntries();

        proposalId = ++proposalCount;
        Proposal storage proposal = _proposals[proposalId];

        proposal.kind = 1;
        proposal.proposer = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.expiresAt = block.timestamp + 7 days;
        proposal.status = ProposalStatus.Pending;
        proposal.memo = memo;

        for (uint256 i = 0; i < length; ++i) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert InvalidAmount();
            proposal.recipients.push(recipients[i]);
            proposal.amounts.push(amounts[i]);
        }

        proposalNonce[proposalId] = 1;

        emit ProposalCreated(proposalId, 1, msg.sender, proposal.expiresAt, memo);
    }

    function approve(uint256 proposalId) external nonReentrant onlyApprover {
        Proposal storage proposal = _requireProposal(proposalId);
        _expireIfNeeded(proposalId, proposal);

        if (proposal.status != ProposalStatus.Pending) revert InvalidProposalStatus();
        if (proposal.hasApproved[msg.sender]) revert AlreadyApproved();

        proposal.hasApproved[msg.sender] = true;
        proposal.approvalCount += 1;

        emit ProposalApproved(proposalId, msg.sender, proposal.approvalCount);

        if (proposal.approvalCount >= quorumThreshold) {
            proposal.status = ProposalStatus.Approved;
            proposalNonce[proposalId] += 1;
            emit ProposalReadyToExecute(proposalId, proposal.approvalCount);
        }
    }

    function reject(uint256 proposalId) external nonReentrant onlyApprover {
        Proposal storage proposal = _requireProposal(proposalId);
        _expireIfNeeded(proposalId, proposal);

        if (proposal.status != ProposalStatus.Pending && proposal.status != ProposalStatus.Approved) {
            revert InvalidProposalStatus();
        }

        proposal.status = ProposalStatus.Rejected;
        proposalNonce[proposalId] += 1;

        emit ProposalRejected(proposalId, msg.sender);
    }

    function cancel(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _requireProposal(proposalId);
        if (msg.sender != owner() && msg.sender != proposal.proposer) revert Unauthorized();

        _expireIfNeeded(proposalId, proposal);
        if (proposal.status != ProposalStatus.Pending && proposal.status != ProposalStatus.Approved) {
            revert InvalidProposalStatus();
        }

        proposal.status = ProposalStatus.Cancelled;
        proposalNonce[proposalId] += 1;

        emit ProposalCancelled(proposalId, msg.sender);
    }

    function execute(uint256 proposalId) external nonReentrant onlyApproverOrKeeper {
        Proposal storage proposal = _requireProposal(proposalId);
        _expireIfNeeded(proposalId, proposal);

        if (proposal.status != ProposalStatus.Approved) revert InvalidProposalStatus();

        proposal.status = ProposalStatus.Executed;
        proposalNonce[proposalId] += 1;

        if (proposal.kind == 0) {
            usdc.safeTransfer(proposal.recipients[0], proposal.amounts[0]);
        } else if (proposal.kind == 1) {
            uint256 length = proposal.recipients.length;
            for (uint256 i = 0; i < length; ++i) {
                usdc.safeTransfer(proposal.recipients[i], proposal.amounts[i]);
            }
        } else {
            revert InvalidProposalStatus();
        }

        bytes32 txHashLog = keccak256(
            abi.encodePacked(block.chainid, address(this), proposalId, msg.sender, proposalNonce[proposalId], block.number)
        );

        emit ProposalExecuted(proposalId, msg.sender, txHashLog, proposalNonce[proposalId]);
    }

    function createSchedule(address recipient, uint256 amount, uint8 frequency, string calldata memo)
        external
        nonReentrant
        onlyApprover
        returns (uint256 scheduleId)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        uint256 interval = _frequencyToInterval(frequency);

        scheduleId = ++scheduleCount;
        uint64 firstExec = uint64(block.timestamp + interval);

        Schedule storage schedule = _schedules[scheduleId];
        schedule.id = scheduleId;
        schedule.recipient = recipient;
        schedule.amount = amount;
        schedule.frequency = frequency;
        schedule.nextExecTime = firstExec;
        schedule.active = true;
        schedule.cancelled = false;
        schedule.memo = memo;
        schedule.createdBy = msg.sender;

        emit ScheduleCreated(scheduleId, recipient, amount, frequency, firstExec, msg.sender, 0, memo);
    }

    function executeSchedule(uint256 scheduleId) external nonReentrant {
        if (keeper == address(0)) revert Unauthorized(); // keeper not yet configured
        if (msg.sender != keeper) revert Unauthorized();

        Schedule storage schedule = _schedules[scheduleId];
        if (schedule.id == 0) revert InvalidSchedule();
        if (!schedule.active) revert ScheduleInactive();
        if (schedule.cancelled) revert ErrScheduleCancelled();
        if (block.timestamp < schedule.nextExecTime) revert ScheduleNotDue();

        // Duplicate-execution prevention: advance nextExecTime BEFORE the transfer.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 updatedNextExecTime = uint64(block.timestamp + _frequencyToInterval(schedule.frequency));
        schedule.nextExecTime = updatedNextExecTime;

        // Use low-level call so a transfer failure (e.g. insufficient treasury balance)
        // is recorded as a ScheduleFailed event instead of reverting the entire keeper tx.
        // The nonReentrant guard prevents re-entering executeSchedule from within the call.
        address usdcAddr = address(usdc);
        bytes memory callData = abi.encodeWithSelector(
            IERC20.transfer.selector, schedule.recipient, schedule.amount
        );
        (bool ok, bytes memory returnData) = usdcAddr.call(callData);
        bool transferOk = ok && (returnData.length == 0 || abi.decode(returnData, (bool)));

        if (transferOk) {
            schedule.execCount += 1;
            emit ScheduleExecuted(scheduleId, schedule.recipient, schedule.amount, updatedNextExecTime, schedule.execCount);
        } else {
            schedule.failCount += 1;
            emit ScheduleFailed(scheduleId, schedule.recipient, schedule.amount, schedule.failCount);
        }
    }

    function pauseSchedule(uint256 scheduleId) external nonReentrant onlyScheduleController(scheduleId) {
        Schedule storage schedule = _schedules[scheduleId];
        if (schedule.cancelled) revert ErrScheduleCancelled();
        if (!schedule.active) revert ScheduleInactive();

        schedule.active = false;
        emit SchedulePaused(scheduleId, msg.sender);
    }

    function resumeSchedule(uint256 scheduleId) external nonReentrant onlyScheduleController(scheduleId) {
        Schedule storage schedule = _schedules[scheduleId];
        if (schedule.cancelled) revert ErrScheduleCancelled();
        if (schedule.active) revert InvalidProposalStatus();

        schedule.active = true;
        if (schedule.nextExecTime < block.timestamp) {
            schedule.nextExecTime = uint64(block.timestamp + _frequencyToInterval(schedule.frequency));
        }

        emit ScheduleResumed(scheduleId, msg.sender, schedule.nextExecTime);
    }

    function cancelSchedule(uint256 scheduleId) external nonReentrant onlyScheduleController(scheduleId) {
        Schedule storage schedule = _schedules[scheduleId];
        if (schedule.cancelled) revert ErrScheduleCancelled();

        schedule.cancelled = true;
        schedule.active = false;

        emit ScheduleCancelled(scheduleId, msg.sender);
    }

    function setKeeper(address newKeeper) external nonReentrant onlyOwner {
        keeper = newKeeper;
        emit KeeperSet(newKeeper);
    }

    function addApprover(address approver) external nonReentrant onlyOwner {
        if (approver == address(0)) revert ZeroAddress();
        if (_approvers[approver]) revert ApproverExists();

        _approvers[approver] = true;
        approverCount += 1;

        emit ApproverAdded(approver);
    }

    function removeApprover(address approver) external nonReentrant onlyOwner {
        if (!_approvers[approver]) revert ApproverMissing();
        if (approverCount - 1 < quorumThreshold) revert InvalidQuorum();

        _approvers[approver] = false;
        approverCount -= 1;

        emit ApproverRemoved(approver);
    }

    function setQuorum(uint8 q) external nonReentrant onlyOwner {
        if (q == 0 || q > approverCount) revert InvalidQuorum();
        quorumThreshold = q;
        emit QuorumUpdated(q);
    }

    function checkExpiry(uint256 proposalId) public nonReentrant {
        Proposal storage proposal = _requireProposal(proposalId);
        if (proposal.status != ProposalStatus.Pending && proposal.status != ProposalStatus.Approved) {
            revert InvalidProposalStatus();
        }
        if (proposal.expiresAt == 0 || block.timestamp <= proposal.expiresAt) revert NotExpired();

        proposal.status = ProposalStatus.Expired;
        proposalNonce[proposalId] += 1;

        emit ProposalExpired(proposalId);
    }


    function getProposal(uint256 id)
        external
        view
        returns (
            uint8 kind,
            address proposer,
            uint256 createdAt,
            uint256 expiresAt,
            ProposalStatus status,
            uint256 approvalCount,
            uint256 scheduleId,
            string memory memo,
            uint256 nonce
        )
    {
        Proposal storage proposal = _requireProposal(id);
        kind = proposal.kind;
        proposer = proposal.proposer;
        createdAt = proposal.createdAt;
        expiresAt = proposal.expiresAt;
        status = proposal.status;
        approvalCount = proposal.approvalCount;
        scheduleId = proposal.scheduleId;
        memo = proposal.memo;
        nonce = proposalNonce[id];
    }

    function getProposalRecipients(uint256 id) external view returns (address[] memory recipients, uint256[] memory amounts) {
        Proposal storage proposal = _requireProposal(id);
        recipients = proposal.recipients;
        amounts = proposal.amounts;
    }

    function hasApproved(uint256 proposalId, address approver) external view returns (bool) {
        Proposal storage proposal = _requireProposal(proposalId);
        return proposal.hasApproved[approver];
    }

    function getSchedule(uint256 id)
        external
        view
        returns (
            uint256 scheduleId,
            address recipient,
            uint256 amount,
            uint8 frequency,
            uint64 nextExecTime,
            bool active,
            bool cancelled,
            uint256 execCount,
            uint256 failCount,
            string memory memo,
            address createdBy,
            uint256 linkedProposalId
        )
    {
        Schedule storage schedule = _schedules[id];
        if (schedule.id == 0) revert InvalidSchedule();

        scheduleId = schedule.id;
        recipient = schedule.recipient;
        amount = schedule.amount;
        frequency = schedule.frequency;
        nextExecTime = schedule.nextExecTime;
        active = schedule.active;
        cancelled = schedule.cancelled;
        execCount = schedule.execCount;
        failCount = schedule.failCount;
        memo = schedule.memo;
        createdBy = schedule.createdBy;
        linkedProposalId = schedule.linkedProposalId;
    }

    function getDueSchedules(uint256 maxCount) external view returns (uint256[] memory scheduleIds) {
        if (maxCount == 0) {
            return new uint256[](0);
        }

        uint256[] memory temp = new uint256[](maxCount);
        uint256 found;

        for (uint256 i = 1; i <= scheduleCount && found < maxCount; ++i) {
            Schedule storage schedule = _schedules[i];
            if (schedule.active && !schedule.cancelled && schedule.nextExecTime <= block.timestamp) {
                temp[found] = i;
                found += 1;
            }
        }

        scheduleIds = new uint256[](found);
        for (uint256 j = 0; j < found; ++j) {
            scheduleIds[j] = temp[j];
        }
    }

    function isApprover(address account) external view returns (bool) {
        return _approvers[account];
    }

    function _requireProposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        proposal = _proposals[proposalId];
    }

    function _expireIfNeeded(uint256 proposalId, Proposal storage proposal) internal {
        if (
            proposal.expiresAt != 0
                && block.timestamp > proposal.expiresAt
                && (proposal.status == ProposalStatus.Pending || proposal.status == ProposalStatus.Approved)
        ) {
            proposal.status = ProposalStatus.Expired;
            proposalNonce[proposalId] += 1;
            emit ProposalExpired(proposalId);
            revert ErrProposalExpired();
        }
    }

    function _frequencyToInterval(uint8 frequency) internal pure returns (uint256) {
        if (frequency == 0) return 1 days;
        if (frequency == 1) return 7 days;
        if (frequency == 2) return 30 days;
        revert InvalidFrequency();
    }
}
