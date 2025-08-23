### Procedure

This experiment simulates the Two-Phase Commit protocol. Follow these steps to conduct the experiment:

1.  **Configure the Transaction:**
    *   Select the **Number of Participants** from the dropdown menu.
    *   Choose a **Failure Scenario** to simulate. Options include coordinator or participant failures in either phase, network partitions, or timeouts.

2.  **Control the Simulation:**
    *   Adjust the **Animation Speed** to control the simulation's pace.
    *   Select the **Simulation Mode**:
        *   **Step-by-step (Manual):** Use the "Next Step" button to advance the protocol one step at a time.
        *   **Automatic:** The simulation runs automatically. Use the "Run Simulation" button to start.

3.  **Observe the Simulation:**
    *   The **Simulation Area** visually represents the coordinator, participants, and messages.
    *   The **Phase Indicator** shows the current phase of the protocol.
    *   The **Transaction Log** displays a detailed log of all actions and state changes.
    *   The **Transaction Statistics** panel shows counts of successful commits, aborts, and failures.

4.  **Run Scenarios:**
    *   Start with the "No Failures" scenario to understand the normal workflow.
    *   Run each of the failure scenarios to observe how the protocol handles them.
    *   Use the "Reset Simulation" button to start a new simulation.
