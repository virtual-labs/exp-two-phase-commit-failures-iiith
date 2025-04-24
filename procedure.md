### Procedure

Use the steps below to run through the baseline commit and then each failure scenario in sequence. The simulator UI consists of:
- **Canvas** (center): visual nodes/links/messages
- **Control Panel** (left): Start/Reset buttons, timeouts, clock speed, scenario selector
- **State & Log Panel** (right): per-node state, protocol log

---

### A. Setup & Baseline Commit
1. **Load the Simulator**
   - Open the simulation in your browser. You’ll see five nodes: C (coordinator) in pink, P₁–P₄ (participants) in blue, connected by solid gray links.
2. **Verify Defaults**
   - Vote Timeout = 5000 ms; Decision Timeout = 5000 ms; Clock 1×.
3. **Start a Clean Run**
   - Click **Reset Simulation**. Confirm all node states read `INIT` and log is empty.
4. **Execute Normal Commit**
   - Click **Start Transaction**.
   - Watch in the log:
     - C → PREPARE → P₁–P₄ → each logs READY and replies VOTE_COMMIT
     - C collects all votes, logs COMMIT, broadcasts GLOBAL_COMMIT
     - P₁–P₄ each log COMMIT, send ACK → C completes.
   - Confirm all four participants end in `COMMITTING` → `DONE` and coordinator state `DONE`.

---

### B. Progress-Based Failure Scenarios
Use the **Scenario** dropdown to pick each task in order. You may only inject the *allowed* failures per scenario.

#### Scenario 1: Single Participant Crash
- **Goal:** Force GLOBAL_ABORT by crashing exactly one participant before it votes.
- **Allowed:** 1 participant crash.
- **Steps:**
  1. **Reset** the sim.
  2. **Select** “Single Participant Crash.” Read instructions.
  3. Click **Start Transaction**.
  4. As soon as any one P (e.g. P₂) receives PREPARE but *before* it sends VOTE_COMMIT, **click** that node to crash it (it’ll gray out).
  5. Wait for Vote‐Timeout → C must decide GLOBAL_ABORT.
  6. **Check:** All P₁, P₃, P₄ log ABORT; coordinator logs ABORT.
  7. Simulator flashes “Scenario Passed!” and unlocks the next scenario.

#### Scenario 2: Dropped Vote Message
- **Goal:** Force ABORT by dropping exactly one VOTE_COMMIT.
- **Allowed:** 1 link down.
- **Steps:**
  1. **Click** “Dropped Vote Message” in the Scenario dropdown.
  2. **Reset**.
  3. **Start Transaction**.
  4. Immediately after C sends PREPARE, **click** the link between C and one P (e.g. P₃) to bring it down (dashed red).
  5. Wait for Vote‐Timeout → C must GLOBAL_ABORT.
  6. **Verify:** P₃ never sent a vote; P₁, P₂, P₄ receive GLOBAL_ABORT and abort.
  7. “Scenario Passed!” appears; Scenario 3 unlocked.

---

Enjoy exploring how 2PC handles failures in addtional scenarios!
