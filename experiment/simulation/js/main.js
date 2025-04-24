////////////////////////////////////////////////////////////////////////////////
// Two-Phase Commit Simulator (app.js)
////////////////////////////////////////////////////////////////////////////////

// Canvas & Rendering Context
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
let lastTimestamp = 0;

// Simulation Parameters
let voteTimeout = 5000;
let decisionTimeout = 5000;
let clockSpeed = 1;

// Scenario Parameters
let currentScenario = 0;
let scenarioGoal = '';
let scenarioAllowed = '';
let scenarioTask = '';
let scenarioSuccess = '';
const scenarios = [
  {participantToggle: Infinity, coordinatorToggle: Infinity, linkToggle: Infinity},
  {participantToggle: 1, coordinatorToggle: 0, linkToggle: 0},
  {participantToggle: 0, coordinatorToggle: 0, linkToggle: 1},
  // {participantToggle: 0, coordinatorToggle: 1, linkToggle: 0},
];
let scenarioState = {
  participantToggle: 0,
  coordinatorToggle: 0,
  linkToggle: 0,
};

// Data Structures
class Node {
  constructor(id, x, y, isCoordinator = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.isCoordinator = isCoordinator;
    this.state = 'INIT'; // INIT, WAIT_VOTES, READY, COMMIT, ABORT, DONE_COMMIT, DONE_ABORT
    this.log = [];
    this.failed = false;
    this.pendingTimeout = null;
    this.votes = null;
  }
  draw(ctx) {
    // Node circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, 30, 0, 2*Math.PI);
    ctx.fillStyle = this.failed ? '#888' : (this.isCoordinator ? '#f0a' : '#0af');
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.stroke();
    // Node label
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.id, this.x, this.y+5);
    // State
    ctx.font = '12px Arial';
    ctx.fillText(this.state, this.x, this.y+45);
    ctx.restore();
  }
  logEntry(entry) {
    this.log.push(entry);
    Simulation.addLog(`${this.id}: ${entry}`);
  }
  fail() {
    this.failed = true;
    Simulation.addLog(`${this.id} crashed.`);
    clearTimeout(this.pendingTimeout);
  }
  recover() {
    this.failed = false;
    // on recovery, re-execute based on last log
    Simulation.addLog(`${this.id} recovered.`);
    if (!this.isCoordinator && this.state === 'READY') {
      // query coordinator for decision
      Simulation.sendMessage(this, Simulation.coordinator, { type: 'QUERY_DECISION' });
    }
    if (this.isCoordinator && this.state === 'WAIT_VOTES') {
      // re-broadcast prepare message
      this.logEntry('PREPARE');
      Simulation.nodes.forEach(n => { if (n !== this) Simulation.sendMessage(this, n, { type: 'PREPARE' }); });
      this.pendingTimeout = setTimeout(() => Simulation.checkVotes(), voteTimeout);
    }
    if (this.isCoordinator && this.state.startsWith('DECIDED')) {
      // re-broadcast decision
      Simulation.broadcastDecision();
    }
  }
}

class Link {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.up = true;
    this.latency = 2500; // ms
  }
  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.a.x, this.a.y);
    ctx.lineTo(this.b.x, this.b.y);
    ctx.strokeStyle = this.up ? '#666' : '#f00';
    ctx.lineWidth = this.up ? 2 : 4;
    ctx.setLineDash(this.up ? [] : [10, 5]);
    ctx.stroke();
    ctx.restore();
  }
  send(msg) {
    if (!this.up) return;
    const travel = this.latency;
    msg.startTime = Simulation.time;
    msg.arrivalTime = Simulation.time + travel / clockSpeed;
    msg.viaLink = this;
    Simulation.messages.push(msg);
  }
}

class Message {
  constructor(src, dst, type) {
    this.src = src;
    this.dst = dst;
    this.type = type;
    this.startTime = 0;
    this.arrivalTime = 0;
    this.viaLink = null;
    this.handled = false;
  }
  draw(ctx) {
    const progress = Math.min((Simulation.time - this.startTime) * clockSpeed / (this.arrivalTime - this.startTime), 1);
    const x = this.src.x + (this.dst.x - this.src.x) * progress;
    const y = this.src.y + (this.dst.y - this.src.y) * progress;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2*Math.PI);
    ctx.fillStyle = '#ff0';
    ctx.fill();
    ctx.strokeStyle = '#333'; ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.type, x, y-10);
    // ctx.fillText(this.src.id, x, y+10);
    // ctx.fillText(this.dst.id, x, y+20);
    ctx.restore();
  }
}

