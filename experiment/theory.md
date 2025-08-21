## 1. Introduction
In distributed systems, a **transaction** is a sequence of operations across multiple, independently managed resources (databases, services, etc.) that must succeed or fail **atomically**—either all updates are applied, or none are. Achieving atomicity in a single process is straightforward (local locking, write‐ahead logs), but across *distributed* participants it becomes challenging:

- **Partial failures** (node crashes, network partitions) can leave some participants updated and others not, violating atomicity.
- **Coordination** requires consensus on the final outcome (commit vs. abort).

A **commit protocol** is a coordination algorithm ensuring that either *all* participants commit or *all* abort, even in the face of failures.

---

## 2. Why Not One-Phase Commit?

A naïve “one-phase commit” simply has the coordinator instruct each participant:
1. “Commit your changes.”
2. Participants do so and reply “Done.”

**Problem:** If the coordinator crashes after sending some “Commit” messages but before others, some participants commit while others remain uncoordinated, violating atomicity. There is no mechanism for participants to recover the global decision without re-contacting the (possibly failed) coordinator.

---

## 3. Two-Phase Commit Overview

The **Two-Phase Commit (2PC)** protocol solves this by splitting consensus into two phases, with durable logging at each participant:


Here's the reformatted table with improved alignment and readability:

## 3. Two-Phase Commit Overview

The **Two-Phase Commit (2PC)** protocol solves this by splitting consensus into two phases, with durable logging at each participant:

| Phase | Coordinator Action      | Participant Action            |
|-------|-------------------------|--------------------------------|
| **1: Prepare (Voting)**  | Send `PREPARE` (can you commit?) | **On `PREPARE`:**<br>1. Durably log "READY"<br>2. Reply `VOTE_COMMIT` (if able) or `VOTE_ABORT` |
| **2: Commit/Abort (Decision)** | **If all votes = commit:**<br>- Log "COMMIT"<br>- Send `GLOBAL_COMMIT`<br>**Otherwise:**<br>- Log "ABORT"<br>- Send `GLOBAL_ABORT` | **On decision:**<br>1. Log decision<br>2. Execute commit/abort<br>3. Send `ACK` to coordinator |

**Key Mechanisms:**
- **Durable logging** at every step lets crashed nodes recover their last stable state.
- **Timeouts**: participants and coordinator use timers to detect lost messages/failures and take recovery actions.
- **Blocking**: if the coordinator dies mid-decision, participants in “READY” wait (blocked) until they learn the global decision.

---

## 4. Detailed Protocol States

### Coordinator States

1. **INIT**: before transaction start.
2. **WAIT_VOTES**: after sending `PREPARE`, awaiting all votes.
3. **DECIDED**: made decision (commit or abort), sending global decision.
4. **COMPLETED**: after receiving all `ACK`s.

### Participant States

1. **INIT**: before `PREPARE`.
2. **READY**: voted commit, waiting for decision.
3. **COMMITTING** / **ABORTING**: upon receiving global decision.
4. **DONE**: after sending `ACK`.

---

## 5. Failure Tolerance and Recovery

### 5.1 Coordinator Crash

- **Before Phase 2** (after voting): participants in **READY** log “READY” but have no decision → **blocking**.
- **After Phase 2**: some participants may get `GLOBAL_COMMIT` while others don’t. On recovery, the coordinator re-reads its log and re-sends the decision to stragglers.

### 5.2 Participant Crash

- **Before Vote**: coordinator times out → decides abort (presumed abort).
- **After Vote_COMMIT**: participant, on recovery, reads “READY” in its log and contacts coordinator for the final decision.
- **After Global Decision, Before ACK**: coordinator times out waiting for `ACK` and re-sends decision; participant idempotently processes and responds.

### 5.3 Network Failures

- **Message Loss**: timeouts trigger retransmission.
- **Delays**: participants remain in their logged state until a valid message arrives or timeout elapses.
- **Reordering**: sequence numbers or protocol state prevent stale messages from being mis-interpreted.

---

## 6. Blocking and Optimizations

### Blocking Nature

Participants in **READY** cannot unilaterally decide to abort—they risk violating atomicity if the global decision was commit. This **blocking** is a well-known drawback of 2PC under coordinator failure.

### Common Optimizations

- **Presumed Abort**: skip logging “ABORT” to reduce I/O; if no record of commit exists, treat as abort on recovery.
- **Presumed Commit**: skip logging “COMMIT” (less common); trade-off assumes most transactions commit.
- **Three-Phase Commit (3PC)**: adds a pre-commit phase to avoid blocking, at the cost of more messages.

---

## 7. Practical Considerations

- **Logging Overhead**: every state transition must be durably logged; batching or group commit can amortize cost.
- **Timeout Tuning**: must balance sensitivity to failures vs. false timeouts under high latency.
- **Scalability**: 2PC’s message complexity is O(N) per phase; for many participants, coordinator becomes a bottleneck.
- **Coordinator High-Availability**: real systems often replicate the coordinator (e.g., via Paxos) to reduce blocking.

---

## 8. Summary
Two-Phase Commit provides a simple, widely deployed mechanism for achieving atomic transactions across distributed participants. Through a prepare/vote phase and a commit/abort phase—combined with durable logs, timeouts, and retries—it tolerates crashes and message loss. Its main drawback is potential blocking if the coordinator fails mid-decision, motivating optimizations (presumed protocols) and more advanced non-blocking variants (3PC, consensus-based commits). Understanding 2PC is foundational for designing robust distributed transaction systems.

---

# Theory: Two-Phase Commit Protocol

The Two-Phase Commit (2PC) protocol is a distributed algorithm that ensures all participating processes in a distributed transaction either commit or abort. It is a blocking protocol, meaning that a failure of the coordinator can cause participants to block until the coordinator recovers.

The protocol works in two phases:

**Phase 1: Voting Phase**

1.  The coordinator sends a `PREPARE` message to all participants.
2.  Upon receiving the `PREPARE` message, each participant determines if it can commit the transaction.
    *   If a participant can commit, it writes a `READY` record to its log and sends a `VOTE_COMMIT` message to the coordinator.
    *   If a participant cannot commit, it sends a `VOTE_ABORT` message to the coordinator.

**Phase 2: Decision Phase**

1.  The coordinator collects the votes from all participants.
    *   If the coordinator receives `VOTE_COMMIT` from all participants, it decides to commit the transaction. It writes a `COMMIT` record to its log and sends a `GLOBAL_COMMIT` message to all participants.
    *   If the coordinator receives at least one `VOTE_ABORT` or if it times out waiting for votes, it decides to abort the transaction. It writes an `ABORT` record to its log and sends a `GLOBAL_ABORT` message to all participants.
2.  Participants receive the global decision from the coordinator.
    *   If the message is `GLOBAL_COMMIT`, the participant commits the transaction.
    *   If the message is `GLOBAL_ABORT`, the participant aborts the transaction.
3.  After executing the decision, each participant sends an `ACK` message to the coordinator.

**Failure Handling**

*   **Participant Failure:** If a participant fails before voting, the coordinator will time out and abort the transaction. If it fails after voting `VOTE_COMMIT`, it will query the coordinator for the outcome upon recovery.
*   **Coordinator Failure:** This is the more complex scenario. If the coordinator fails before sending a global decision, participants that voted `VOTE_COMMIT` are blocked and must wait for the coordinator to recover to learn the final outcome. This is the primary drawback of the 2PC protocol.
