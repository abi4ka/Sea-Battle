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

        /**
         * Ultra-minimalist tactile UI tap generator (iOS / Telegram haptic style)
         */
        playTap(startTime, freq, duration, peakGain, sweepToFreq = null) {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            if (sweepToFreq !== null && sweepToFreq !== freq) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepToFreq), startTime + duration);
            }

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1600, startTime);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.003);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        }

        play(type) {
            if (this.isMuted) return;
            try {
                this.initContext();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                switch (type) {
                    case 'place': {
                        // iOS keyboard / picker wheel tap (crisp tactile click)
                        this.playTap(now, 520, 0.035, 0.18, 280);
                        break;
                    }

                    case 'shot': {
                        // Soft UI action tap (Telegram send / tactile tock)
                        this.playTap(now, 240, 0.045, 0.22, 110);
                        break;
                    }

                    case 'miss': {
                        // Muted low-frequency soft pop (empty cell tap)
                        this.playTap(now, 160, 0.038, 0.16, 85);
                        break;
                    }

                    case 'hit': {
                        // Delicate double-tick (Telegram reaction / positive toggle tap)
                        this.playTap(now, 520, 0.032, 0.20);
                        this.playTap(now + 0.035, 740, 0.035, 0.20);
                        break;
                    }

                    case 'sunk': {
                        // Soft ascending triple-tap ripple
                        this.playTap(now, 440, 0.035, 0.18);
                        this.playTap(now + 0.038, 554, 0.038, 0.20);
                        this.playTap(now + 0.076, 659, 0.055, 0.22);
                        break;
                    }

                    case 'win': {
                        // Minimalist, calm completion chime (Todoist / Things 3 style)
                        const chord = [523.25, 659.25, 783.99]; // C5, E5, G5
                        chord.forEach((freq, idx) => {
                            this.playTap(now + idx * 0.08, freq, 0.32, 0.18);
                        });
                        break;
                    }

                    case 'lose': {
                        // Soft muted low closure note
                        this.playTap(now, 240, 0.25, 0.16);
                        this.playTap(now + 0.10, 180, 0.30, 0.16);
                        break;
                    }
                }
            } catch (e) {
                // AudioContext fallback
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

            const shipId = `ship-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const { x, y } = indexToCoords(startIndex);
            const cells = [];

            for (let i = 0; i < size; i++) {
                const cx = isHorizontal ? x + i : x;
                const cy = isHorizontal ? y : y + i;
                const idx = coordsToIndex(cx, cy);
                cells.push(idx);
                this.grid[idx] = shipId;
            }

            const shipDef = FLEET_DEFINITIONS.find(d => d.type === type);
            const ship = {
                id: shipId,
                type,
                name: shipDef ? shipDef.name : type,
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
            const MAX_BOARD_ATTEMPTS = 200;
            for (let boardAttempt = 0; boardAttempt < MAX_BOARD_ATTEMPTS; boardAttempt++) {
                this.clear();
                const shipQueue = [];
                FLEET_DEFINITIONS.forEach(def => {
                    for (let i = 0; i < def.count; i++) {
                        shipQueue.push({ type: def.type, size: def.size });
                    }
                });

                // Sort larger ships first for higher placement probability
                shipQueue.sort((a, b) => b.size - a.size);

                let allPlaced = true;
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
                        allPlaced = false;
                        break;
                    }
                }

                if (allPlaced) {
                    return true;
                }
            }
            return false;
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
            this.remainingEnemyShips = [];
            FLEET_DEFINITIONS.forEach(def => {
                for (let i = 0; i < def.count; i++) {
                    this.remainingEnemyShips.push(def.size);
                }
            });
        }

        canShipFit(index, minSize) {
            if (minSize <= 1) return true;
            if (this.shotsFired.has(index)) return false;

            const { x, y } = indexToCoords(index);

            // Count contiguous unshot cells horizontally through index
            let leftCount = 0;
            for (let cx = x - 1; cx >= 0; cx--) {
                if (this.shotsFired.has(coordsToIndex(cx, y))) break;
                leftCount++;
            }
            let rightCount = 0;
            for (let cx = x + 1; cx < GRID_SIZE; cx++) {
                if (this.shotsFired.has(coordsToIndex(cx, y))) break;
                rightCount++;
            }
            if (1 + leftCount + rightCount >= minSize) return true;

            // Count contiguous unshot cells vertically through index
            let upCount = 0;
            for (let cy = y - 1; cy >= 0; cy--) {
                if (this.shotsFired.has(coordsToIndex(x, cy))) break;
                upCount++;
            }
            let downCount = 0;
            for (let cy = y + 1; cy < GRID_SIZE; cy++) {
                if (this.shotsFired.has(coordsToIndex(x, cy))) break;
                downCount++;
            }
            return (1 + upCount + downCount) >= minSize;
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

            // Hunt Mode: intelligent search
            if (target === null) {
                const maxRemainingSize = this.remainingEnemyShips.length > 0
                    ? Math.max(...this.remainingEnemyShips)
                    : 1;

                const candidates = [];
                const fallback = [];

                for (let i = 0; i < TOTAL_CELLS; i++) {
                    if (this.shotsFired.has(i)) continue;

                    fallback.push(i);

                    // If remaining ships include size >= 2, skip cells where at least a size-2 ship cannot fit
                    if (maxRemainingSize >= 2 && !this.canShipFit(i, 2)) {
                        continue;
                    }

                    const { x, y } = indexToCoords(i);

                    // If only 1-deck torpedo boats remain, bypass parity filter completely
                    if (maxRemainingSize === 1) {
                        candidates.push(i);
                    } else {
                        // Multi-deck ships: checkerboard parity search
                        if ((x + y) % 2 === 0) {
                            candidates.push(i);
                        }
                    }
                }

                if (candidates.length > 0) {
                    target = candidates[Math.floor(Math.random() * candidates.length)];
                } else if (fallback.length > 0) {
                    target = fallback[Math.floor(Math.random() * fallback.length)];
                }
            }

            if (target !== null) {
                this.shotsFired.add(target);
            }
            return target;
        }

        registerShotResult(index, result, halo = [], ship = null) {
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

                    // Add line extensions with deduplication
                    if (isHorizontal) {
                        const minX = Math.min(...sortedHits.map(idx => indexToCoords(idx).x));
                        const maxX = Math.max(...sortedHits.map(idx => indexToCoords(idx).x));
                        const left = coordsToIndex(minX - 1, first.y);
                        const right = coordsToIndex(maxX + 1, first.y);
                        if (left !== -1 && !this.shotsFired.has(left) && !this.targetQueue.includes(left)) {
                            this.targetQueue.unshift(left);
                        }
                        if (right !== -1 && !this.shotsFired.has(right) && !this.targetQueue.includes(right)) {
                            this.targetQueue.unshift(right);
                        }
                    } else {
                        const minY = Math.min(...sortedHits.map(idx => indexToCoords(idx).y));
                        const maxY = Math.max(...sortedHits.map(idx => indexToCoords(idx).y));
                        const top = coordsToIndex(first.x, minY - 1);
                        const bottom = coordsToIndex(first.x, maxY + 1);
                        if (top !== -1 && !this.shotsFired.has(top) && !this.targetQueue.includes(top)) {
                            this.targetQueue.unshift(top);
                        }
                        if (bottom !== -1 && !this.shotsFired.has(bottom) && !this.targetQueue.includes(bottom)) {
                            this.targetQueue.unshift(bottom);
                        }
                    }
                }
            } else if (result === 'sunk') {
                if (ship && typeof ship.size === 'number') {
                    const sIdx = this.remainingEnemyShips.indexOf(ship.size);
                    if (sIdx !== -1) {
                        this.remainingEnemyShips.splice(sIdx, 1);
                    }
                }
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

    // Post-Game Action Bar
    const postGameReviewBar = document.getElementById('post-game-review-bar');
    const reviewStatusBadge = document.getElementById('review-status-badge');
    const reviewStatsSummary = document.getElementById('review-stats-summary');
    const btnReviewRematch = document.getElementById('btn-review-rematch');
    const btnReviewRematchText = document.getElementById('btn-review-rematch-text');
    const btnReviewMenu = document.getElementById('btn-review-menu');

    const modalRules = document.getElementById('modal-rules');
    const btnCloseRules = document.getElementById('btn-close-rules');
    const btnRulesToggle = document.getElementById('btn-rules-toggle');

    const modalConfirm = document.getElementById('modal-confirm');
    const modalConfirmTitle = document.getElementById('modal-confirm-title');
    const modalConfirmDesc = document.getElementById('modal-confirm-desc');
    const btnConfirmAccept = document.getElementById('btn-confirm-accept');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');

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
    const myFleetTabBadge = document.getElementById('my-fleet-tab-badge');

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
    let isBattleReviewMode = false;
    let battleStats = {
        shots: 0,
        hits: 0
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
    let isDisconnectHandled = false;
    let pendingShot = null;
    let shotTimeoutId = null;
    let myPlayerId = null;
    let opponentPlayerId = null;
    let isRoomLocked = false;

    function generatePlayerId(role) {
        return `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }

    function clearShotTimeout() {
        if (shotTimeoutId) {
            clearTimeout(shotTimeoutId);
            shotTimeoutId = null;
        }
        pendingShot = null;
    }

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
        if (!container) return;

        // Limit visible toasts to at most 3
        while (container.children.length >= 3) {
            container.removeChild(container.firstElementChild);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type === 'danger' ? 'toast-danger' : type === 'success' ? 'toast-success' : ''}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 250);
        }, 2400);
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
        battleStats = { shots: 0, hits: 0 };
        isShootingAllowed = true;
        isBattleReviewMode = false;
        if (postGameReviewBar) postGameReviewBar.classList.add('hidden');
        if (enemyBattleGridEl) enemyBattleGridEl.classList.remove('battle-finished');
        if (btnSurrender) btnSurrender.classList.remove('hidden');
        if (turnSubtitle) turnSubtitle.classList.add('hidden');

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

            // Initialize opponent fleet placeholders for tracker
            player2Board.ships = [];
            FLEET_DEFINITIONS.forEach(def => {
                for (let i = 0; i < def.count; i++) {
                    player2Board.ships.push({
                        type: def.type,
                        name: def.name,
                        size: def.size,
                        isSunk: false
                    });
                }
            });
            player2Board.ships.sort((a, b) => b.size - a.size);
        }

        initBattleBoards();
        updateBattleUI();
        showScreen(screenBattle);

        // Reset mobile tabs to default view (Opponent Radar)
        tabEnemyRadar.classList.add('active');
        tabMyFleet.classList.remove('active');
        wrapperEnemyRadar.classList.remove('mobile-hidden');
        wrapperMyFleet.classList.add('mobile-hidden');
        if (enemyTabBadge) enemyTabBadge.classList.add('hidden');
        if (myFleetTabBadge) myFleetTabBadge.classList.add('hidden');

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
            } else if (isBattleReviewMode) {
                const hasShip = enemyBoard.grid && enemyBoard.grid[idx] !== null;
                if (hasShip) {
                    cell.classList.add('enemy-revealed-ship');
                }
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
        const myShipsSorted = [...myBoard.ships].sort((a, b) => (b.size - a.size) || (a.isSunk ? 1 : -1));
        myShipsSorted.forEach(ship => {
            const shipMini = document.createElement('div');
            shipMini.className = `mini-ship ${ship.isSunk ? 'sunk' : ''}`;
            shipMini.title = `${ship.name || 'Ship'} (${ship.size} decks)${ship.isSunk ? ' - Sunk' : ''}`;
            for (let i = 0; i < ship.size; i++) {
                const deck = document.createElement('div');
                deck.className = 'mini-deck';
                shipMini.appendChild(deck);
            }
            myFleetTracker.appendChild(shipMini);
        });

        // Tracker for enemy fleet
        enemyFleetTracker.innerHTML = '';
        const enemyShipsSorted = [...enemyBoard.ships].sort((a, b) => (b.size - a.size) || (a.isSunk ? 1 : -1));
        enemyShipsSorted.forEach(ship => {
            const shipMini = document.createElement('div');
            shipMini.className = `mini-ship ${ship.isSunk ? 'sunk' : ''}`;
            shipMini.title = `${ship.name || 'Ship'} (${ship.size} decks)${ship.isSunk ? ' - Sunk' : ''}`;
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

        if (isMyTurn && wrapperEnemyRadar && wrapperEnemyRadar.classList.contains('mobile-hidden') && enemyTabBadge) {
            enemyTabBadge.classList.remove('hidden');
        }
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
            // Send shot to opponent with timeout & retry tracking
            isShootingAllowed = false;
            pendingShot = {
                index: index,
                shotId: `${myOnlineRole}-${Date.now()}-${index}`,
                retryCount: 0
            };

            dispatchOnlineShot();
            return;
        }

        // AI shot evaluation
        processShotLocally(enemyBoard, index, true);
    }

    function dispatchOnlineShot() {
        if (!pendingShot || gameMode !== 'online') return;

        if (shotTimeoutId) {
            clearTimeout(shotTimeoutId);
            shotTimeoutId = null;
        }

        sendOnlineData({
            type: 'FIRE_SHOT',
            index: pendingShot.index,
            shotId: pendingShot.shotId,
            retryCount: pendingShot.retryCount,
            shooterRole: myOnlineRole
        });

        shotTimeoutId = setTimeout(() => {
            if (!pendingShot || gameMode !== 'online') return;

            if (pendingShot.retryCount < 2) {
                pendingShot.retryCount++;
                showToast('Retrying shot...', 'normal');
                dispatchOnlineShot();
            } else {
                // Timeout exhausted - release local lock so player isn't stuck forever
                clearShotTimeout();
                isShootingAllowed = true;
                showToast('Shot timed out. Please try again.', 'danger');
                updateBattleUI();
            }
        }, 3500);
    }

    function processShotLocally(targetBoard, index, isFriendlyShooter) {
        const shotResult = targetBoard.receiveShot(index);
        if (!shotResult) return;

        renderBattleBoards();

        if (shotResult.result === 'miss') {
            sound.play('miss');
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
            // Shooter keeps the turn!
            updateBattleUI();

            if (gameMode === 'ai' && activePlayer === 2) {
                aiEngine.registerShotResult(index, 'hit');
                triggerAiTurn(600);
            }
        } else if (shotResult.result === 'sunk') {
            sound.play('sunk');
            if (isFriendlyShooter) {
                battleStats.hits++;
                const shipDef = shotResult.ship ? FLEET_DEFINITIONS.find(d => d.type === shotResult.ship.type) : null;
                const shipName = shotResult.ship ? (shotResult.ship.name || (shipDef ? shipDef.name : shotResult.ship.type)) : 'Ship';
                showToast(`${shipName} sunk!`, 'success');
            }

            if (shotResult.allSunk) {
                // Game Over!
                handleGameOver(activePlayer === 1);
                return;
            }

            // Shooter keeps the turn
            updateBattleUI();

            if (gameMode === 'ai' && activePlayer === 2) {
                aiEngine.registerShotResult(index, 'sunk', shotResult.halo, shotResult.ship);
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

            if (wrapperMyFleet && wrapperMyFleet.classList.contains('mobile-hidden') && myFleetTabBadge) {
                myFleetTabBadge.classList.remove('hidden');
            }

            if (result.result === 'miss') {
                sound.play('miss');
                activePlayer = 1;
                isShootingAllowed = true;
                updateBattleUI();
            } else if (result.result === 'hit') {
                sound.play('hit');
                aiEngine.registerShotResult(aiShotIndex, 'hit');
                updateBattleUI();
                triggerAiTurn(750);
            } else if (result.result === 'sunk') {
                sound.play('sunk');
                const shipDef = result.ship ? FLEET_DEFINITIONS.find(d => d.type === result.ship.type) : null;
                const shipName = result.ship ? (result.ship.name || (shipDef ? shipDef.name : result.ship.type)) : 'Ship';
                showToast(`${shipName} lost!`, 'danger');

                aiEngine.registerShotResult(aiShotIndex, 'sunk', result.halo, result.ship);

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
    function handleGameOver(isWinner, customTitle = null, customDesc = null) {
        clearShotTimeout();
        isShootingAllowed = false;
        isBattleReviewMode = true;

        if (enemyBattleGridEl) {
            enemyBattleGridEl.classList.add('battle-finished');
        }
        if (btnSurrender) {
            btnSurrender.classList.add('hidden');
        }

        const victoryTitle = customTitle || (isWinner ? 'Victory' : 'Defeat');

        if (isWinner) {
            sound.play('win');
            if (turnTitle) turnTitle.textContent = victoryTitle;
        } else {
            sound.play('lose');
            if (turnTitle) turnTitle.textContent = victoryTitle;
        }

        if (turnSubtitle) {
            turnSubtitle.textContent = 'Battle Concluded';
            turnSubtitle.classList.remove('hidden');
        }

        const accuracy = battleStats.shots > 0 ? Math.round((battleStats.hits / battleStats.shots) * 100) : 0;

        // Update post-game review bar
        if (reviewStatusBadge) {
            reviewStatusBadge.textContent = victoryTitle;
            reviewStatusBadge.className = `review-badge ${isWinner ? 'victory' : 'defeat'}`;
        }
        if (reviewStatsSummary) {
            reviewStatsSummary.textContent = `${battleStats.shots} shots • ${battleStats.hits} hits • ${accuracy}%`;
        }

        const rematchText = (gameMode === 'online')
            ? (rematchRequested.opponent ? 'Accept Rematch' : 'Rematch')
            : 'Play Again';

        if (btnReviewRematchText) btnReviewRematchText.textContent = rematchText;

        if (gameMode === 'online') {
            if (btnReviewRematch) btnReviewRematch.classList.remove('hidden');
            sendFleetReveal();
        }

        // Render boards so unsunk enemy ships are revealed immediately
        renderBattleBoards();

        // Directly show review bar at the bottom without blocking the boards
        if (postGameReviewBar) {
            postGameReviewBar.classList.remove('hidden');
        }
    }

    function sendFleetReveal() {
        if (gameMode !== 'online' || !isOnlineConnected) return;
        const shipsData = player1Board.ships.map(s => ({
            type: s.type,
            name: s.name,
            size: s.size,
            cells: s.cells,
            isSunk: s.isSunk
        }));
        sendOnlineData({
            type: 'FLEET_REVEAL',
            ships: shipsData
        });
    }

    function handleRematchAction() {
        if (postGameReviewBar) postGameReviewBar.classList.add('hidden');
        if (enemyBattleGridEl) enemyBattleGridEl.classList.remove('battle-finished');
        isBattleReviewMode = false;

        if (gameMode === 'online') {
            rematchRequested.me = true;
            sendOnlineData({ type: 'REMATCH_REQUEST' });
            if (rematchRequested.opponent) {
                startOnlinePlacement();
            } else {
                showToast('Rematch request sent!');
                if (btnReviewRematchText) btnReviewRematchText.textContent = 'Waiting...';
            }
        } else {
            // Reset for AI
            player1Board.clear();
            player2Board.clear();
            placementPlayerTag.textContent = 'FLEET';
            initPlacementGrid();
            showScreen(screenPlacement);
        }
    }

    if (btnReviewRematch) btnReviewRematch.addEventListener('click', handleRematchAction);

    if (btnReviewMenu) {
        btnReviewMenu.addEventListener('click', () => {
            leaveToMainMenu();
        });
    }

    function showConfirmModal({ title, desc, confirmText = 'Confirm', isDanger = true, onConfirm }) {
        if (!modalConfirm) {
            if (confirm(desc)) {
                if (onConfirm) onConfirm();
            }
            return;
        }

        modalConfirmTitle.textContent = title;
        modalConfirmDesc.textContent = desc;
        btnConfirmAccept.textContent = confirmText;
        btnConfirmAccept.className = isDanger ? 'btn btn-danger btn-full' : 'btn btn-primary btn-full';

        const handleAccept = () => {
            cleanup();
            if (onConfirm) onConfirm();
        };

        const handleCancel = () => {
            cleanup();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        };

        const handleOverlayClick = (e) => {
            if (e.target === modalConfirm) {
                cleanup();
            }
        };

        function cleanup() {
            modalConfirm.classList.remove('active');
            btnConfirmAccept.removeEventListener('click', handleAccept);
            btnConfirmCancel.removeEventListener('click', handleCancel);
            modalConfirm.removeEventListener('click', handleOverlayClick);
            document.removeEventListener('keydown', handleKeydown);
        }

        btnConfirmAccept.addEventListener('click', handleAccept);
        btnConfirmCancel.addEventListener('click', handleCancel);
        modalConfirm.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeydown);

        modalConfirm.classList.add('active');
    }

    btnSurrender.addEventListener('click', () => {
        const desc = (gameMode === 'online')
            ? 'Are you sure you want to surrender? Your opponent will be awarded victory.'
            : 'Are you sure you want to surrender this battle?';

        showConfirmModal({
            title: 'Surrender Battle?',
            desc: desc,
            confirmText: 'Surrender',
            isDanger: true,
            onConfirm: () => {
                if (gameMode === 'online') {
                    sendOnlineData({ type: 'SURRENDER' });
                }
                handleGameOver(false);
            }
        });
    });

    // ==========================================
    // MOBILE TABS SWITCHER
    // ==========================================
    tabMyFleet.addEventListener('click', () => {
        tabMyFleet.classList.add('active');
        tabEnemyRadar.classList.remove('active');
        wrapperMyFleet.classList.remove('mobile-hidden');
        wrapperEnemyRadar.classList.add('mobile-hidden');
        if (myFleetTabBadge) myFleetTabBadge.classList.add('hidden');
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
        btn.addEventListener('click', () => {
            if (screenBattle.classList.contains('active')) {
                if (isBattleReviewMode) {
                    leaveToMainMenu();
                    return;
                }
                const desc = (gameMode === 'online')
                    ? 'Leaving this battle will forfeit the match to your opponent.'
                    : 'Are you sure you want to abandon the current battle?';

                showConfirmModal({
                    title: 'Leave Battle?',
                    desc: desc,
                    confirmText: 'Leave Match',
                    isDanger: true,
                    onConfirm: () => {
                        if (gameMode === 'online') {
                            sendOnlineData({ type: 'SURRENDER' });
                        }
                        leaveToMainMenu();
                    }
                });
            } else if (screenPlacement.classList.contains('active') && gameMode === 'online') {
                showConfirmModal({
                    title: 'Leave Room?',
                    desc: 'Are you sure you want to leave the multiplayer room?',
                    confirmText: 'Leave Room',
                    isDanger: true,
                    onConfirm: () => {
                        leaveToMainMenu();
                    }
                });
            } else {
                leaveToMainMenu();
            }
        });
    });

    async function leaveToMainMenu() {
        clearJoinTimeout();
        clearShotTimeout();
        clearUrlRoomParam();
        await leaveSupabaseRoom();
        player1Board.clear();
        player2Board.clear();
        rematchRequested = { me: false, opponent: false };
        onlineOpponentReady = false;
        isDisconnectHandled = false;
        myPlayerId = null;
        opponentPlayerId = null;
        isRoomLocked = false;
        hostInviteBar.classList.add('hidden');
        isBattleReviewMode = false;
        if (postGameReviewBar) postGameReviewBar.classList.add('hidden');
        if (enemyBattleGridEl) enemyBattleGridEl.classList.remove('battle-finished');
        if (btnSurrender) btnSurrender.classList.remove('hidden');
        if (turnSubtitle) turnSubtitle.classList.add('hidden');
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
                await sendOnlineData({ type: 'PLAYER_LEFT' });
                await gameChannel.untrack();
                await gameChannel.unsubscribe();
            } catch (e) {}
            gameChannel = null;
        }
        roomCode = null;
        myOnlineRole = null;
        isOnlineConnected = false;
        isDisconnectHandled = false;
        myPlayerId = null;
        opponentPlayerId = null;
        isRoomLocked = false;
    }

    async function sendOnlineData(payload) {
        if (gameChannel) {
            try {
                if (myPlayerId && !payload.senderId) {
                    payload.senderId = myPlayerId;
                }
                await gameChannel.send({
                    type: 'broadcast',
                    event: 'game-event',
                    payload
                });
            } catch (err) {
                console.error('Realtime broadcast error:', err);
            }
        }
    }

    function handleOnlineData(data) {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'JOINER_HELLO':
                if (myOnlineRole === 'host') {
                    // If room already has a locked opponent and another player tries to join
                    if (isRoomLocked && opponentPlayerId && opponentPlayerId !== data.playerId) {
                        sendOnlineData({
                            type: 'ROOM_FULL',
                            targetPlayerId: data.playerId,
                            reason: 'Room is already full'
                        });
                        return;
                    }

                    opponentPlayerId = data.playerId;
                    isRoomLocked = true;
                    showToast('Opponent connected', 'success');
                    sendOnlineData({
                        type: 'LOBBY_READY',
                        hostPlayerId: myPlayerId,
                        joinerPlayerId: opponentPlayerId
                    });
                    startOnlinePlacement();
                }
                break;

            case 'ROOM_FULL':
                if (myOnlineRole === 'joiner' && (!data.targetPlayerId || data.targetPlayerId === myPlayerId)) {
                    clearJoinTimeout();
                    showToast(data.reason || 'Room is already full', 'danger');
                    leaveToMainMenu();
                }
                break;

            case 'LOBBY_READY':
                if (myOnlineRole === 'joiner') {
                    if (data.joinerPlayerId && data.joinerPlayerId !== myPlayerId) {
                        return; // Ignore if destined for another player
                    }
                    opponentPlayerId = data.hostPlayerId;
                    clearJoinTimeout();
                    showToast('Connected', 'success');
                    startOnlinePlacement();
                }
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
                let result = player1Board.receiveShot(incomingIndex);

                // If already shot previously (idempotent retry from opponent due to dropped packet)
                if (!result) {
                    const existingShotStatus = player1Board.shots[incomingIndex];
                    if (existingShotStatus !== null) {
                        const existingShipId = player1Board.grid[incomingIndex];
                        const existingShip = existingShipId ? player1Board.ships.find(s => s.id === existingShipId) : null;
                        const isSunk = existingShip ? existingShip.isSunk : false;
                        const halo = (isSunk && existingShip) ? player1Board.getShipSurroundingHalo(existingShip) : [];

                        sendOnlineData({
                            type: 'SHOT_RESPONSE',
                            index: incomingIndex,
                            shotId: data.shotId || null,
                            result: isSunk ? 'sunk' : existingShotStatus,
                            shipName: existingShip ? existingShip.name : null,
                            shipCells: existingShip ? existingShip.cells : [],
                            shipType: existingShip ? existingShip.type : null,
                            shipSize: existingShip ? existingShip.size : 0,
                            halo: halo,
                            allSunk: player1Board.ships.every(s => s.isSunk)
                        });
                    }
                    return;
                }

                renderBattleBoards();

                if (wrapperMyFleet && wrapperMyFleet.classList.contains('mobile-hidden') && myFleetTabBadge) {
                    myFleetTabBadge.classList.remove('hidden');
                }

                const shipDef = result.ship ? FLEET_DEFINITIONS.find(d => d.type === result.ship.type) : null;
                const shipName = result.ship ? (result.ship.name || (shipDef ? shipDef.name : result.ship.type)) : null;

                // Respond with evaluation
                sendOnlineData({
                    type: 'SHOT_RESPONSE',
                    index: incomingIndex,
                    shotId: data.shotId || null,
                    result: result.result,
                    shipName: shipName,
                    shipCells: result.ship ? result.ship.cells : [],
                    shipType: result.ship ? result.ship.type : null,
                    shipSize: result.ship ? result.ship.size : 0,
                    halo: result.halo || [],
                    allSunk: result.allSunk
                });

                if (result.result === 'miss') {
                    sound.play('miss');
                    // Turn passes to us
                    activePlayer = (myOnlineRole === 'host') ? 1 : 2;
                    isShootingAllowed = true;
                    updateBattleUI();
                } else if (result.result === 'hit') {
                    sound.play('hit');
                    // Opponent keeps turn
                    updateBattleUI();
                } else if (result.result === 'sunk') {
                    sound.play('sunk');
                    if (shipName) {
                        showToast(`${shipName} lost!`, 'danger');
                    }
                    if (result.allSunk) {
                        handleGameOver(false);
                        return;
                    }
                    updateBattleUI();
                }
                break;
            }

            case 'SHOT_RESPONSE': {
                // Opponent evaluated our shot! Clear pending shot timeout
                clearShotTimeout();
                isShootingAllowed = true;
                const shotIdx = data.index;

                // Update opponent radar grid locally
                if (data.result === 'miss') {
                    sound.play('miss');
                    player2Board.shots[shotIdx] = 'miss';
                    player2Board.lastShotIndex = shotIdx;
                    // Turn passes to opponent
                    activePlayer = (myOnlineRole === 'host') ? 2 : 1;
                    updateBattleUI();
                } else if (data.result === 'hit') {
                    sound.play('hit');
                    battleStats.hits++;
                    player2Board.shots[shotIdx] = 'hit';
                    player2Board.lastShotIndex = shotIdx;
                    updateBattleUI();
                } else if (data.result === 'sunk') {
                    sound.play('sunk');
                    battleStats.hits++;
                    player2Board.lastShotIndex = shotIdx;

                    // Mark ALL decks of the sunken ship as 'sunk'
                    if (data.shipCells && Array.isArray(data.shipCells) && data.shipCells.length > 0) {
                        data.shipCells.forEach(cIdx => {
                            player2Board.shots[cIdx] = 'sunk';
                        });
                    } else {
                        player2Board.shots[shotIdx] = 'sunk';
                    }

                    // Mark sunken ship and surrounding halo
                    if (data.halo && Array.isArray(data.halo)) {
                        data.halo.forEach(hIdx => {
                            if (player2Board.shots[hIdx] === null) {
                                player2Board.shots[hIdx] = 'miss';
                            }
                        });
                    }

                    // Mark sunken ship in enemy fleet tracker
                    const targetSize = data.shipSize || (data.shipCells ? data.shipCells.length : 0);
                    const sunkShipPlaceholder = player2Board.ships.find(s => !s.isSunk && (s.type === data.shipType || s.size === targetSize));
                    if (sunkShipPlaceholder) {
                        sunkShipPlaceholder.isSunk = true;
                    }

                    if (data.shipName) {
                        showToast(`${data.shipName} sunk!`, 'success');
                    }

                    if (data.allSunk) {
                        handleGameOver(true);
                        return;
                    }

                    updateBattleUI();
                }

                renderBattleBoards();
                break;
            }

            case 'FLEET_REVEAL': {
                if (data.ships && Array.isArray(data.ships)) {
                    player2Board.ships = data.ships;
                    player2Board.grid.fill(null);
                    data.ships.forEach(ship => {
                        if (Array.isArray(ship.cells)) {
                            ship.cells.forEach(idx => {
                                player2Board.grid[idx] = ship.id || ship.type || 'ship';
                            });
                        }
                    });
                    renderBattleBoards();
                }
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
                    if (btnReviewRematchText) btnReviewRematchText.textContent = 'Accept Rematch';
                    showToast('Opponent requested rematch');
                }
                break;

            case 'SURRENDER':
                showToast('Opponent surrendered', 'success');
                handleGameOver(true);
                break;

            case 'PLAYER_LEFT':
                handleOpponentDisconnected('Opponent left the game');
                break;
        }
    }

    function handleOpponentDisconnected(reason = 'Opponent disconnected') {
        if (gameMode !== 'online' || !isOnlineConnected || isDisconnectHandled) return;
        isDisconnectHandled = true;

        showToast(reason, 'danger');

        // If host waiting in lobby before opponent ever joined
        if (screenWaiting.classList.contains('active')) {
            return;
        }

        // If match already concluded and reviewing battlefield
        if (isBattleReviewMode) {
            if (btnReviewRematch) btnReviewRematch.classList.add('hidden');
            return;
        }

        // If currently in battle arena
        if (screenBattle.classList.contains('active')) {
            handleGameOver(true, 'Victory', reason);
            if (btnReviewRematch) btnReviewRematch.classList.add('hidden');
            return;
        }

        // If in placement screen
        if (screenPlacement.classList.contains('active')) {
            setTimeout(() => {
                leaveToMainMenu();
            }, 1500);
            return;
        }
    }

    function startOnlinePlacement() {
        clearShotTimeout();
        player1Board.clear();
        player2Board.clear();
        onlineOpponentReady = false;
        rematchRequested = { me: false, opponent: false };
        placementPlayerTag.textContent = myOnlineRole === 'host' ? 'HOST' : 'GUEST';
        btnReadyBattle.disabled = true;
        btnReadyBattle.textContent = 'Start Game';
        isBattleReviewMode = false;
        if (postGameReviewBar) postGameReviewBar.classList.add('hidden');
        if (enemyBattleGridEl) enemyBattleGridEl.classList.remove('battle-finished');
        if (btnSurrender) btnSurrender.classList.remove('hidden');
        if (turnSubtitle) turnSubtitle.classList.add('hidden');
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
        myPlayerId = generatePlayerId('host');
        opponentPlayerId = null;
        isRoomLocked = false;
        displayRoomCode.textContent = roomCode;
        gameRoomCodeInput.value = '******';
        isCodeRevealed = false;
        isDisconnectHandled = false;

        const channelName = `sea-battle-room-${roomCode}`;
        gameChannel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: false, self: false },
                presence: { key: `host-${myPlayerId}` }
            }
        });

        gameChannel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
            handleOnlineData(payload);
        });

        gameChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            if (!leftPresences || !Array.isArray(leftPresences)) return;
            const opponentLeft = leftPresences.some(p => {
                if (opponentPlayerId) {
                    return p.playerId === opponentPlayerId;
                }
                return p.role && p.role !== 'host';
            });
            if (opponentLeft) {
                handleOpponentDisconnected('Opponent disconnected');
            }
        });

        gameChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                isOnlineConnected = true;
                await gameChannel.track({ role: 'host', playerId: myPlayerId });
                showScreen(screenWaiting);
                showToast('Room created');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                networkStatusBadge.classList.remove('connected');
                networkStatusText.textContent = 'Connection Error';
                showToast('Connection error', 'danger');
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
        myPlayerId = generatePlayerId('joiner');
        opponentPlayerId = null;
        isRoomLocked = false;
        isDisconnectHandled = false;
        const channelName = `sea-battle-room-${roomCode}`;

        gameChannel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: false, self: false },
                presence: { key: `joiner-${myPlayerId}` }
            }
        });

        gameChannel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
            handleOnlineData(payload);
        });

        gameChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            if (!leftPresences || !Array.isArray(leftPresences)) return;
            const opponentLeft = leftPresences.some(p => {
                if (opponentPlayerId) {
                    return p.playerId === opponentPlayerId;
                }
                return p.role && p.role !== 'joiner';
            });
            if (opponentLeft) {
                handleOpponentDisconnected('Opponent disconnected');
            }
        });

        gameChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                isOnlineConnected = true;
                await gameChannel.track({ role: 'joiner', playerId: myPlayerId });
                // Alert host with our unique playerId
                sendOnlineData({ type: 'JOINER_HELLO', playerId: myPlayerId });

                joinTimeout = setTimeout(() => {
                    showToast('Host not responding', 'danger');
                    leaveToMainMenu();
                }, 10000);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                networkStatusBadge.classList.remove('connected');
                networkStatusText.textContent = 'Connection Error';
                showToast('Connection error', 'danger');
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

    // Notify opponent if tab or window is closed during online game
    window.addEventListener('beforeunload', () => {
        if (gameMode === 'online' && gameChannel) {
            sendOnlineData({ type: 'PLAYER_LEFT' });
        }
    });

    // Check for direct join on launch
    const hasDirectJoin = checkUrlRoomParam();
    if (!hasDirectJoin) {
        showScreen(screenMenu);
    }
});