// Main Simulation Controller
const Simulation = {
  nodes: [],
  links: [],
  messages: [],
  coordinator: null,
  time: 0,

  init() {
    scenarioSuccess = '';
    scenarioState = Object.assign({}, scenarios[currentScenario]);
      // Clear previous simulation (including timeouts)
    this.nodes.forEach(n => clearTimeout(n.pendingTimeout));
    // Setup new simulation
    this.nodes = [];
    this.links = [];
    this.messages = [];
    this.time = 0;
    // Create nodes in pentagon layout
    const center = { x: canvas.width/2, y: canvas.height/2 };
    const radius = 200;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI*2/5)*i - Math.PI/2;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      const id = i===0 ? 'C' : `P${i}`;
      const isCoord = i===0;
      const node = new Node(id, x, y, isCoord);
      this.nodes.push(node);
      if (isCoord) this.coordinator = node;
    }
    // Create full mesh links
    for (let i=0; i<this.nodes.length; i++) {
      for (let j=i+1; j<this.nodes.length; j++) {
        this.links.push(new Link(this.nodes[i], this.nodes[j]));
      }
    }
    this.updateStatePanel();
    this.clearLog();
  },

  addLog(msg) {
    const out = document.getElementById('log-output');
    out.textContent += `$ ${msg}\n`;  // `[${Math.floor(this.time)}] ${msg}\n`;
    out.scrollTop = out.scrollHeight;
    this.updateStatePanel();
  },
  clearLog() {
    document.getElementById('log-output').textContent = '';
  },

  updateStatePanel() {
    const panel = document.getElementById('state-panel');
    panel.innerHTML = '';
    this.nodes.forEach(n => {
      const div = document.createElement('div');
      div.className = 'node-state';
      div.innerHTML = `<span>${n.id}</span><span>${n.state}</span>`;
      panel.appendChild(div);
    });
  },

  findLink(a,b) {
    return this.links.find(l => (l.a===a && l.b===b) || (l.a===b && l.b===a));
  },

  sendMessage(src, dst, {type}) {
    const link = this.findLink(src, dst);
    if (!link) return;
    const msg = new Message(src, dst, type);
    link.send(msg);
    this.addLog(`Msg ${type} from ${src.id} to ${dst.id}`);
  },

  broadcastPrepare() {
    this.coordinator.state = 'WAIT_VOTES';
    this.coordinator.votes = new Set();
    this.coordinator.logEntry('PREPARE');
    this.nodes.forEach(n => {
      if (n !== this.coordinator) this.sendMessage(this.coordinator, n, {type:'PREPARE'});
    });
    // start vote timeout
    this.coordinator.pendingTimeout = setTimeout(() => this.checkVotes(), voteTimeout);
  },

  checkVotes() {
    // collect votes
    const numVotes = this.coordinator.votes? this.coordinator.votes.size : 0;
    this.makeDecision(numVotes === this.nodes.length-1 ? 'GLOBAL_COMMIT' : 'GLOBAL_ABORT');
  },

  makeDecision(type) {
    let decision = type.replace('GLOBAL_','');
    if (this.coordinator.failed) return;
    this.coordinator.state = `DECIDED_${decision}`;
    this.coordinator.logEntry(decision);
    this.coordinator.decision = type;
    this.broadcastDecision();
  },

  broadcastDecision() {
    this.nodes.forEach(n => {
      if (n !== this.coordinator) this.sendMessage(this.coordinator, n, {type:this.coordinator.decision});
    });
    // start ACK timeout
    this.coordinator.pendingTimeout = setTimeout(() => this.finishTransaction(), decisionTimeout);
  },

  finishTransaction() {
    if (currentScenario > 0) {
      let s = scenarioState;
      scenarioSuccess = this.coordinator.decision === 'GLOBAL_ABORT' && s.coordinatorToggle >= 0 && s.participantToggle >= 0 && s.linkToggle >= 0? 'yes' : 'no';
      if (scenarioSuccess === 'yes') {
        let sc = document.getElementById('scenario');
        if (sc[currentScenario+1] != null) sc[currentScenario+1].removeAttribute('disabled');
      }
    }
    if (this.coordinator.failed) return;
    let transaction = this.coordinator.decision.replace('GLOBAL_','');
    this.addLog(`Transaction ${transaction} complete.`);
    this.coordinator.state = `DONE_${transaction}`;
    this.updateStatePanel();
    this.draw();
  },

  update(delta) {
    this.time += delta * clockSpeed;
    // deliver messages
    this.messages.forEach(msg => {
      if (!msg.handled && this.time >= msg.arrivalTime) {
        msg.handled = true;
        this.deliver(msg);
      }
    });
    this.messages = this.messages.filter(m => !m.handled);
  },

  deliver(msg) {
    const dst = msg.dst;
    if (dst.failed) return;
    switch(msg.type) {
      case 'PREPARE':
        dst.state = 'READY';
        dst.logEntry('READY');
        this.sendMessage(dst, this.coordinator, {type:'VOTE_COMMIT'});
        break;
      case 'VOTE_COMMIT':
      case 'VOTE_ABORT':
        if (dst !== this.coordinator) break;
        if (msg.type==='VOTE_COMMIT') this.coordinator.votes.add(msg.src.id);
        this.addLog(`Coordinator received ${msg.type} from ${msg.src.id}`);
        if (this.coordinator.votes.size === this.nodes.length-1) {
          clearTimeout(this.coordinator.pendingTimeout);
          this.coordinator.pendingTimeout = null;
          this.addLog(`All votes received. Proceeding to decision.`);
          this.checkVotes();
        }
        break;
      case 'GLOBAL_COMMIT':
        dst.state = 'COMMIT';
        dst.logEntry('COMMIT');
        this.sendMessage(dst, this.coordinator, {type:'ACK_COMMIT'});
        break;
      case 'GLOBAL_ABORT':
        dst.state = 'ABORT';
        dst.logEntry('ABORT');
        this.sendMessage(dst, this.coordinator, {type:'ACK_ABORT'});
        break;
      case 'ACK_COMMIT':
      case 'ACK_ABORT':
        // coordinator may track if needed
        break;
      case 'QUERY_DECISION':
        // participant asking after failure
        this.sendMessage(this.coordinator, msg.src, {type: this.coordinator.decision});
        break;
    }
  },

  draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    this.links.forEach(l => l.draw(ctx));
    this.nodes.forEach(n => n.draw(ctx));
    this.messages.forEach(m => m.draw(ctx));
    if (currentScenario===0) return;
    // draw scenario state
    let s = scenarioState;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    if (scenarioSuccess === 'yes') ctx.fillText('Scenario passed!', canvas.width/2, 30);
    else if (scenarioSuccess === 'no') ctx.fillText('Scenario failed!', canvas.width/2, 30);
    else ctx.fillText(`${s.coordinatorToggle} coordinator, ${s.participantToggle} participant, and ${s.linkToggle} link toggles remaining`, canvas.width/2, 30);
    ctx.restore();
  },

  loop(ts) {
    const delta = ts - lastTimestamp;
    lastTimestamp = ts;
    this.update(delta);
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }
};

