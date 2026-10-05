/**
 * Sea Battle - Futuristic Naval Warfare Web App
 * Modeled after Tic-Tac-Toe architecture & Supabase Realtime multiplayer
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // AUDIO ENGINE (Web Audio API Synthesizer)
    // ==========================================
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.isMuted = localStorage.getItem('sea_battle_muted') === 'true';
        }

        initContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        }

        toggleMute() {
            this.isMuted = !this.isMuted;
            localStorage.setItem('sea_battle_muted', this.isMuted);
            return this.isMuted;
        }

        play(type) {
            if (this.isMuted) return;
            try {
                this.initContext();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                switch (type) {
                    case 'shot': {
                        // Cannon launch: quick noise burst + descending pitch
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(280, now);
                        osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
                        gain.gain.setValueAtTime(0.18, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.18);
                        break;
                    }

                    case 'miss': {
                        // Splash in water: subtle high-pitch tone + white splash
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(440, now);
                        osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);
                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.22);
                        break;
                    }

                    case 'hit': {
                        // Explosive crunch
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'square';
                        osc.frequency.setValueAtTime(140, now);
                        osc.frequency.exponentialRampToValueAtTime(35, now + 0.25);
                        gain.gain.setValueAtTime(0.25, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.25);
                        break;
                    }

                    case 'sunk': {
                        // Dramatic double explosion + naval horn
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(110, now);
                        osc.frequency.setValueAtTime(80, now + 0.18);
                        gain.gain.setValueAtTime(0.3, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.55);
                        break;
                    }

                    case 'place': {
                        // Soft click
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(600, now);
                        osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.05);
                        break;
                    }

                    case 'win': {
                        // Triumphant chord
                        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'triangle';
                            osc.frequency.setValueAtTime(freq, now + i * 0.08);
                            gain.gain.setValueAtTime(0.15, now + i * 0.08);
                            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.35);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + i * 0.08);
                            osc.stop(now + i * 0.08 + 0.35);
                        });
                        break;
                    }

                    case 'lose': {
                        // Descending defeat chord
                        [440, 392, 349.23, 261.63].forEach((freq, i) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, now + i * 0.12);
                            gain.gain.setValueAtTime(0.14, now + i * 0.12);
                            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + i * 0.12);
                            osc.stop(now + i * 0.12 + 0.4);
                        });
                        break;
                    }
                }
            } catch (e) {
                // AudioContext restrictions fallback
            }
        }
    }

    const sound = new SoundEngine();

    // ==========================================
    // CONSTANTS & FLEET RULES
    // ==========================================
    const GRID_SIZE = 10;
    const TOTAL_CELLS = 100;

    const FLEET_DEFINITIONS = [
        { type: 'battleship', size: 4, count: 1, name: 'Battleship' },
        { type: 'cruiser',    size: 3, count: 2, name: 'Cruiser' },
        { type: 'destroyer',  size: 2, count: 3, name: 'Destroyer' },
        { type: 'torpedo',    size: 1, count: 4, name: 'Patrol Boat' }
    ];

    function indexToCoords(idx) {
        return { x: idx % GRID_SIZE, y: Math.floor(idx / GRID_SIZE) };
    }

    function coordsToIndex(x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return -1;
        return y * GRID_SIZE + x;
    }

    // ==========================================
    // BOARD LOGIC CLASS
    // ==========================================
    class BattleshipBoard {
        constructor() {
            this.clear();
        }

        clear() {
            this.ships = []; // [{ id, type, size, cells: [], hits: [], isSunk: false }]
            this.grid = Array(TOTAL_CELLS).fill(null); // stores shipId or null
            this.shots = Array(TOTAL_CELLS).fill(null); // 'miss', 'hit', 'sunk', or null
            this.lastShotIndex = null;
        }

        canPlaceShip(size, startIndex, isHorizontal, ignoreShipId = null) {
            const { x, y } = indexToCoords(startIndex);

            // Boundary checks
            if (isHorizontal) {
                if (x + size > GRID_SIZE) return false;
            } else {
                if (y + size > GRID_SIZE) return false;
            }

            const targetIndices = [];
            for (let i = 0; i < size; i++) {
                const cx = isHorizontal ? x + i : x;
                const cy = isHorizontal ? y : y + i;
                targetIndices.push(coordsToIndex(cx, cy));
            }

            // Proximity & collision checks (including diagonals)
            for (const idx of targetIndices) {
                const { x: cx, y: cy } = indexToCoords(idx);

                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                            const neighborIdx = coordsToIndex(nx, ny);
                            const neighborShipId = this.grid[neighborIdx];
                            if (neighborShipId !== null && neighborShipId !== ignoreShipId) {
                                return false;
                            }
                        }
                    }
                }
            }

            return true;
        }

        placeShip(type, size, startIndex, isHorizontal) {
            if (!this.canPlaceShip(size, startIndex, isHorizontal)) return null;

            const shipId = `ship-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const { x, y } = indexToCoords(startIndex);
            const cells = [];

            for (let i = 0; i < size; i++) {
                const cx = isHorizontal ? x + i : x;
                const cy = isHorizontal ? y : y + i;
                const idx = coordsToIndex(cx, cy);
                cells.push(idx);
                this.grid[idx] = shipId;
            }

            const ship = {
                id: shipId,
                type,
                size,
                isHorizontal,
                cells,
                hits: [],
                isSunk: false
            };

            this.ships.push(ship);
            return ship;
        }

        removeShip(shipId) {
            const index = this.ships.findIndex(s => s.id === shipId);
            if (index === -1) return false;

            const ship = this.ships[index];
            ship.cells.forEach(idx => {
                this.grid[idx] = null;
            });
            this.ships.splice(index, 1);
            return true;
        }

        randomize() {
            this.clear();
            const shipQueue = [];
            FLEET_DEFINITIONS.forEach(def => {
                for (let i = 0; i < def.count; i++) {
                    shipQueue.push({ type: def.type, size: def.size });
                }
            });

            // Sort larger ships first for higher placement probability
            shipQueue.sort((a, b) => b.size - a.size);

            for (const shipDef of shipQueue) {
                let placed = false;
                let attempts = 0;
                while (!placed && attempts < 500) {
                    attempts++;
                    const isHorizontal = Math.random() < 0.5;
                    const startIndex = Math.floor(Math.random() * TOTAL_CELLS);
                    if (this.canPlaceShip(shipDef.size, startIndex, isHorizontal)) {
                        this.placeShip(shipDef.type, shipDef.size, startIndex, isHorizontal);
                        placed = true;
                    }
                }
                if (!placed) {
                    // Retry if unlucky
                    return this.randomize();
                }
            }
            return true;
        }

        isFleetReady() {
            return this.ships.length === 10;
        }

        getShipSurroundingHalo(ship) {
            const halo = new Set();
            for (const cellIdx of ship.cells) {
                const { x, y } = indexToCoords(cellIdx);
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                            const neighborIdx = coordsToIndex(nx, ny);
                            if (!ship.cells.includes(neighborIdx)) {
                                halo.add(neighborIdx);
                            }
                        }
                    }
                }
            }
            return Array.from(halo);
        }

        receiveShot(index) {
            if (index < 0 || index >= TOTAL_CELLS || this.shots[index] !== null) {
                return null; // Already shot or invalid
            }

            this.lastShotIndex = index;
            const shipId = this.grid[index];

            if (shipId === null) {
                this.shots[index] = 'miss';
                return { result: 'miss', index, allSunk: false };
            }

            const ship = this.ships.find(s => s.id === shipId);
            if (!ship) return null;

            ship.hits.push(index);

            if (ship.hits.length >= ship.size) {
                // Ship is sunk!
                ship.isSunk = true;
                ship.cells.forEach(idx => {
                    this.shots[idx] = 'sunk';
                });

                // Auto-mark halo
                const halo = this.getShipSurroundingHalo(ship);
                halo.forEach(hIdx => {
                    if (this.shots[hIdx] === null) {
                        this.shots[hIdx] = 'miss';
                    }
                });

                const allSunk = this.ships.every(s => s.isSunk);
                return { result: 'sunk', index, ship, halo, allSunk };
            } else {
                this.shots[index] = 'hit';
                return { result: 'hit', index, ship, allSunk: false };
            }
        }
    }

    // ==========================================
    // TACTICAL AI (Hunt & Target Engine)
    // ==========================================
    class BattleshipAI {
        constructor() {
            this.reset();
        }

        reset() {
            this.board = new BattleshipBoard();
            this.board.randomize();
            this.shotsFired = new Set();
            this.hits = [];
            this.currentShipHits = [];
            this.targetQueue = [];
        }

        getNextShot() {
            let target = null;

            // Target Mode: finish damaged ship
            while (this.targetQueue.length > 0) {
                const candidate = this.targetQueue.shift();
                if (!this.shotsFired.has(candidate)) {
                    target = candidate;
                    break;
                }
            }

            // Hunt Mode: checkerboard parity search
            if (target === null) {
                const candidates = [];
                for (let i = 0; i < TOTAL_CELLS; i++) {
                    if (!this.shotsFired.has(i)) {
                        const { x, y } = indexToCoords(i);
                        // Parity filter
                        if ((x + y) % 2 === 0) {
                            candidates.push(i);
                        }
                    }
                }

                // If parity candidates exhausted, check remaining cells
                if (candidates.length > 0) {
                    target = candidates[Math.floor(Math.random() * candidates.length)];
                } else {
                    const fallback = [];
                    for (let i = 0; i < TOTAL_CELLS; i++) {
                        if (!this.shotsFired.has(i)) fallback.push(i);
                    }
                    if (fallback.length > 0) {
                        target = fallback[Math.floor(Math.random() * fallback.length)];
                    }
                }
            }

            if (target !== null) {
                this.shotsFired.add(target);
            }
            return target;
        }

        registerShotResult(index, result, halo = []) {
            if (result === 'hit') {
                this.hits.push(index);
                this.currentShipHits.push(index);

                if (this.currentShipHits.length === 1) {
                    // First hit: add 4 orthogonal neighbors
                    const { x, y } = indexToCoords(index);
                    const neighbors = [
                        coordsToIndex(x + 1, y),
                        coordsToIndex(x - 1, y),
                        coordsToIndex(x, y + 1),
                        coordsToIndex(x, y - 1)
                    ];
                    neighbors.forEach(n => {
                        if (n !== -1 && !this.shotsFired.has(n) && !this.targetQueue.includes(n)) {
                            this.targetQueue.unshift(n);
                        }
                    });
                } else {
                    // Multiple hits: determine orientation and extend only along the line!
                    const sortedHits = [...this.currentShipHits].sort((a, b) => a - b);
                    const first = indexToCoords(sortedHits[0]);
                    const second = indexToCoords(sortedHits[1]);
                    const isHorizontal = first.y === second.y;

                    // Filter existing queue to orientation
                    this.targetQueue = this.targetQueue.filter(idx => {
                        const c = indexToCoords(idx);
                        return isHorizontal ? c.y === first.y : c.x === first.x;
                    });

                    // Add line extensions
                    if (isHorizontal) {
                        const minX = Math.min(...sortedHits.map(idx => indexToCoords(idx).x));
                        const maxX = Math.max(...sortedHits.map(idx => indexToCoords(idx).x));
                        const left = coordsToIndex(minX - 1, first.y);
                        const right = coordsToIndex(maxX + 1, first.y);
                        if (left !== -1 && !this.shotsFired.has(left)) this.targetQueue.unshift(left);
                        if (right !== -1 && !this.shotsFired.has(right)) this.targetQueue.unshift(right);
                    } else {
                        const minY = Math.min(...sortedHits.map(idx => indexToCoords(idx).y));
                        const maxY = Math.max(...sortedHits.map(idx => indexToCoords(idx).y));
                        const top = coordsToIndex(first.x, minY - 1);
                        const bottom = coordsToIndex(first.x, maxY + 1);
                        if (top !== -1 && !this.shotsFired.has(top)) this.targetQueue.unshift(top);
                        if (bottom !== -1 && !this.shotsFired.has(bottom)) this.targetQueue.unshift(bottom);
                    }
                }
            } else if (result === 'sunk') {
                // Add halo cells to shotsFired so AI won't waste turns on them
                halo.forEach(hIdx => this.shotsFired.add(hIdx));
                this.currentShipHits = [];
                this.targetQueue = [];
            }
        }
    }

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    // Screens
    const screenMenu = document.getElementById('screen-menu');
    const screenOnlineLobby = document.getElementById('screen-online-lobby');
    const screenWaiting = document.getElementById('screen-waiting');
    const screenPlacement = document.getElementById('screen-placement');
    const screenBattle = document.getElementById('screen-battle');

    // Modals
    const modalGameOver = document.getElementById('modal-gameover');
    const modalGameOverTitle = document.getElementById('modal-gameover-title');
    const modalGameOverDesc = document.getElementById('modal-gameover-desc');
    const statShots = document.getElementById('stat-shots');
    const statHits = document.getElementById('stat-hits');
    const statAccuracy = document.getElementById('stat-accuracy');
    const statRounds = document.getElementById('stat-rounds');
    const btnGameOverRematch = document.getElementById('btn-gameover-rematch');
    const btnGameOverRematchText = document.getElementById('btn-gameover-rematch-text');
    const btnGameOverMenu = document.getElementById('btn-gameover-menu');

    const modalRules = document.getElementById('modal-rules');
    const btnCloseRules = document.getElementById('btn-close-rules');
    const btnRulesToggle = document.getElementById('btn-rules-toggle');

    // Header buttons
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const soundIconOn = document.getElementById('sound-icon-on');
    const soundIconOff = document.getElementById('sound-icon-off');

    // Menu Buttons
    const btnModeAi = document.getElementById('btn-mode-ai');
    const btnModeOnline = document.getElementById('btn-mode-online');
    const backToMenuBtns = document.querySelectorAll('.btn-to-menu');

    // Online Lobby & Waiting
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const inputRoomCode = document.getElementById('input-room-code');
    const networkStatusBadge = document.getElementById('network-status-badge');
    const networkStatusText = document.getElementById('network-status-text');
    const displayRoomCode = document.getElementById('display-room-code');
    const btnCopyCode = document.getElementById('btn-copy-code');
    const btnCopyLink = document.getElementById('btn-copy-link');

    // Placement Screen
    const placementGridEl = document.getElementById('placement-grid');
    const shipsInventoryEl = document.getElementById('ships-inventory');
    const placementPlayerTag = document.getElementById('placement-player-tag');
    const placementCountEl = document.getElementById('placement-count');
    const dockOrientationLabel = document.getElementById('dock-orientation-label');
    const btnRotateShip = document.getElementById('btn-rotate-ship');
    const btnRandomPlacement = document.getElementById('btn-random-placement');
    const btnClearPlacement = document.getElementById('btn-clear-placement');
    const btnReadyBattle = document.getElementById('btn-ready-battle');

    // Battle Arena Screen
    const battleModeTag = document.getElementById('battle-mode-tag');
    const turnDot = document.getElementById('turn-dot');
    const turnTitle = document.getElementById('turn-title');
    const turnSubtitle = document.getElementById('turn-subtitle');
    const btnSurrender = document.getElementById('btn-surrender');
    const myBattleGridEl = document.getElementById('my-battle-grid');
    const enemyBattleGridEl = document.getElementById('enemy-battle-grid');
    const myFleetTracker = document.getElementById('my-fleet-tracker');
    const enemyFleetTracker = document.getElementById('enemy-fleet-tracker');

    // Mobile tabs
    const tabMyFleet = document.getElementById('tab-my-fleet');
    const tabEnemyRadar = document.getElementById('tab-enemy-radar');
    const wrapperMyFleet = document.getElementById('wrapper-my-fleet');
    const wrapperEnemyRadar = document.getElementById('wrapper-enemy-radar');
    const enemyTabBadge = document.getElementById('enemy-tab-badge');

    // Online reactions & code peeker
    const reactionsBar = document.getElementById('reactions-bar');
    const emojiBtns = document.querySelectorAll('.emoji-btn');
    const hostInviteBar = document.getElementById('host-invite-bar');
    const gameRoomCodeInput = document.getElementById('game-room-code-input');
    const btnTogglePeek = document.getElementById('btn-toggle-peek');
    const btnCopyGameCode = document.getElementById('btn-copy-game-code');
    const btnShareOnline = document.getElementById('btn-share-online');
    const iconEyeClosed = document.getElementById('icon-eye-closed');
    const iconEyeOpen = document.getElementById('icon-eye-open');

    // ==========================================
    // GAME APPLICATION STATE
    // ==========================================
    let gameMode = 'ai'; // 'ai' | 'online'

    // Placement state
    let player1Board = new BattleshipBoard();
    let player2Board = new BattleshipBoard(); // Used for AI or opponent radar
    let selectedShipType = 'battleship';
    let isHorizontalPlacement = true;
    let currentHoverIndex = null;

    // Battle state
    let activePlayer = 1; // 1 or 2
    let isShootingAllowed = false;
    let battleStats = {
        shots: 0,
        hits: 0,
        rounds: 0
    };
    let aiEngine = null;

    // Online Multiplayer State
    let supabase = null;
    let roomCode = null;
    let gameChannel = null;
    let myOnlineRole = null; // 'host' or 'joiner'
    let isOnlineConnected = false;
    let onlineOpponentReady = false;
    let isCodeRevealed = false;
    let joinTimeout = null;
    let rematchRequested = { me: false, opponent: false };

    // ==========================================
    // SCREEN NAVIGATION & TOASTS
    // ==========================================
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showToast(message, type = 'normal') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'danger' ? 'toast-danger' : type === 'success' ? 'toast-success' : ''}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2600);
    }

    function showFloatingEmoji(emoji) {
        const container = document.getElementById('reaction-container');
        const el = document.createElement('div');
        el.className = 'floating-reaction';
        el.textContent = emoji;
        el.style.left = `${Math.floor(Math.random() * 60 + 20)}%`;
        el.style.bottom = '15%';
        container.appendChild(el);
        setTimeout(() => el.remove(), 2200);
    }

    // ==========================================
    // SOUND TOGGLE & MODALS
    // ==========================================
    function updateSoundUI() {
        if (sound.isMuted) {
            soundIconOn.classList.add('hidden');
            soundIconOff.classList.remove('hidden');
        } else {
            soundIconOn.classList.remove('hidden');
            soundIconOff.classList.add('hidden');
        }
    }
    updateSoundUI();

    btnSoundToggle.addEventListener('click', () => {
        sound.toggleMute();
        updateSoundUI();
        if (!sound.isMuted) sound.play('place');
    });

    btnRulesToggle.addEventListener('click', () => {
        modalRules.classList.add('active');
    });

    btnCloseRules.addEventListener('click', () => {
        modalRules.classList.remove('active');
    });

    // ==========================================
    // FLEET PLACEMENT LOGIC
    // ==========================================
    function getCurrentPlacementBoard() {
        return player1Board;
    }

    function initPlacementGrid() {
        isHorizontalPlacement = true;
        currentHoverIndex = null;
        dockOrientationLabel.textContent = 'Horizontal';
        btnRotateShip.classList.remove('is-vertical');
        const rotateTextEl = btnRotateShip.querySelector('#rotate-btn-text');
        if (rotateTextEl) rotateTextEl.textContent = 'Rotate';

        placementGridEl.innerHTML = '';
        for (let i = 0; i < TOTAL_CELLS; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;

            cell.addEventListener('mouseenter', () => onPlacementCellHover(i));
            cell.addEventListener('click', () => onPlacementCellClick(i));

            placementGridEl.appendChild(cell);
        }
        renderPlacementGrid();
        renderShipInventory();
    }

    function renderShipInventory() {
        const board = getCurrentPlacementBoard();
        shipsInventoryEl.innerHTML = '';

        FLEET_DEFINITIONS.forEach(def => {
            const placedCount = board.ships.filter(s => s.type === def.type).length;
            const remaining = def.count - placedCount;
            const isCompleted = remaining === 0;

            const item = document.createElement('div');
            item.className = `ship-item ${selectedShipType === def.type ? 'selected' : ''} ${isCompleted ? 'completed' : ''}`;
            item.dataset.type = def.type;

            const meta = document.createElement('div');
            meta.className = 'ship-meta';

            const name = document.createElement('span');
            name.className = 'ship-name';
            name.textContent = def.name;

            const visual = document.createElement('div');
            visual.className = 'ship-visual';
            for (let i = 0; i < def.size; i++) {
                const deck = document.createElement('div');
                deck.className = 'ship-deck';
                visual.appendChild(deck);
            }

            meta.appendChild(name);
            meta.appendChild(visual);

            const info = document.createElement('div');
            info.className = `ship-count ${isCompleted ? 'done' : ''}`;
            info.textContent = isCompleted ? '✓' : `×${remaining}`;

            item.appendChild(meta);
            item.appendChild(info);

            item.addEventListener('click', () => {
                if (!isCompleted) {
                    selectedShipType = def.type;
                    renderShipInventory();
                    sound.play('place');
                }
            });

            shipsInventoryEl.appendChild(item);
        });

        const totalPlaced = board.ships.length;
        placementCountEl.textContent = `${totalPlaced} / 10`;
        placementCountEl.classList.toggle('ready', totalPlaced === 10);
        btnReadyBattle.disabled = totalPlaced !== 10;

        // Auto-select next available ship type if current is completed
        const curDef = FLEET_DEFINITIONS.find(d => d.type === selectedShipType);
        const curPlaced = board.ships.filter(s => s.type === selectedShipType).length;
        if (curPlaced >= curDef.count) {
            const nextAvailable = FLEET_DEFINITIONS.find(d => board.ships.filter(s => s.type === d.type).length < d.count);
            if (nextAvailable) {
                selectedShipType = nextAvailable.type;
                renderShipInventory();
            }
        }
    }

    function renderPlacementGrid() {
        const board = getCurrentPlacementBoard();
        const cells = placementGridEl.querySelectorAll('.cell');

        cells.forEach((cell, idx) => {
            cell.className = 'cell';
            const shipId = board.grid[idx];
            if (shipId) {
                cell.classList.add('has-ship');
                cell.title = 'Click to remove ship';
            } else {
                cell.removeAttribute('title');
            }
        });
    }

    function onPlacementCellHover(startIndex) {
        currentHoverIndex = startIndex;
        clearPlacementPreviews();
        const board = getCurrentPlacementBoard();
        const shipDef = FLEET_DEFINITIONS.find(d => d.type === selectedShipType);
        if (!shipDef) return;

        const placedCount = board.ships.filter(s => s.type === shipDef.type).length;
        if (placedCount >= shipDef.count) return;

        const size = shipDef.size;
        const isValid = board.canPlaceShip(size, startIndex, isHorizontalPlacement);

        const { x, y } = indexToCoords(startIndex);
        const previewIndices = [];

        for (let i = 0; i < size; i++) {
            const cx = isHorizontalPlacement ? x + i : x;
            const cy = isHorizontalPlacement ? y : y + i;
            if (cx < GRID_SIZE && cy < GRID_SIZE) {
                previewIndices.push(coordsToIndex(cx, cy));
            }
        }

        const cells = placementGridEl.querySelectorAll('.cell');
        previewIndices.forEach(idx => {
            if (cells[idx]) {
                cells[idx].classList.add(isValid ? 'preview-valid' : 'preview-invalid');
            }
        });
    }

    function clearPlacementPreviews() {
        const cells = placementGridEl.querySelectorAll('.cell');
        cells.forEach(c => {
            c.classList.remove('preview-valid', 'preview-invalid');
        });
    }

    function onPlacementCellClick(startIndex) {
        const board = getCurrentPlacementBoard();
        const existingShipId = board.grid[startIndex];

        // If clicking on an existing placed ship, remove it back to dock
        if (existingShipId) {
            const ship = board.ships.find(s => s.id === existingShipId);
            if (ship) {
                selectedShipType = ship.type;
                board.removeShip(existingShipId);
                sound.play('place');
                renderPlacementGrid();
                renderShipInventory();
                onPlacementCellHover(startIndex);
                return;
            }
        }

        const shipDef = FLEET_DEFINITIONS.find(d => d.type === selectedShipType);
        if (!shipDef) return;

        const placedCount = board.ships.filter(s => s.type === shipDef.type).length;
        if (placedCount >= shipDef.count) {
            showToast('All ships of this type placed');
            return;
        }

        const placedShip = board.placeShip(shipDef.type, shipDef.size, startIndex, isHorizontalPlacement);
        if (placedShip) {
            sound.play('place');
            clearPlacementPreviews();
            renderPlacementGrid();
            renderShipInventory();
            if (board.isFleetReady()) {
                showToast('Fleet ready', 'success');
            } else if (currentHoverIndex !== null) {
                onPlacementCellHover(currentHoverIndex);
            }
        } else {
            sound.play('miss');
            showToast('Invalid position', 'danger');
        }
    }

    // Toggle orientation
    function toggleOrientation() {
        isHorizontalPlacement = !isHorizontalPlacement;
        dockOrientationLabel.textContent = isHorizontalPlacement ? 'Horizontal' : 'Vertical';
        btnRotateShip.classList.toggle('is-vertical', !isHorizontalPlacement);
        const rotateTextEl = btnRotateShip.querySelector('#rotate-btn-text');
        if (rotateTextEl) {
            rotateTextEl.textContent = 'Rotate';
        }
        sound.play('place');

        // Immediately update preview under cursor if hovering over grid
        if (currentHoverIndex !== null) {
            onPlacementCellHover(currentHoverIndex);
        }
    }

    // Placement grid mouse leave and right-click to rotate
    placementGridEl.addEventListener('mouseleave', () => {
        currentHoverIndex = null;
        clearPlacementPreviews();
    });

    placementGridEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleOrientation();
    });

    btnRotateShip.addEventListener('click', toggleOrientation);

    // Support both English (R) and Russian (К / KeyR) keyboard layouts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
            if (screenPlacement.classList.contains('active')) {
                e.preventDefault();
                toggleOrientation();
            }
        }
    });

    btnRandomPlacement.addEventListener('click', () => {
        const board = getCurrentPlacementBoard();
        board.randomize();
        sound.play('place');
        renderPlacementGrid();
        renderShipInventory();
        showToast('Random fleet placed');
    });

    btnClearPlacement.addEventListener('click', () => {
        const board = getCurrentPlacementBoard();
        board.clear();
        sound.play('place');
        renderPlacementGrid();
        renderShipInventory();
    });

    // ==========================================
    // BATTLE ARENA & GAMEPLAY CONTROLS
    // ==========================================
    btnReadyBattle.addEventListener('click', () => {
        if (gameMode === 'online') {
            // Send FLEET_READY over realtime channel
            sendOnlineData({ type: 'FLEET_READY' });
            btnReadyBattle.disabled = true;
            btnReadyBattle.textContent = 'Waiting for opponent...';
            showToast('Waiting for opponent...');

            if (onlineOpponentReady) {
                if (myOnlineRole === 'host') {
                    const firstTurn = Math.random() < 0.5 ? 'host' : 'joiner';
                    sendOnlineData({ type: 'START_BATTLE', firstTurn });
                    launchBattle(firstTurn === 'host' ? 1 : 2);
                }
            }
            return;
        }

        // Single player vs AI battle start
        launchBattle(1);
    });

    function launchBattle(startingPlayer = 1) {
        activePlayer = startingPlayer;
        battleStats = { shots: 0, hits: 0, rounds: 0 };
        isShootingAllowed = true;

        if (gameMode === 'ai') {
            aiEngine = new BattleshipAI();
            player2Board = aiEngine.board;
            battleModeTag.textContent = 'VS AI';
            hostInviteBar.classList.add('hidden');
            reactionsBar.classList.add('hidden');
        } else if (gameMode === 'online') {
            battleModeTag.textContent = 'ONLINE';
            reactionsBar.classList.remove('hidden');
            if (myOnlineRole === 'host') {
                hostInviteBar.classList.remove('hidden');
            } else {
                hostInviteBar.classList.add('hidden');
            }
        }

        initBattleBoards();
        updateBattleUI();
        showScreen(screenBattle);

        if (gameMode === 'online') {
            const isMyTurn = (myOnlineRole === 'host' && activePlayer === 1) || (myOnlineRole === 'joiner' && activePlayer === 2);
            showToast(isMyTurn ? 'Your turn' : "Opponent's turn");
        } else {
            showToast(activePlayer === 1 ? 'Your turn' : "Opponent's turn");
        }
    }

    function initBattleBoards() {
        myBattleGridEl.innerHTML = '';
        enemyBattleGridEl.innerHTML = '';

        for (let i = 0; i < TOTAL_CELLS; i++) {
            // Friendly board cell
            const myCell = document.createElement('div');
            myCell.className = 'cell';
            myCell.dataset.index = i;
            myBattleGridEl.appendChild(myCell);

            // Radar target board cell
            const enemyCell = document.createElement('div');
            enemyCell.className = 'cell';
            enemyCell.dataset.index = i;
            enemyCell.addEventListener('click', () => onPlayerFire(i));
            enemyBattleGridEl.appendChild(enemyCell);
        }

        renderBattleBoards();
    }

    function renderBattleBoards() {
        const myBoard = player1Board;
        const enemyBoard = player2Board;

        // Render My Fleet Grid
        const myCells = myBattleGridEl.querySelectorAll('.cell');
        myCells.forEach((cell, idx) => {
            cell.className = 'cell';
            const shipId = myBoard.grid[idx];
            if (shipId !== null) {
                cell.classList.add('has-ship');
            }
            if (myBoard.shots[idx] === 'miss') {
                cell.classList.add('state-miss');
            } else if (myBoard.shots[idx] === 'hit') {
                cell.classList.add('state-hit');
            } else if (myBoard.shots[idx] === 'sunk') {
                cell.classList.add('state-sunk');
            }

            if (myBoard.lastShotIndex === idx) {
                cell.classList.add('last-shot-highlight');
            }
        });

        // Render Enemy Radar Grid (Fog of War)
        const enemyCells = enemyBattleGridEl.querySelectorAll('.cell');
        enemyCells.forEach((cell, idx) => {
            cell.className = 'cell';
            if (enemyBoard.shots[idx] === 'miss') {
                cell.classList.add('state-miss');
            } else if (enemyBoard.shots[idx] === 'hit') {
                cell.classList.add('state-hit');
            } else if (enemyBoard.shots[idx] === 'sunk') {
                cell.classList.add('state-sunk');
            }

            if (enemyBoard.lastShotIndex === idx) {
                cell.classList.add('last-shot-highlight');
            }
        });

        renderFleetTrackers(myBoard, enemyBoard);
    }

    function renderFleetTrackers(myBoard, enemyBoard) {
        // Tracker for friendly fleet
        myFleetTracker.innerHTML = '';
        myBoard.ships.forEach(ship => {
            const shipMini = document.createElement('div');
            shipMini.className = `mini-ship ${ship.isSunk ? 'sunk' : ''}`;
            for (let i = 0; i < ship.size; i++) {
                const deck = document.createElement('div');
                deck.className = 'mini-deck';
                shipMini.appendChild(deck);
            }
            myFleetTracker.appendChild(shipMini);
        });

        // Tracker for enemy fleet
        enemyFleetTracker.innerHTML = '';
        enemyBoard.ships.forEach(ship => {
            const shipMini = document.createElement('div');
            shipMini.className = `mini-ship ${ship.isSunk ? 'sunk' : ''}`;
            for (let i = 0; i < ship.size; i++) {
                const deck = document.createElement('div');
                deck.className = 'mini-deck';
                shipMini.appendChild(deck);
            }
            enemyFleetTracker.appendChild(shipMini);
        });
    }

    function updateBattleUI() {
        const isMyTurn = (gameMode === 'online') 
            ? ((myOnlineRole === 'host' && activePlayer === 1) || (myOnlineRole === 'joiner' && activePlayer === 2))
            : (activePlayer === 1);

        if (isMyTurn) {
            turnDot.className = 'turn-pulse-dot';
            turnTitle.textContent = 'Your Turn';
            if (turnSubtitle) turnSubtitle.textContent = '';
        } else {
            turnDot.className = 'turn-pulse-dot enemy-turn';
            turnTitle.textContent = (gameMode === 'ai') ? 'AI Turn' : "Opponent's Turn";
            if (turnSubtitle) turnSubtitle.textContent = '';
        }

        if (enemyBattleGridEl) enemyBattleGridEl.classList.toggle('active-turn', isMyTurn);
        if (myBattleGridEl) myBattleGridEl.classList.toggle('active-turn', !isMyTurn);
    }

    // ==========================================
    // SHOOTING ACTIONS
    // ==========================================
    function onPlayerFire(index) {
        if (!isShootingAllowed) return;

        // Check if it's player's turn
        if (gameMode === 'online') {
            const isMyTurn = (myOnlineRole === 'host' && activePlayer === 1) || (myOnlineRole === 'joiner' && activePlayer === 2);
            if (!isMyTurn) {
                showToast("Opponent's turn", 'danger');
                return;
            }
        } else if (gameMode === 'ai' && activePlayer !== 1) {
            return;
        }

        const enemyBoard = player2Board;

        if (enemyBoard.shots[index] !== null) {
            showToast('Already targeted');
            return;
        }

        sound.play('shot');
        battleStats.shots++;

        if (gameMode === 'online') {
            // Send shot to opponent
            isShootingAllowed = false;
            sendOnlineData({
                type: 'FIRE_SHOT',
                index: index,
                shooterRole: myOnlineRole
            });
            return;
        }

        // AI shot evaluation
        processShotLocally(enemyBoard, index, true);
    }

    function processShotLocally(targetBoard, index, isFriendlyShooter) {
        const shotResult = targetBoard.receiveShot(index);
        if (!shotResult) return;

        renderBattleBoards();

        if (shotResult.result === 'miss') {
            sound.play('miss');
            showToast('Miss');
            // Turn passes to opponent
            activePlayer = activePlayer === 1 ? 2 : 1;
            updateBattleUI();

            if (gameMode === 'ai' && activePlayer === 2) {
                isShootingAllowed = false;
                triggerAiTurn();
            }
        } else if (shotResult.result === 'hit') {
            sound.play('hit');
            if (isFriendlyShooter) battleStats.hits++;
            showToast('Hit!', 'success');
            // Shooter keeps the turn!
            updateBattleUI();

            if (gameMode === 'ai' && activePlayer === 2) {
                aiEngine.registerShotResult(index, 'hit');
                triggerAiTurn(600);
            }
        } else if (shotResult.result === 'sunk') {
            sound.play('sunk');
            if (isFriendlyShooter) battleStats.hits++;
            showToast('Ship sunk!', 'success');

            if (shotResult.allSunk) {
                // Game Over!
                handleGameOver(activePlayer === 1);
                return;
            }

            // Shooter keeps the turn
            updateBattleUI();

            if (gameMode === 'ai' && activePlayer === 2) {
                aiEngine.registerShotResult(index, 'sunk', shotResult.halo);
                triggerAiTurn(700);
            }
        }
    }

    function triggerAiTurn(delay = 700) {
        setTimeout(() => {
            if (activePlayer !== 2 || screenBattle.classList.contains('active') === false) return;

            const aiShotIndex = aiEngine.getNextShot();
            if (aiShotIndex === null) return;

            sound.play('shot');
            const result = player1Board.receiveShot(aiShotIndex);
            if (!result) return;

            renderBattleBoards();

            if (result.result === 'miss') {
                sound.play('miss');
                showToast('AI miss');
                activePlayer = 1;
                isShootingAllowed = true;
                updateBattleUI();
            } else if (result.result === 'hit') {
                sound.play('hit');
                showToast('AI hit', 'danger');
                aiEngine.registerShotResult(aiShotIndex, 'hit');
                updateBattleUI();
                triggerAiTurn(750);
            } else if (result.result === 'sunk') {
                sound.play('sunk');
                showToast('Ship lost', 'danger');
                aiEngine.registerShotResult(aiShotIndex, 'sunk', result.halo);

                if (result.allSunk) {
                    handleGameOver(false);
                    return;
                }

                updateBattleUI();
                triggerAiTurn(800);
            }
        }, delay);
    }

    // ==========================================
    // GAME OVER & STATS
    // ==========================================
    function handleGameOver(isWinner) {
        isShootingAllowed = false;

        if (isWinner) {
            sound.play('win');
            modalGameOverTitle.textContent = 'Victory';
            modalGameOverTitle.className = 'modal-title victory';
            modalGameOverDesc.textContent = 'Enemy fleet destroyed';
        } else {
            sound.play('lose');
            modalGameOverTitle.textContent = 'Defeat';
            modalGameOverTitle.className = 'modal-title defeat';
            modalGameOverDesc.textContent = 'Your fleet was sunk';
        }

        const accuracy = battleStats.shots > 0 ? Math.round((battleStats.hits / battleStats.shots) * 100) : 0;
        statShots.textContent = battleStats.shots;
        statHits.textContent = battleStats.hits;
        statAccuracy.textContent = `${accuracy}%`;
        statRounds.textContent = battleStats.shots;

        if (gameMode === 'online') {
            btnGameOverRematch.classList.remove('hidden');
            btnGameOverRematchText.textContent = rematchRequested.opponent ? 'Accept Rematch' : 'Rematch';
        } else {
            btnGameOverRematchText.textContent = 'Play Again';
        }

        modalGameOver.classList.add('active');
    }

    btnGameOverRematch.addEventListener('click', () => {
        modalGameOver.classList.remove('active');
        if (gameMode === 'online') {
            rematchRequested.me = true;
            sendOnlineData({ type: 'REMATCH_REQUEST' });
            if (rematchRequested.opponent) {
                startOnlinePlacement();
            } else {
                showToast('Rematch request sent!');
            }
        } else {
            // Reset for AI
            player1Board.clear();
            player2Board.clear();
            placementPlayerTag.textContent = 'FLEET';
            initPlacementGrid();
            showScreen(screenPlacement);
        }
    });

    btnGameOverMenu.addEventListener('click', () => {
        modalGameOver.classList.remove('active');
        leaveToMainMenu();
    });

    btnSurrender.addEventListener('click', () => {
        if (confirm('Are you sure you want to surrender?')) {
            if (gameMode === 'online') {
                sendOnlineData({ type: 'SURRENDER' });
            }
            handleGameOver(false);
        }
    });

    // ==========================================
    // MOBILE TABS SWITCHER
    // ==========================================
    tabMyFleet.addEventListener('click', () => {
        tabMyFleet.classList.add('active');
        tabEnemyRadar.classList.remove('active');
        wrapperMyFleet.classList.remove('mobile-hidden');
        wrapperEnemyRadar.classList.add('mobile-hidden');
    });

    tabEnemyRadar.addEventListener('click', () => {
        tabEnemyRadar.classList.add('active');
        tabMyFleet.classList.remove('active');
        wrapperEnemyRadar.classList.remove('mobile-hidden');
        wrapperMyFleet.classList.add('mobile-hidden');
        enemyTabBadge.classList.add('hidden');
    });

    // ==========================================
    // MENU NAVIGATION LOGIC
    // ==========================================
    btnModeAi.addEventListener('click', () => {
        gameMode = 'ai';
        placementPlayerTag.textContent = 'FLEET';
        player1Board.clear();
        initPlacementGrid();
        showScreen(screenPlacement);
    });

    btnModeOnline.addEventListener('click', () => {
        gameMode = 'online';
        initSupabase();
        showScreen(screenOnlineLobby);
    });

    backToMenuBtns.forEach(btn => {
        btn.addEventListener('click', leaveToMainMenu);
    });

    async function leaveToMainMenu() {
        clearJoinTimeout();
        clearUrlRoomParam();
        await leaveSupabaseRoom();
        player1Board.clear();
        player2Board.clear();
        rematchRequested = { me: false, opponent: false };
        onlineOpponentReady = false;
        hostInviteBar.classList.add('hidden');
        showScreen(screenMenu);
    }

    // ==========================================
    // SUPABASE REALTIME MULTIPLAYER ENGINE
    // ==========================================
    function initSupabase() {
        if (supabase) return true;

        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            networkStatusBadge.classList.remove('connected');
            networkStatusText.textContent = 'Connecting...';
            return false;
        }

        const config = window.SUPABASE_CONFIG || {
            url: 'https://hwkvjpyhnhjofjdumwbe.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a3ZqcHlobmhqb2ZqZHVtd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTU3OTIsImV4cCI6MjEwNTU5MTc5Mn0.j0XEnJ5Tv7OqiMhzSlJPheMEbGC3_8wjXurzaP1NSV8'
        };

        try {
            supabase = window.supabase.createClient(config.url, config.anonKey, {
                realtime: {
                    params: {
                        eventsPerSecond: 20
                    }
                }
            });
            networkStatusBadge.classList.add('connected');
            networkStatusText.textContent = 'Server Online';
            return true;
        } catch (e) {
            console.error('Supabase init failed:', e);
            networkStatusBadge.classList.remove('connected');
            networkStatusText.textContent = 'Network Error';
            return false;
        }
    }

    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async function leaveSupabaseRoom() {
        if (gameChannel) {
            try {
                await gameChannel.unsubscribe();
            } catch (e) {}
            gameChannel = null;
        }
        roomCode = null;
        myOnlineRole = null;
        isOnlineConnected = false;
    }

    function sendOnlineData(payload) {
        if (gameChannel) {
            gameChannel.send({
                type: 'broadcast',
                event: 'game-event',
                payload
            }).catch(err => {
                console.error('Realtime broadcast error:', err);
            });
        }
    }

    function handleOnlineData(data) {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'JOINER_HELLO':
                if (myOnlineRole === 'host') {
                    showToast('Opponent connected', 'success');
                    sendOnlineData({ type: 'LOBBY_READY' });
                    startOnlinePlacement();
                }
                break;

            case 'LOBBY_READY':
                clearJoinTimeout();
                showToast('Connected', 'success');
                startOnlinePlacement();
                break;

            case 'FLEET_READY':
                onlineOpponentReady = true;
                showToast('Opponent ready');
                if (player1Board.isFleetReady() && myOnlineRole === 'host') {
                    const firstTurn = Math.random() < 0.5 ? 'host' : 'joiner';
                    sendOnlineData({ type: 'START_BATTLE', firstTurn });
                    launchBattle(firstTurn === 'host' ? 1 : 2);
                }
                break;

            case 'START_BATTLE':
                launchBattle(data.firstTurn === 'host' ? 1 : 2);
                break;

            case 'FIRE_SHOT': {
                // Incoming shot on our fleet!
                const incomingIndex = data.index;
                const result = player1Board.receiveShot(incomingIndex);
                if (!result) return;

                renderBattleBoards();

                // Respond with evaluation
                sendOnlineData({
                    type: 'SHOT_RESPONSE',
                    index: incomingIndex,
                    result: result.result,
                    shipName: result.ship ? result.ship.name : null,
                    halo: result.halo || [],
                    allSunk: result.allSunk
                });

                if (result.result === 'miss') {
                    sound.play('miss');
                    showToast('Opponent missed');
                    // Turn passes to us
                    activePlayer = (myOnlineRole === 'host') ? 1 : 2;
                    isShootingAllowed = true;
                    updateBattleUI();
                } else if (result.result === 'hit') {
                    sound.play('hit');
                    showToast('Opponent hit', 'danger');
                    // Opponent keeps turn
                    updateBattleUI();
                } else if (result.result === 'sunk') {
                    sound.play('sunk');
                    showToast('Ship lost', 'danger');
                    if (result.allSunk) {
                        handleGameOver(false);
                        return;
                    }
                    updateBattleUI();
                }
                break;
            }

            case 'SHOT_RESPONSE': {
                // Opponent evaluated our shot!
                isShootingAllowed = true;
                const shotIdx = data.index;

                // Update opponent radar grid locally
                if (data.result === 'miss') {
                    sound.play('miss');
                    player2Board.shots[shotIdx] = 'miss';
                    player2Board.lastShotIndex = shotIdx;
                    showToast('Miss');
                    // Turn passes to opponent
                    activePlayer = (myOnlineRole === 'host') ? 2 : 1;
                    updateBattleUI();
                } else if (data.result === 'hit') {
                    sound.play('hit');
                    battleStats.hits++;
                    player2Board.shots[shotIdx] = 'hit';
                    player2Board.lastShotIndex = shotIdx;
                    showToast('Hit!', 'success');
                    updateBattleUI();
                } else if (data.result === 'sunk') {
                    sound.play('sunk');
                    battleStats.hits++;
                    player2Board.shots[shotIdx] = 'sunk';
                    player2Board.lastShotIndex = shotIdx;

                    // Mark sunken ship and surrounding halo
                    if (data.halo && Array.isArray(data.halo)) {
                        data.halo.forEach(hIdx => {
                            if (player2Board.shots[hIdx] === null) {
                                player2Board.shots[hIdx] = 'miss';
                            }
                        });
                    }

                    showToast('Ship sunk!', 'success');

                    if (data.allSunk) {
                        handleGameOver(true);
                        return;
                    }

                    updateBattleUI();
                }

                renderBattleBoards();
                break;
            }

            case 'EMOJI':
                showFloatingEmoji(data.emoji);
                break;

            case 'REMATCH_REQUEST':
                rematchRequested.opponent = true;
                if (rematchRequested.me) {
                    startOnlinePlacement();
                } else {
                    btnGameOverRematchText.textContent = 'Accept Rematch';
                    showToast('Opponent requested rematch');
                }
                break;

            case 'SURRENDER':
                showToast('Opponent surrendered', 'success');
                handleGameOver(true);
                break;
        }
    }

    function startOnlinePlacement() {
        player1Board.clear();
        player2Board.clear();
        onlineOpponentReady = false;
        rematchRequested = { me: false, opponent: false };
        placementPlayerTag.textContent = myOnlineRole === 'host' ? 'HOST' : 'GUEST';
        btnReadyBattle.disabled = true;
        btnReadyBattle.textContent = 'Start Game';
        initPlacementGrid();
        showScreen(screenPlacement);
    }

    // Host: Create Room
    btnCreateRoom.addEventListener('click', async () => {
        if (!initSupabase()) {
            showToast('Server connection error', 'danger');
            return;
        }

        roomCode = generateRoomCode();
        myOnlineRole = 'host';
        displayRoomCode.textContent = roomCode;
        gameRoomCodeInput.value = '******';
        isCodeRevealed = false;

        const channelName = `sea-battle-room-${roomCode}`;
        gameChannel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: false, self: false },
                presence: { key: `host-${Date.now()}` }
            }
        });

        gameChannel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
            handleOnlineData(payload);
        });

        gameChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                isOnlineConnected = true;
                showScreen(screenWaiting);
                showToast('Room created');
            }
        });
    });

    // Joiner: Join Room
    btnJoinRoom.addEventListener('click', async () => {
        const code = inputRoomCode.value.trim().toUpperCase();
        if (code.length !== 6) {
            showToast('Enter 6-char code', 'danger');
            return;
        }

        joinRoomWithCode(code);
    });

    async function joinRoomWithCode(code) {
        if (!initSupabase()) {
            showToast('Network error', 'danger');
            return;
        }

        roomCode = code;
        myOnlineRole = 'joiner';
        const channelName = `sea-battle-room-${roomCode}`;

        gameChannel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: false, self: false },
                presence: { key: `joiner-${Date.now()}` }
            }
        });

        gameChannel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
            handleOnlineData(payload);
        });

        gameChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                isOnlineConnected = true;
                // Alert host
                sendOnlineData({ type: 'JOINER_HELLO' });

                joinTimeout = setTimeout(() => {
                    showToast('Host not responding', 'danger');
                    leaveToMainMenu();
                }, 10000);
            }
        });
    }

    // Emoji reactions
    emojiBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            showFloatingEmoji(emoji);
            if (gameMode === 'online') {
                sendOnlineData({ type: 'EMOJI', emoji });
            }
        });
    });

    // Copy Room Code & Direct Link
    btnCopyCode.addEventListener('click', () => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            showToast('Code copied');
        }
    });

    btnCopyLink.addEventListener('click', () => {
        if (roomCode) {
            const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
            navigator.clipboard.writeText(url);
            showToast('Link copied');
        }
    });

    // In-game code peeker
    btnTogglePeek.addEventListener('click', () => {
        isCodeRevealed = !isCodeRevealed;
        gameRoomCodeInput.value = isCodeRevealed ? roomCode : '******';
        iconEyeClosed.classList.toggle('hidden', isCodeRevealed);
        iconEyeOpen.classList.toggle('hidden', !isCodeRevealed);
    });

    btnCopyGameCode.addEventListener('click', () => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            showToast('Code copied');
        }
    });

    btnShareOnline.addEventListener('click', () => {
        if (roomCode) {
            const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
            navigator.clipboard.writeText(url);
            showToast('Link copied');
        }
    });

    function clearJoinTimeout() {
        if (joinTimeout) {
            clearTimeout(joinTimeout);
            joinTimeout = null;
        }
    }

    function clearUrlRoomParam() {
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    function checkUrlRoomParam() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRoom = urlParams.get('room');
        if (urlRoom && urlRoom.length === 6) {
            gameMode = 'online';
            inputRoomCode.value = urlRoom.toUpperCase();
            showScreen(screenOnlineLobby);
            joinRoomWithCode(urlRoom.toUpperCase());
            return true;
        }
        return false;
    }

    // Check for direct join on launch
    const hasDirectJoin = checkUrlRoomParam();
    if (!hasDirectJoin) {
        showScreen(screenMenu);
    }
});
