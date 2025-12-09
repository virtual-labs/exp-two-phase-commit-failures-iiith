class TwoPhaseCommitSimulation {
    constructor() {
        this.participants = [];
        this.participantCount = 3;
        this.currentPhase = 'ready';
        this.failureMode = 'none';
        this.isRunning = false;
        this.simulationMode = 'manual';
        this.isAutoPlaying = false;
        this.manualStep = 0;
        this.animationSpeed = 1;
        this.stats = {
            successful: 0,
            aborted: 0,
            failures: 0,
            total: 0
        };
        this.coordinatorState = 'idle';
        this.participantStates = [];
        
        this.initializeElements();
        this.bindEvents();
        this.createParticipants();
        this.updateStats();
        this.updateControls();
    }

    initializeElements() {
        this.simulationArea = document.querySelector('.simulation-area');
        this.coordinator = document.getElementById('coordinator');
        this.participantsContainer = document.getElementById('participants');
        this.phaseIndicator = document.getElementById('phaseIndicator');
        this.logContainer = document.getElementById('logContainer');
        this.failureOverlay = document.getElementById('failureOverlay');
        this.tooltip = document.getElementById('tooltip');

        this.simulationModeSelect = document.getElementById('simulationMode');
        this.manualControls = document.getElementById('manualControls');
        this.automaticControls = document.getElementById('automaticControls');
        this.nextStepBtn = document.getElementById('nextStepBtn');
        this.runAutoBtn = document.getElementById('runAutoBtn');
        this.resetBtn = document.getElementById('resetSimulation');
        
        this.coordinatorStatusBadge = document.getElementById('coordinatorStatus');
        this.coordinatorDetails = document.getElementById('coordinatorDetails');
        this.participantsStateContainer = document.getElementById('participantsState');
    }

    bindEvents() {
        this.simulationModeSelect.addEventListener('change', (e) => {
            this.simulationMode = e.target.value;
            this.log(`Simulation mode changed to: ${this.simulationMode}`, 'info');
            this.resetSimulation();
            this.updateControls();
        });

        this.nextStepBtn.addEventListener('click', () => this.handleManualStep());
        this.runAutoBtn.addEventListener('click', () => this.runSingleAutomaticTransaction());
        this.resetBtn.addEventListener('click', () => this.resetSimulation());
        
        document.getElementById('participantCount').addEventListener('change', (e) => {
            this.participantCount = parseInt(e.target.value);
            this.createParticipants();
            this.resetSimulation();
        });
        
        document.getElementById('failureMode').addEventListener('change', (e) => {
            this.failureMode = e.target.value;
            this.log(`Failure mode changed to: ${this.getFailureModeDescription(this.failureMode)}`, 'info');
        });

        document.getElementById('animationSpeed').addEventListener('input', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = e.target.value + 'x';
            this.log(`Animation speed changed to ${e.target.value}x`, 'info');
        });

        this.coordinator.addEventListener('mouseenter', (e) => {
            const status = this.coordinatorState;
            const tooltipText = `Transaction Coordinator\nStatus: ${status}\nPhase: ${this.currentPhase}`;
            this.showTooltip(e, tooltipText);
        });
        this.coordinator.addEventListener('mouseleave', () => this.hideTooltip());
    }

    updateControls() {
        if (this.simulationMode === 'manual') {
            this.manualControls.style.display = 'block';
            this.automaticControls.style.display = 'none';
        } else {
            this.manualControls.style.display = 'none';
            this.automaticControls.style.display = 'block';
        }
    }
    
    getFailureModeDescription(mode) {
        const descriptions = {
            'none': 'No failures',
            'coordinator_phase1': 'Coordinator fails during prepare phase',
            'coordinator_phase2': 'Coordinator fails during commit phase',
            'participant_phase1': 'Participant fails during prepare phase',
            'participant_phase2': 'Participant fails during commit phase',
            'network_partition': 'Network partition isolates nodes',
            'timeout': 'Transaction timeout occurs'
        };
        return descriptions[mode] || mode;
    }

    getParticipantStateDescription(status) {
        const descriptions = {
            'ready': 'Waiting for transaction',
            'voted-yes': 'Voted to commit',
            'voted-no': 'Voted to abort',
            'committed': 'Transaction committed',
            'aborted': 'Transaction aborted',
            'failed': 'Node failure detected'
        };
        return descriptions[status] || 'Unknown state';
    }

    createParticipants() {
        this.participantsContainer.innerHTML = '';
        this.participants = [];
        
        const centerX = 50;
        const centerY = 50;
        const radius = 35;
        
        for (let i = 0; i < this.participantCount; i++) {
            const participant = document.createElement('div');
            participant.className = 'participant';
            participant.innerHTML = `P${i + 1}`;
            participant.dataset.id = i;
            participant.dataset.status = 'ready';
            
            const angle = (2 * Math.PI * i) / this.participantCount - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            participant.style.position = 'absolute';
            participant.style.left = `${x}%`;
            participant.style.top = `${y}%`;
            participant.style.transform = 'translate(-50%, -50%)';
            
            participant.addEventListener('mouseenter', (e) => {
                const status = participant.dataset.status || 'ready';
                const tooltipText = `Participant ${i + 1}\nStatus: ${status}\nState: ${this.getParticipantStateDescription(status)}`;
                this.showTooltip(e, tooltipText);
            });
            participant.addEventListener('mouseleave', () => this.hideTooltip());
            
            this.participantsContainer.appendChild(participant);
            this.participants.push(participant);
            this.participantStates[i] = { id: i + 1, status: 'ready', state: 'idle' };
        }
        
        this.log(`Network initialized with ${this.participantCount} participants`, 'info');
        this.updateProcessStateUI();
    }

    showTooltip(event, text) {
        this.tooltip.innerHTML = text.replace(/\n/g, '<br>');
        this.tooltip.style.left = event.pageX + 10 + 'px';
        this.tooltip.style.top = event.pageY - 30 + 'px';
        this.tooltip.classList.add('show');
    }

    hideTooltip() {
        this.tooltip.classList.remove('show');
    }

    // MANUAL MODE FUNCTIONS
    async handleManualStep() {
        // If transaction is complete, reset for new transaction
        if (this.currentPhase === 'committed' || this.currentPhase === 'aborted') {
            this.manualStep = 0;
            this.currentPhase = 'ready';
            this.updatePhaseIndicator();
            this.resetParticipantStates();
            this.nextStepBtn.textContent = '➡️ Next Step';
            this.log('Ready for new manual transaction', 'info');
            return;
        }

        // Prevent multiple clicks
        if (this.nextStepBtn.disabled) return;

        // Initialize transaction on first step
        if (this.manualStep === 0) {
            this.isRunning = true;
            this.stats.total++;
            this.updateStats();
            this.log('Starting new manual transaction...', 'info');
            this.resetParticipantStates();
        }

        this.nextStepBtn.disabled = true;

        try {
            switch (this.manualStep) {
                case 0:
                    await this.manualPhase1Start();
                    break;
                case 1:
                    await this.manualPhase1Votes();
                    break;
                case 2:
                    await this.manualPhase2Decision();
                    break;
                case 3:
                    await this.manualPhase2Complete();
                    break;
            }
            this.manualStep++;
        } catch (error) {
            this.log(`Error during manual step: ${error.message}`, 'error');
            this.completeManualTransaction(false);
        } finally {
            this.nextStepBtn.disabled = false;
        }
    }

    updateProcessStateUI() {
        // Update coordinator status
        if (this.coordinatorStatusBadge) {
            const coordinatorClass = this.coordinator.classList.contains('failed') ? 'failed' : 
                                    this.coordinator.classList.contains('active') ? 'active' : 'ready';
            this.coordinatorStatusBadge.textContent = coordinatorClass.charAt(0).toUpperCase() + coordinatorClass.slice(1);
            this.coordinatorStatusBadge.className = `process-status-badge status-${coordinatorClass}`;
        }
        
        if (this.coordinatorDetails) {
            this.coordinatorDetails.innerHTML = `
                <div class="detail-item">State: <span class="detail-value">${this.coordinatorState}</span></div>
                <div class="detail-item">Phase: <span class="detail-value">${this.currentPhase}</span></div>
            `;
        }
        
        // Update participants state
        if (this.participantsStateContainer) {
            this.participantsStateContainer.innerHTML = '';
            this.participants.forEach((participant, i) => {
                const status = participant.dataset.status || 'ready';
                const isFailed = participant.classList.contains('failed');
                const isActive = participant.classList.contains('voted-yes') || participant.classList.contains('voted-no');
                
                const stateDiv = document.createElement('div');
                stateDiv.className = 'process-node';
                stateDiv.innerHTML = `
                    <div class="process-node-header">
                        <span class="process-node-icon">💾</span>
                        <span class="process-node-name">P${i + 1}</span>
                        <span class="process-status-badge status-${isFailed ? 'failed' : isActive ? 'active' : 'ready'}">
                            ${isFailed ? 'Failed' : isActive ? 'Active' : 'Ready'}
                        </span>
                    </div>
                    <div class="process-node-details">
                        <div class="detail-item">Status: <span class="detail-value">${status}</span></div>
                    </div>
                `;
                this.participantsStateContainer.appendChild(stateDiv);
            });
        }
    }

    async manualPhase1Start() {
        this.currentPhase = 'phase1';
        this.updatePhaseIndicator();
        this.coordinator.classList.add('active');
        this.coordinatorState = 'sending-prepare';
        this.updateProcessStateUI();
        
        this.log('Phase 1: Coordinator sending PREPARE messages...', 'info');
        
        if (this.failureMode === 'coordinator_phase1') {
            this.log('Coordinator fails before sending PREPARE messages.', 'error');
            this.coordinator.classList.add('failed');
            this.coordinatorState = 'failed';
            this.updateProcessStateUI();
            this.showFailureOverlay();
            this.stats.failures++;
            throw new Error('Coordinator failed in Phase 1');
        }

        if (this.failureMode === 'timeout') {
            return this.createManualTimeout();
        }

        if (this.failureMode === 'network_partition') {
            return this.createManualNetworkPartition();
        }
        
        for (let i = 0; i < this.participants.length; i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        
        this.nextStepBtn.textContent = '📝 Collect Votes';
    }

    async manualPhase1Votes() {
        this.log('Phase 1: Collecting votes from participants...', 'info');
        
        let allVotesYes = true;
        let participantResponses = 0;
        
        for (let i = 0; i < this.participants.length; i++) {
            if (this.failureMode === 'participant_phase1' && i === 1) {
                this.log(`Participant ${i + 1} fails before voting.`, 'error');
                this.participants[i].classList.add('failed');
                this.stats.failures++;
                allVotesYes = false;
                await this.sendMessage(this.participants[i], this.coordinator, 'FAIL');
                continue;
            }

            const vote = (Math.random() > 0.15) ? 'YES' : 'NO';
            await this.sendMessage(this.participants[i], this.coordinator, `VOTE_${vote}`);
            this.participants[i].classList.add(vote === 'YES' ? 'voted-yes' : 'voted-no');
            this.participants[i].dataset.status = vote === 'YES' ? 'voted-yes' : 'voted-no';
            this.participantStates[i].status = vote === 'YES' ? 'voted-yes' : 'voted-no';
            this.updateProcessStateUI();
            
            if (vote === 'NO') allVotesYes = false;
            participantResponses++;
        }
        
        this.coordinator.classList.remove('active');
        this.coordinatorState = 'processing-votes';
        this.updateProcessStateUI();
        
        if (allVotesYes && participantResponses === this.participants.length) {
            this.log('All participants voted YES. Preparing to commit.', 'success');
            this.currentPhase = 'prepare_commit';
        } else {
            this.log('One or more participants voted NO or failed. Preparing to abort.', 'warning');
            this.currentPhase = 'prepare_abort';
        }
        
        this.nextStepBtn.textContent = '📢 Send Decision';
    }

    async manualPhase2Decision() {
        this.updatePhaseIndicator();
        this.coordinator.classList.add('active');
        this.coordinatorState = 'broadcasting-decision';
        this.updateProcessStateUI();
        
        const decision = this.currentPhase === 'prepare_commit' ? 'COMMIT' : 'ABORT';
        this.log(`Phase 2: Broadcasting ${decision} decision...`, 'info');
        
        if (this.failureMode === 'coordinator_phase2') {
            this.log('Coordinator fails before sending decision.', 'error');
            this.coordinator.classList.add('failed');
            this.coordinatorState = 'failed';
            this.updateProcessStateUI();
            this.showFailureOverlay();
            this.stats.failures++;
            throw new Error('Coordinator failed in Phase 2');
        }
        
        for (let i = 0; i < this.participants.length; i++) {
            if (!this.participants[i].classList.contains('failed')) {
                await this.sendMessage(this.coordinator, this.participants[i], decision);
            }
        }
        
        this.nextStepBtn.textContent = '✅ Complete Transaction';
    }

    async manualPhase2Complete() {
        this.log('Phase 2: Processing acknowledgments...', 'info');
        
        const decision = this.currentPhase === 'prepare_commit' ? 'COMMIT' : 'ABORT';
        
        for (let i = 0; i < this.participants.length; i++) {
            if (this.participants[i].classList.contains('failed')) continue;

            if (this.failureMode === 'participant_phase2' && i === 1) {
                this.log(`Participant ${i + 1} fails before acknowledging.`, 'error');
                this.participants[i].classList.add('failed');
                this.participants[i].dataset.status = 'failed';
                this.participantStates[i].status = 'failed';
                this.updateProcessStateUI();
                this.stats.failures++;
            } else {
                await this.sendMessage(this.participants[i], this.coordinator, 'ACK');
                this.participants[i].classList.add(decision === 'COMMIT' ? 'committed' : 'aborted');
                this.participants[i].dataset.status = decision === 'COMMIT' ? 'committed' : 'aborted';
                this.participantStates[i].status = decision === 'COMMIT' ? 'committed' : 'aborted';
                this.updateProcessStateUI();
            }
        }
        
        this.coordinator.classList.remove('active');
        this.coordinatorState = 'finalizing';
        this.updateProcessStateUI();
        this.completeManualTransaction(decision === 'COMMIT');
    }

    completeManualTransaction(isSuccess) {
        if (isSuccess) {
            this.log('Transaction successfully committed!', 'success');
            this.currentPhase = 'committed';
            this.coordinatorState = 'committed';
            this.stats.successful++;
        } else {
            this.log('Transaction aborted.', 'error');
            this.currentPhase = 'aborted';
            this.coordinatorState = 'aborted';
            this.stats.aborted++;
        }
        
        this.updatePhaseIndicator();
        this.updateStats();
        this.updateProcessStateUI();
        this.isRunning = false;
        this.manualStep = 0;
        
        this.nextStepBtn.textContent = '🔄 Start New';
    }

    // AUTOMATIC MODE FUNCTIONS
    async runSingleAutomaticTransaction() {
        if (this.isRunning) {
            this.log('A simulation is already in progress.', 'warning');
            return;
        }

        this.runAutoBtn.disabled = true;
        this.runAutoBtn.textContent = '⏳ Running...';
        this.isRunning = true;
        this.stats.total++;
        this.updateStats();

        this.log('Starting automatic transaction...', 'info');
        this.resetParticipantStates();

        try {
            await this.executeAutomaticTransaction();
            
            if (this.currentPhase === 'committed') {
                this.log('Transaction successfully committed!', 'success');
                this.stats.successful++;
            } else {
                this.log('Transaction aborted.', 'error');
                this.stats.aborted++;
            }
        } catch (error) {
            this.log(`Transaction failed: ${error.message}`, 'error');
            this.stats.failures++;
            this.currentPhase = 'aborted';
        } finally {
            this.updateStats();
            this.isRunning = false;
            this.runAutoBtn.disabled = false;
            this.runAutoBtn.textContent = '▶️ Run Simulation';
        }
    }

    async executeAutomaticTransaction() {
        // Phase 1: Prepare
        await this.executePhase1();
        
        if (this.currentPhase === 'aborted') {
            this.log('Aborting due to Phase 1 failure.', 'warning');
            return;
        }
        
        // Phase 2: Commit/Abort
        await this.executePhase2();
        
        if (this.currentPhase === 'prepare_commit') {
            this.currentPhase = 'committed';
            this.coordinatorState = 'committed';
        } else if (this.currentPhase === 'prepare_abort') {
            this.currentPhase = 'aborted';
            this.coordinatorState = 'aborted';
        }
        this.updateProcessStateUI();
    }

    async executePhase1() {
        this.currentPhase = 'phase1';
        this.updatePhaseIndicator();
        this.coordinator.classList.add('active');
        this.coordinatorState = 'sending-prepare';
        this.updateProcessStateUI();
        this.log('Phase 1: Prepare phase initiated', 'info');

        await this.delay(500);

        if (this.failureMode === 'coordinator_phase1') {
            this.log('Coordinator fails before sending PREPARE.', 'error');
            this.coordinator.classList.add('failed');
            this.coordinatorState = 'failed';
            this.updateProcessStateUI();
            this.showFailureOverlay();
            throw new Error('Coordinator failed in Phase 1');
        }

        if (this.failureMode === 'timeout') {
            return this.createTimeout();
        }

        if (this.failureMode === 'network_partition') {
            return this.createNetworkPartition();
        }

        // Send prepare messages
        for (let i = 0; i < this.participants.length; i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        
        await this.delay(1000);

        let allVotesYes = true;
        let participantResponses = 0;
        
        for (let i = 0; i < this.participants.length; i++) {
            if (this.failureMode === 'participant_phase1' && i === 1) {
                this.log(`Participant ${i + 1} fails before voting.`, 'error');
                this.participants[i].classList.add('failed');
                allVotesYes = false;
                await this.sendMessage(this.participants[i], this.coordinator, 'FAIL');
                continue;
            }
            
            const vote = (Math.random() > 0.15) ? 'YES' : 'NO';
            await this.sendMessage(this.participants[i], this.coordinator, `VOTE_${vote}`);
            this.participants[i].classList.add(vote === 'YES' ? 'voted-yes' : 'voted-no');
            if (vote === 'NO') allVotesYes = false;
            participantResponses++;
        }

        this.coordinator.classList.remove('active');
        if (allVotesYes && participantResponses === this.participants.length) {
            this.log('All participants voted YES.', 'success');
            this.currentPhase = 'prepare_commit';
        } else {
            this.log('A participant voted NO or failed.', 'warning');
            this.currentPhase = 'prepare_abort';
        }
    }

    async createTimeout() {
        this.log('Transaction timeout scenario initiated', 'warning');
        for (let i = 0; i < Math.floor(this.participants.length / 2); i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        this.log('Transaction timed out waiting for all responses', 'error');
        this.currentPhase = 'aborted';
        this.showFailureOverlay();
        throw new Error('Transaction timeout');
    }

    async createManualTimeout() {
        this.log('Manual timeout scenario: Only partial participants receive PREPARE', 'warning');
        const reachableParticipants = Math.floor(this.participants.length / 2);
        
        for (let i = 0; i < reachableParticipants; i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        
        // Mark unreachable participants
        for (let i = reachableParticipants; i < this.participants.length; i++) {
            this.participants[i].classList.add('failed');
            this.log(`Participant ${i + 1} unreachable due to timeout`, 'error');
        }
        
        this.log('Transaction timeout - some participants unreachable', 'error');
        this.showFailureOverlay();
        this.stats.failures++;
        this.completeManualTransaction(false);
        throw new Error('Manual timeout');
    }

    async createManualNetworkPartition() {
        this.log('Network partition scenario: Network split isolates some nodes', 'warning');
        const partitionPoint = Math.ceil(this.participants.length / 2);
        
        // Send PREPARE to only the first partition
        for (let i = 0; i < partitionPoint; i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        
        // Mark partitioned participants as unreachable
        for (let i = partitionPoint; i < this.participants.length; i++) {
            this.participants[i].classList.add('failed');
            this.log(`Participant ${i + 1} isolated by network partition`, 'error');
        }
        
        this.log('Network partition detected - some participants isolated', 'error');
        this.showFailureOverlay();
        this.stats.failures++;
        this.completeManualTransaction(false);
        throw new Error('Network partition');
    }

    async createNetworkPartition() {
        this.log('Network partition scenario initiated', 'warning');
        const partitionPoint = Math.ceil(this.participants.length / 2);
        
        // Send PREPARE to only the first partition
        for (let i = 0; i < partitionPoint; i++) {
            await this.sendMessage(this.coordinator, this.participants[i], 'PREPARE');
        }
        
        // Mark partitioned participants as unreachable
        for (let i = partitionPoint; i < this.participants.length; i++) {
            this.participants[i].classList.add('failed');
        }
        
        this.log('Network partition detected - transaction cannot proceed', 'error');
        this.currentPhase = 'aborted';
        this.showFailureOverlay();
        throw new Error('Network partition');
    }

    async executePhase2() {
        this.updatePhaseIndicator();
        this.coordinator.classList.add('active');
        this.coordinatorState = 'broadcasting-decision';
        this.updateProcessStateUI();
        
        const decision = this.currentPhase === 'prepare_commit' ? 'COMMIT' : 'ABORT';
        this.log(`Phase 2: Broadcasting ${decision} decision`, 'info');
        await this.delay(500);
        
        if (this.failureMode === 'coordinator_phase2') {
            this.log('Coordinator fails before broadcasting decision', 'error');
            this.coordinator.classList.add('failed');
            this.coordinatorState = 'failed';
            this.updateProcessStateUI();
            this.showFailureOverlay();
            throw new Error('Coordinator failed in Phase 2');
        }
        
        // Send decision
        for (let i = 0; i < this.participants.length; i++) {
            if (!this.participants[i].classList.contains('failed')) {
                await this.sendMessage(this.coordinator, this.participants[i], decision);
            }
        }
        
        await this.delay(1000);

        // Process acknowledgments
        for (let i = 0; i < this.participants.length; i++) {
            if (this.participants[i].classList.contains('failed')) continue;
            
            if (this.failureMode === 'participant_phase2' && i === 1) {
                this.log(`Participant ${i + 1} fails during commit phase`, 'error');
                this.participants[i].classList.add('failed');
                this.participants[i].dataset.status = 'failed';
                this.participantStates[i].status = 'failed';
                this.updateProcessStateUI();
                continue;
            }
            
            await this.sendMessage(this.participants[i], this.coordinator, `${decision}_ACK`);
            this.participants[i].classList.add(decision === 'COMMIT' ? 'committed' : 'aborted');
            this.participants[i].dataset.status = decision === 'COMMIT' ? 'committed' : 'aborted';
            this.participantStates[i].status = decision === 'COMMIT' ? 'committed' : 'aborted';
            this.updateProcessStateUI();
        }
        
        this.coordinator.classList.remove('active');
        this.coordinatorState = 'finalizing';
        this.updateProcessStateUI();
    }

    // UTILITY FUNCTIONS
    async sendMessage(from, to, message) {
        return new Promise((resolve) => {
            const fromRect = from.getBoundingClientRect();
            const toRect = to.getBoundingClientRect();
            const simulationRect = this.simulationArea.getBoundingClientRect();

            const startX = fromRect.left + fromRect.width / 2 - simulationRect.left;
            const startY = fromRect.top + fromRect.height / 2 - simulationRect.top;
            const endX = toRect.left + toRect.width / 2 - simulationRect.left;
            const endY = toRect.top + toRect.height / 2 - simulationRect.top;

            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            messageEl.textContent = message;
            this.simulationArea.appendChild(messageEl);

            const keyframes = [
                { top: `${startY}px`, left: `${startX}px`, opacity: 1, transform: 'scale(0.8)' },
                { top: `${endY}px`, left: `${endX}px`, opacity: 1, transform: 'scale(1)' },
            ];
            const timing = { duration: 1000 / this.animationSpeed, easing: 'ease-in-out' };
            
            messageEl.animate(keyframes, timing);

            setTimeout(() => {
                if (messageEl.parentElement) {
                    messageEl.parentElement.removeChild(messageEl);
                }
                resolve();
            }, 1000 / this.animationSpeed);
        });
    }

    resetParticipantStates() {
        this.participants.forEach((participant, i) => {
            participant.className = 'participant';
            participant.dataset.status = 'ready';
            if (this.participantStates[i]) {
                this.participantStates[i].status = 'ready';
                this.participantStates[i].state = 'idle';
            }
        });
        this.coordinator.className = 'coordinator';
        this.coordinatorState = 'idle';
        this.updateProcessStateUI();
    }

    updatePhaseIndicator() {
        const phaseText = {
            'ready': 'Ready',
            'phase1': 'Phase 1: Prepare',
            'prepare_commit': 'Phase 2: Commit',
            'prepare_abort': 'Phase 2: Abort',
            'committed': 'Committed',
            'aborted': 'Aborted'
        };
        this.phaseIndicator.textContent = phaseText[this.currentPhase] || this.currentPhase;
    }

    showFailureOverlay() {
        this.failureOverlay.classList.add('active');
    }

    hideFailureOverlay() {
        this.failureOverlay.classList.remove('active');
    }

    log(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        if (this.logContainer.children.length > 100) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }

    updateStats() {
        document.getElementById('successCount').textContent = this.stats.successful;
        document.getElementById('abortCount').textContent = this.stats.aborted;
        document.getElementById('failureCount').textContent = this.stats.failures;
        document.getElementById('totalTransactions').textContent = this.stats.total;
    }

    resetSimulation(isSoftReset = false) {
        this.isRunning = false;
        
        this.manualStep = 0;
        this.nextStepBtn.textContent = '➡️ Next Step';
        this.nextStepBtn.disabled = false;
        
        this.runAutoBtn.textContent = '▶️ Run Simulation';
        this.runAutoBtn.disabled = false;

        if (!isSoftReset) {
            this.stats = { successful: 0, aborted: 0, failures: 0, total: 0 };
            this.logContainer.innerHTML = '<div class="log-entry info">[System] Simulation reset</div>';
        }
        this.updateStats();
        
        this.currentPhase = 'ready';
        this.updatePhaseIndicator();
        this.resetParticipantStates();
        this.coordinator.classList.remove('active', 'failed');
        this.hideFailureOverlay();
        
        this.log('Simulation reset - ready for new transaction', 'info');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms / this.animationSpeed));
    }
}

function checkOrientation() {
    const overlay = document.querySelector('.rotate-device-overlay');
    if (window.innerWidth <= 768 && window.innerHeight > window.innerWidth) {
        overlay.style.display = 'flex';
        document.querySelector('.app-container').style.display = 'none';
    } else {
        overlay.style.display = 'none';
        document.querySelector('.app-container').style.display = 'grid';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TwoPhaseCommitSimulation();
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
        setTimeout(checkOrientation, 100);
    });
});