// UI Event Handlers
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // check nodes
  Simulation.nodes.forEach(n=>{
    const dx = mx-n.x, dy = my-n.y;
    if (dx*dx+dy*dy < 30*30) {
      if (n.isCoordinator) scenarioState.coordinatorToggle--;
      else scenarioState.participantToggle--;
      if (n.failed) n.recover();
      else n.fail();
    }
  });
  // check links
  Simulation.links.forEach(l=>{
    // simple midpoint hit test
    const mxid = (l.a.x+l.b.x)/2;
    const myid = (l.a.y+l.b.y)/2;
    const dx = mx-mxid, dy = my-myid;
    if (dx*dx+dy*dy >= 20*20) return;
    // toggle link state
    l.up = !l.up;
    Simulation.addLog(`Link ${l.a.id}↔${l.b.id} ${l.up? 'up' : 'down'}`);
    scenarioState.linkToggle--;
    if (l.up) {
      let hasCoordinator = l.a.isCoordinator || l.b.isCoordinator;
      let p = l.a.isCoordinator? l.b : l.a;
      if (!hasCoordinator || p.state!=='READY' || p.failed) return;
      Simulation.sendMessage(p, Simulation.coordinator, {type:'QUERY_DECISION'});
    }
    else Simulation.messages.forEach(m => {
      if (m.viaLink !== l) return;
      m.handled = true;  // drop message
      Simulation.addLog(`Dropped ${m.type} from ${m.src.id}→${m.dst.id}`);
    });
  });
});

document.getElementById('startBtn').addEventListener('click', () => {
  Simulation.init();
  Simulation.broadcastPrepare();
});
document.getElementById('resetBtn').addEventListener('click', () => {
  Simulation.init();
});

// Sliders & selects
const vt = document.getElementById('voteTimeout');
vt.addEventListener('input', ()=>{
  voteTimeout = +vt.value;
  document.getElementById('voteTimeoutVal').textContent = vt.value;
});
const dt = document.getElementById('decisionTimeout');
dt.addEventListener('input', ()=>{
  decisionTimeout = +dt.value;
  document.getElementById('decisionTimeoutVal').textContent = dt.value;
});
const sc = document.getElementById('scenario');
sc.addEventListener('change', ()=>{
  currentScenario = +sc.value;
  const o = sc.options[currentScenario];
  scenarioGoal    = o.getAttribute('data-goal');
  scenarioAllowed = o.getAttribute('data-allowed');
  scenarioTask    = o.getAttribute('data-task');
  document.getElementById('scenario-goal').textContent    = scenarioGoal;
  document.getElementById('scenario-allowed').textContent = scenarioAllowed;
  document.getElementById('scenario-task').textContent    = scenarioTask;
  Simulation.init();
});
// const cs = document.getElementById('clockSpeed');
// cs.addEventListener('change', ()=>{
  // clockSpeed = +cs.value;
// });

// Initialization
Simulation.init();
requestAnimationFrame(Simulation.loop.bind(Simulation));
