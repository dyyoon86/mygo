/**
 * 바둑돌 사운드 매니저 (실제 오디오 파일 사용)
 */
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.stoneBuffer = null;
        this.loadSounds();
    }

    init() {
        if (this.initialized) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    async loadSounds() {
        try {
            const response = await fetch('sounds/stone_place.wav');
            const arrayBuffer = await response.arrayBuffer();
            this.init();
            if (this.audioContext) {
                this.stoneBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                console.log('바둑돌 소리 로드됨');
            }
        } catch (e) {
            console.warn('소리 파일 로드 실패, 합성음 사용');
        }
    }

    playStoneSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        if (this.stoneBuffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.stoneBuffer;
            const gain = this.audioContext.createGain();
            gain.gain.value = 1.0;
            source.connect(gain);
            gain.connect(this.audioContext.destination);
            source.start(0);
            return;
        }

        // 파일 로드 실패시 합성음 사용 (폴백)
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 0.15;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const impact = Math.exp(-t * 200) * 0.8;
            const woodResonance = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 30) * 0.3;
            const stoneClick = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 150) * 0.4;
            const harmonic = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 50) * 0.15;
            const noise = (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.1;
            data[i] = (impact * stoneClick + woodResonance + harmonic + noise) * 0.7;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
    }

    playInvalidSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.setValueAtTime(150, now + 0.1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playCaptureSound(count = 1) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const num = Math.min(count, 5);

        for (let i = 0; i < num; i++) {
            const delay = i * 0.06;
            const bufferSize = ctx.sampleRate * 0.025;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let j = 0; j < bufferSize; j++) {
                const t = j / ctx.sampleRate;
                const envelope = Math.exp(-t * 120);
                const click = Math.sin(2 * Math.PI * (800 + i * 100) * t);
                data[j] = click * envelope * 0.3;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = 0.4;
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(now + delay);
        }
    }
}

/**
 * 바둑 게임 메인 애플리케이션
 */
class BadukApp {
    constructor() {
        this.game = new BadukGame(19);
        this.ai = new BadukAI(this.game, 2);
        this.sgf = new SGFHandler();
        this.online = new BadukOnline(this.game);
        this.soundManager = new SoundManager();

        this.mode = 'local';

        this.settings = {
            soundEnabled: true,
            faceEnabled: true
        };

        // 개가 모드
        this.countingMode = false;
        this.deadStones = new Set();

        this.canvas = document.getElementById('board-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.cellSize = 30;
        this.padding = 25;
        this.stoneRadius = 13;
        this.lastMove = null;

        // 바둑판 색상
        this.boardColor = '#dcb35c';
        this.lineColor = '#2d2d2d';

        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.loadSettings();
        this.updateUI();
        this.render();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const isMobile = window.innerWidth <= 600;
        const maxSize = isMobile
            ? Math.min(window.innerWidth - 30, window.innerHeight - 200)
            : Math.min(window.innerWidth - 60, window.innerHeight - 160, 650);
        const size = this.game.size;

        this.cellSize = Math.floor((maxSize - this.padding * 2) / (size - 1));
        this.stoneRadius = Math.floor(this.cellSize * 0.45);

        const canvasSize = this.cellSize * (size - 1) + this.padding * 2;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;

        this.render();
    }

    bindEvents() {
        // 캔버스 이벤트 - 마우스
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('mouseleave', () => this.render());

        // 캔버스 이벤트 - 터치
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

        // 게임 컨트롤
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-pass').addEventListener('click', () => this.handlePass());
        document.getElementById('btn-count').addEventListener('click', () => this.toggleCountingMode());
        document.getElementById('btn-resign').addEventListener('click', () => this.handleResign());
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());

        // 설정 모달
        document.getElementById('close-settings-modal').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.closeSettingsModal();
            }
        });

        // 설정
        document.getElementById('board-size').addEventListener('change', (e) => {
            this.game.reset(parseInt(e.target.value));
            this.resizeCanvas();
            this.updateUI();
        });

        document.getElementById('game-mode').addEventListener('change', (e) => {
            this.mode = e.target.value;
            document.getElementById('ai-settings').style.display = e.target.value === 'ai' ? 'block' : 'none';
            this.newGame();
        });

        document.getElementById('ai-level').addEventListener('change', (e) => {
            this.ai.setLevel(parseInt(e.target.value));
        });

        document.getElementById('sound-enabled').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        const faceToggle = document.getElementById('face-enabled');
        if (faceToggle) {
            faceToggle.addEventListener('change', (e) => {
                this.settings.faceEnabled = e.target.checked;
                this.saveSettings();
                this.render();
            });
        }

        // 기보 저장/불러오기
        document.getElementById('btn-save').addEventListener('click', () => this.saveSGF());
        document.getElementById('btn-load').addEventListener('click', () => {
            document.getElementById('sgf-file-input').click();
        });
        document.getElementById('sgf-file-input').addEventListener('change', (e) => this.loadSGF(e));

        // 게임 종료 모달
        document.getElementById('btn-rematch').addEventListener('click', () => {
            this.closeGameOver();
            this.newGame();
        });
        document.getElementById('btn-close-gameover').addEventListener('click', () => this.closeGameOver());
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pos = this.canvasToBoard(x, y);

        if (!pos) return;

        // 개가 모드
        if (this.countingMode) {
            this.handleCountingClick(pos.x, pos.y);
            return;
        }

        if (this.game.gameOver) return;
        if (this.mode === 'ai' && this.ai.isMyTurn()) return;

        if (!this.game.isValidMove(pos.x, pos.y)) {
            if (this.settings.soundEnabled) {
                this.soundManager.playInvalidSound();
            }
            this.showToast('착수할 수 없는 위치입니다');
            return;
        }

        this.makeMove(pos.x, pos.y);
    }

    // 터치 이벤트 핸들러
    handleTouchStart(e) {
        e.preventDefault();
        this.touchStartPos = null;

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const pos = this.canvasToBoard(x, y);

            this.touchStartPos = pos;

            // 터치 시작 시 미리보기 표시
            this.render();
            if (pos && !this.game.gameOver && this.game.isValidMove(pos.x, pos.y)) {
                this.drawStonePreview(pos.x, pos.y);
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const pos = this.canvasToBoard(x, y);

            // 손가락을 따라 돌 미리보기 이동
            this.render();
            if (pos && !this.game.gameOver && this.game.isValidMove(pos.x, pos.y)) {
                this.drawStonePreview(pos.x, pos.y);
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const pos = this.canvasToBoard(x, y);

            this.render();

            if (!pos) return;

            // 개가 모드
            if (this.countingMode) {
                this.handleCountingClick(pos.x, pos.y);
                return;
            }

            if (this.game.gameOver) return;
            if (this.mode === 'ai' && this.ai.isMyTurn()) return;

            if (!this.game.isValidMove(pos.x, pos.y)) {
                if (this.settings.soundEnabled) {
                    this.soundManager.playInvalidSound();
                }
                this.showToast('착수할 수 없는 위치입니다');
                return;
            }

            this.makeMove(pos.x, pos.y);
        }
    }

    handleCanvasHover(e) {
        if (this.game.gameOver) return;
        if (this.mode === 'ai' && this.ai.isMyTurn()) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pos = this.canvasToBoard(x, y);

        this.render();

        if (pos && this.game.isValidMove(pos.x, pos.y)) {
            this.drawStonePreview(pos.x, pos.y);
        }
    }

    canvasToBoard(canvasX, canvasY) {
        const x = Math.round((canvasX - this.padding) / this.cellSize);
        const y = Math.round((canvasY - this.padding) / this.cellSize);

        if (x < 0 || x >= this.game.size || y < 0 || y >= this.game.size) {
            return null;
        }
        return { x, y };
    }

    boardToCanvas(x, y) {
        return {
            x: this.padding + x * this.cellSize,
            y: this.padding + y * this.cellSize
        };
    }

    makeMove(x, y) {
        const result = this.game.placeStone(x, y);

        if (result.success) {
            this.lastMove = { x, y };

            if (this.settings.soundEnabled) {
                this.soundManager.playStoneSound();
            }

            if (result.captured && result.captured.length > 0) {
                setTimeout(() => {
                    if (this.settings.soundEnabled) {
                        this.soundManager.playCaptureSound(result.captured.length);
                    }
                }, 100);
            }

            this.updateUI();
            this.render();

            if (this.mode === 'ai' && !this.game.gameOver && this.ai.isMyTurn()) {
                this.aiMove();
            }

            if (this.game.gameOver) {
                this.showGameOver();
            }
        }
    }

    async aiMove() {
        if (this.game.gameOver) return;

        const move = await this.ai.getNextMove();

        if (move) {
            if (move.pass) {
                this.handlePass(true);
            } else {
                this.makeMove(move.x, move.y);
            }
        }
    }

    handlePass(isAI = false) {
        if (this.game.gameOver) return;

        const result = this.game.pass();

        if (result.success) {
            this.updateUI();
            this.showToast(`${this.game.currentPlayer === 'black' ? '백' : '흑'} 패스`);

            if (result.gameOver) {
                this.showGameOver();
            } else if (this.mode === 'ai' && !isAI && this.ai.isMyTurn()) {
                this.aiMove();
            }
        }
    }

    handleUndo() {
        if (this.game.moveHistory.length === 0) return;

        const undoTwice = this.mode === 'ai';
        const result = this.game.undo();

        if (result.success) {
            this.lastMove = this.getLastMoveFromHistory();
            this.updateUI();
            this.render();

            if (undoTwice && this.game.moveHistory.length > 0) {
                this.game.undo();
                this.lastMove = this.getLastMoveFromHistory();
                this.updateUI();
                this.render();
            }
        }
    }

    handleResign() {
        if (this.game.gameOver) return;

        const currentPlayer = this.game.currentPlayer === 'black' ? '흑' : '백';
        if (!confirm(`${currentPlayer}이(가) 기권하시겠습니까?`)) return;

        const result = this.game.resign();
        const winner = result.winner === 'black' ? '흑' : '백';
        this.showGameOver(`${winner} 불계승 (기권)`);
    }

    getLastMoveFromHistory() {
        const history = this.game.moveHistory;
        for (let i = history.length - 1; i >= 0; i--) {
            if (!history[i].pass) {
                return { x: history[i].x, y: history[i].y };
            }
        }
        return null;
    }

    newGame() {
        // 커튼 이펙트 시작
        this.playCurtainEffect(() => {
            const size = parseInt(document.getElementById('board-size').value);
            this.game.reset(size);
            this.lastMove = null;

            this.countingMode = false;
            this.deadStones.clear();
            const countBtn = document.getElementById('btn-count');
            countBtn.classList.remove('active');
            countBtn.textContent = '개가';

            this.resizeCanvas();
            this.updateUI();

            if (this.mode === 'ai' && this.ai.color === 'black') {
                setTimeout(() => this.aiMove(), 500);
            }
        });
    }

    playCurtainEffect(callback) {
        const overlay = document.getElementById('curtain-overlay');
        if (!overlay) {
            if (callback) callback();
            return;
        }

        // 초기화
        overlay.classList.remove('show-text');

        // 커튼 닫기 시작
        overlay.classList.add('active', 'closing');

        // 커튼이 완전히 닫힌 후 텍스트 표시 (600ms 후)
        setTimeout(() => {
            overlay.classList.add('show-text');
        }, 500);

        // 게임 리셋 실행 (800ms 후)
        setTimeout(() => {
            if (callback) callback();
        }, 700);

        // 텍스트 숨기기 (1200ms 후)
        setTimeout(() => {
            overlay.classList.remove('show-text');
        }, 1100);

        // 커튼 열기 시작 (1300ms 후)
        setTimeout(() => {
            overlay.classList.remove('closing');
        }, 1200);

        // 완전 종료 (1900ms 후)
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 1800);
    }

    // 렌더링
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoard();
        this.drawStones();

        if (this.lastMove) {
            this.drawLastMoveMarker(this.lastMove.x, this.lastMove.y);
        }

        if (this.countingMode) {
            this.drawDeadStones();
            this.drawTerritory();
        }
    }

    drawBoard() {
        const ctx = this.ctx;
        const size = this.game.size;

        // 배경
        ctx.fillStyle = this.boardColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 격자
        ctx.strokeStyle = this.lineColor;
        ctx.lineWidth = 1;

        for (let i = 0; i < size; i++) {
            const pos = this.padding + i * this.cellSize;

            ctx.beginPath();
            ctx.moveTo(pos, this.padding);
            ctx.lineTo(pos, this.padding + (size - 1) * this.cellSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.padding, pos);
            ctx.lineTo(this.padding + (size - 1) * this.cellSize, pos);
            ctx.stroke();
        }

        this.drawStarPoints();
        this.drawCoordinates();
    }

    drawStarPoints() {
        const ctx = this.ctx;
        const size = this.game.size;

        let points = [];
        if (size === 19) {
            points = [[3,3], [3,9], [3,15], [9,3], [9,9], [9,15], [15,3], [15,9], [15,15]];
        } else if (size === 13) {
            points = [[3,3], [3,9], [6,6], [9,3], [9,9]];
        } else if (size === 9) {
            points = [[2,2], [2,6], [4,4], [6,2], [6,6]];
        }

        ctx.fillStyle = this.lineColor;

        for (const [x, y] of points) {
            const pos = this.boardToCanvas(x, y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawCoordinates() {
        const ctx = this.ctx;
        const size = this.game.size;

        ctx.fillStyle = this.lineColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const letters = 'ABCDEFGHJKLMNOPQRST';

        for (let i = 0; i < size; i++) {
            const pos = this.padding + i * this.cellSize;
            ctx.fillText(letters[i], pos, 8);
            ctx.fillText(letters[i], pos, this.canvas.height - 8);
            ctx.fillText(String(size - i), 8, pos);
            ctx.fillText(String(size - i), this.canvas.width - 8, pos);
        }
    }

    drawStones() {
        const board = this.game.board;
        const size = this.game.size;
        const face = this.settings.faceEnabled;

        if (face) {
            // === ぷに碁 스타일 (PuyoGo 레퍼런스) ===
            const ctx = this.ctx;
            const r = this.stoneRadius;
            const bw = Math.max(1.5, r * 0.08); // 테두리 두께
            const mergeR = r * 0.75; // 합체 연결 원 반지름

            // 1) 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const c = board[x][y];
                    if (!c) continue;
                    const pos = this.boardToCanvas(x, y);
                    // 연결부 그림자
                    if (x + 1 < size && board[x + 1][y] === c) {
                        const p2 = this.boardToCanvas(x + 1, y);
                        ctx.beginPath();
                        ctx.arc((pos.x + p2.x) / 2 + 2, pos.y + 2, mergeR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    if (y + 1 < size && board[x][y + 1] === c) {
                        const p2 = this.boardToCanvas(x, y + 1);
                        ctx.beginPath();
                        ctx.arc(pos.x + 2, (pos.y + p2.y) / 2 + 2, mergeR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // 돌 그림자
                    ctx.beginPath();
                    ctx.arc(pos.x + 2, pos.y + 2, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 2) 테두리 + 채우기 (색상별 — 더블서클 기법)
            for (const color of ['white', 'black']) {
                const outColor = color === 'black' ? '#222' : '#aaa';
                const fillColor = color === 'black' ? '#4a4a4a' : '#f0f0f0';

                // 2a) 테두리 레이어 (큰 원)
                ctx.fillStyle = outColor;
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        if (board[x][y] !== color) continue;
                        const pos = this.boardToCanvas(x, y);
                        if (x + 1 < size && board[x + 1][y] === color) {
                            const p2 = this.boardToCanvas(x + 1, y);
                            ctx.beginPath();
                            ctx.arc((pos.x + p2.x) / 2, pos.y, mergeR, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        if (y + 1 < size && board[x][y + 1] === color) {
                            const p2 = this.boardToCanvas(x, y + 1);
                            ctx.beginPath();
                            ctx.arc(pos.x, (pos.y + p2.y) / 2, mergeR, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // 2b) 채우기 레이어 (작은 원 — 테두리 위에 덮어서 외곽선만 남김)
                ctx.fillStyle = fillColor;
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        if (board[x][y] !== color) continue;
                        const pos = this.boardToCanvas(x, y);
                        if (x + 1 < size && board[x + 1][y] === color) {
                            const p2 = this.boardToCanvas(x + 1, y);
                            ctx.beginPath();
                            ctx.arc((pos.x + p2.x) / 2, pos.y, mergeR - bw, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        if (y + 1 < size && board[x][y + 1] === color) {
                            const p2 = this.boardToCanvas(x, y + 1);
                            ctx.beginPath();
                            ctx.arc(pos.x, (pos.y + p2.y) / 2, mergeR - bw, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, r - bw, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // 3) 표정 — 모든 돌에 (ぷに碁: 돌마다 얼굴)
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const c = board[x][y];
                    if (!c) continue;
                    const state = this.getStoneState(x, y);
                    if (state) {
                        const pos = this.boardToCanvas(x, y);
                        this.drawFace(pos, c, state);
                    }
                }
            }
        } else {
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if (board[x][y]) this.drawStone(x, y, board[x][y]);
                }
            }
        }
    }

    // 그룹 찾기 (BFS)
    _getGroup(sx, sy) {
        const color = this.game.board[sx][sy];
        const group = [];
        const visited = new Set();
        const stack = [{x: sx, y: sy}];
        while (stack.length) {
            const {x, y} = stack.pop();
            const k = `${x},${y}`;
            if (visited.has(k)) continue;
            visited.add(k);
            if (this.game.board[x][y] === color) {
                group.push({x, y});
                for (const [nx, ny] of this.game.getNeighbors(x, y)) {
                    if (!visited.has(`${nx},${ny}`)) stack.push({x: nx, y: ny});
                }
            }
        }
        return group;
    }

    // 대각선 — 손잡기 느낌 (작은 손 + 연결 팔)
    _drawHandhold(x1, y1, x2, y2, color) {
        const ctx = this.ctx;
        const r = this.stoneRadius;
        const p1 = this.boardToCanvas(x1, y1);
        const p2 = this.boardToCanvas(x2, y2);

        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / dist, ny = dy / dist;

        // 돌 가장자리에서 시작
        const sx = p1.x + nx * r * 0.85, sy = p1.y + ny * r * 0.85;
        const ex = p2.x - nx * r * 0.85, ey = p2.y - ny * r * 0.85;
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;

        const isBlack = color === 'black';

        // 팔 (살짝 곡선)
        ctx.save();
        ctx.strokeStyle = isBlack ? 'rgba(30,30,30,0.5)' : 'rgba(220,220,220,0.65)';
        ctx.lineWidth = r * 0.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx - ny * r * 0.15, my + nx * r * 0.15, ex, ey);
        ctx.stroke();
        ctx.restore();

        // 손 (양쪽 끝에 동글이)
        const handR = r * 0.22;
        ctx.fillStyle = isBlack ? 'rgba(50,50,50,0.7)' : 'rgba(240,240,240,0.8)';
        ctx.beginPath();
        ctx.arc(sx, sy, handR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, ey, handR, 0, Math.PI * 2);
        ctx.fill();

        // 잡은 부분 (중간에 하트/볼록)
        ctx.fillStyle = isBlack ? 'rgba(50,50,50,0.55)' : 'rgba(235,235,235,0.7)';
        ctx.beginPath();
        ctx.arc(mx, my, handR * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    // 끈적 연결선 (날일자 — 한 칸 떨어진 돌)
    _drawStickyLine(bx1, by1, bx2, by2, color) {
        const ctx = this.ctx;
        const r = this.stoneRadius;
        const p1 = this.boardToCanvas(bx1, by1);
        const p2 = this.boardToCanvas(bx2, by2);
        const isHoriz = bx1 !== bx2;

        const x1 = isHoriz ? p1.x + r : p1.x;
        const y1 = isHoriz ? p1.y : p1.y + r;
        const x2 = isHoriz ? p2.x - r : p2.x;
        const y2 = isHoriz ? p2.y : p2.y - r;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const sagX = isHoriz ? 0 : r * 0.18;
        const sagY = isHoriz ? r * 0.18 : 0;

        const isBlack = color === 'black';

        // 바깥 번짐
        ctx.save();
        ctx.strokeStyle = isBlack ? 'rgba(20,20,20,0.35)' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth = r * 0.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx + sagX, my + sagY, x2, y2);
        ctx.stroke();
        ctx.restore();
        // 코어
        ctx.save();
        ctx.strokeStyle = isBlack ? 'rgba(10,10,10,0.65)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = r * 0.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx + sagX, my + sagY, x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    // 뿌요뿌요 스타일 블롭 브릿지 (유기적 연결)
    _drawPuyoBridge(p1x, p1y, p2x, p2y, r, isVertical) {
        const ctx = this.ctx;
        const squeeze = r * 0.15;

        ctx.beginPath();
        if (!isVertical) {
            // 가로 연결 — 중간이 잘록한 블롭
            const mx = (p1x + p2x) / 2;
            ctx.moveTo(p1x, p1y - r);
            ctx.quadraticCurveTo(mx, p1y - r + squeeze, p2x, p2y - r);
            ctx.lineTo(p2x, p2y + r);
            ctx.quadraticCurveTo(mx, p1y + r - squeeze, p1x, p1y + r);
        } else {
            // 세로 연결 — 중간이 잘록한 블롭
            const my = (p1y + p2y) / 2;
            ctx.moveTo(p1x - r, p1y);
            ctx.quadraticCurveTo(p1x - r + squeeze, my, p2x - r, p2y);
            ctx.lineTo(p2x + r, p2y);
            ctx.quadraticCurveTo(p1x + r - squeeze, my, p1x + r, p1y);
        }
        ctx.closePath();
        ctx.fill();
    }

    // 돌 본체만 (그림자 없이)
    _drawStoneBody(x, y, color) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);
        const gradient = ctx.createRadialGradient(
            pos.x - this.stoneRadius * 0.3,
            pos.y - this.stoneRadius * 0.3,
            this.stoneRadius * 0.1,
            pos.x, pos.y, this.stoneRadius
        );
        if (color === 'black') {
            gradient.addColorStop(0, '#4a4a4a');
            gradient.addColorStop(1, '#1a1a1a');
        } else {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#d0d0d0');
        }
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.stoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    drawStone(x, y, color) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);

        // 그림자
        ctx.beginPath();
        ctx.arc(pos.x + 2, pos.y + 2, this.stoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 돌
        const gradient = ctx.createRadialGradient(
            pos.x - this.stoneRadius * 0.3,
            pos.y - this.stoneRadius * 0.3,
            this.stoneRadius * 0.1,
            pos.x,
            pos.y,
            this.stoneRadius
        );

        if (color === 'black') {
            gradient.addColorStop(0, '#4a4a4a');
            gradient.addColorStop(1, '#1a1a1a');
        } else {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#d0d0d0');
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.stoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    // 돌 상태 분석: 활로 수 기반 표정 결정
    getStoneState(x, y) {
        const stone = this.game.board[x][y];
        if (!stone) return null;

        const isLast = this.lastMove && this.lastMove.x === x && this.lastMove.y === y;
        if (isLast) return 'confident';

        const liberties = this.game.countLiberties(x, y);
        const groupSize = this.game.getGroupSize(x, y);

        if (liberties === 1) return 'panic';       // 단수! 위험
        if (liberties === 2) return 'worried';      // 불안
        if (liberties >= 4 || groupSize >= 5) return 'happy'; // 안전+대그룹
        return 'calm';                              // 보통
    }

    // 돌 위에 표정 그리기
    drawFace(pos, color, state) {
        const ctx = this.ctx;
        const r = this.stoneRadius;
        const faceColor = color === 'black' ? '#fff' : '#222';
        const blushColor = color === 'black' ? 'rgba(255,150,150,0.4)' : 'rgba(255,100,100,0.35)';

        ctx.save();
        ctx.translate(pos.x, pos.y);

        switch (state) {
            case 'happy':
                this._drawHappyFace(ctx, r, faceColor, blushColor);
                break;
            case 'calm':
                this._drawCalmFace(ctx, r, faceColor);
                break;
            case 'worried':
                this._drawWorriedFace(ctx, r, faceColor);
                break;
            case 'panic':
                this._drawPanicFace(ctx, r, faceColor, blushColor);
                break;
            case 'confident':
                this._drawConfidentFace(ctx, r, faceColor);
                break;
        }

        ctx.restore();
    }

    // 😊 행복 (활로 4+, 대그룹)
    _drawHappyFace(ctx, r, fc, blush) {
        const s = r * 0.22;
        // 눈 (^ ^) 아치형
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.5, r * 0.1);
        ctx.lineCap = 'round';
        // 왼쪽 눈
        ctx.beginPath();
        ctx.arc(-s * 1.2, -s * 0.3, s * 0.7, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        // 오른쪽 눈
        ctx.beginPath();
        ctx.arc(s * 1.2, -s * 0.3, s * 0.7, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        // 볼터치
        ctx.fillStyle = blush;
        ctx.beginPath();
        ctx.ellipse(-s * 2, s * 0.6, s * 0.7, s * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 2, s * 0.6, s * 0.7, s * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // 입 (큰 미소)
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.5, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, s * 0.3, s * 1.1, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
    }

    // 😐 평온 (활로 2~3)
    _drawCalmFace(ctx, r, fc) {
        const s = r * 0.22;
        // 눈 (· ·) 점
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(-s * 1.2, -s * 0.2, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 1.2, -s * 0.2, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // 입 (일자)
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, s * 0.9);
        ctx.lineTo(s * 0.8, s * 0.9);
        ctx.stroke();
    }

    // 😟 불안 (활로 2)
    _drawWorriedFace(ctx, r, fc) {
        const s = r * 0.22;
        // 눈 (;_;) 큰 눈
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(-s * 1.2, -s * 0.2, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 1.2, -s * 0.2, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // 눈썹 (걱정)
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.2, r * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 2, -s * 1.3);
        ctx.lineTo(-s * 0.5, -s * 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 2, -s * 1.3);
        ctx.lineTo(s * 0.5, -s * 1);
        ctx.stroke();
        // 입 (물결)
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, s * 0.9);
        ctx.quadraticCurveTo(-s * 0.3, s * 1.3, 0, s * 0.8);
        ctx.quadraticCurveTo(s * 0.3, s * 0.4, s * 0.8, s * 0.9);
        ctx.stroke();
    }

    // 😱 공포 (단수! 활로 1)
    _drawPanicFace(ctx, r, fc, blush) {
        const s = r * 0.22;
        // 눈 (O O) 크게 뜬 눈
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.5, r * 0.09);
        ctx.beginPath();
        ctx.arc(-s * 1.2, -s * 0.2, s * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 1.2, -s * 0.2, s * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        // 눈동자
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(-s * 1.2, -s * 0.1, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 1.2, -s * 0.1, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // 땀방울
        ctx.fillStyle = blush;
        ctx.beginPath();
        ctx.ellipse(s * 2.3, -s * 0.5, s * 0.3, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // 입 (O)
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.2, r * 0.08);
        ctx.beginPath();
        ctx.ellipse(0, s * 1, s * 0.5, s * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 😎 자신감 (방금 착수)
    _drawConfidentFace(ctx, r, fc) {
        const s = r * 0.22;
        // 눈 (- -) 여유 있는 반감은 눈
        ctx.strokeStyle = fc;
        ctx.lineWidth = Math.max(1.8, r * 0.11);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 1.8, -s * 0.3);
        ctx.lineTo(-s * 0.5, -s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.3);
        ctx.lineTo(s * 1.8, -s * 0.3);
        ctx.stroke();
        // 입 (씩 웃는 미소)
        ctx.lineWidth = Math.max(1.5, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, s * 0.2, s * 1, Math.PI * 0.1, Math.PI * 0.6);
        ctx.stroke();
    }

    drawStonePreview(x, y) {
        const ctx = this.ctx;
        const color = this.game.currentPlayer;

        ctx.globalAlpha = 0.5;
        this.drawStone(x, y, color);
        ctx.globalAlpha = 1;
    }

    drawLastMoveMarker(x, y) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);
        const stone = this.game.board[x][y];

        ctx.strokeStyle = stone === 'black' ? '#fff' : '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.stoneRadius * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawDeadStones() {
        const ctx = this.ctx;

        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const pos = this.boardToCanvas(x, y);

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            const size = this.stoneRadius * 0.6;

            ctx.beginPath();
            ctx.moveTo(pos.x - size, pos.y - size);
            ctx.lineTo(pos.x + size, pos.y + size);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pos.x + size, pos.y - size);
            ctx.lineTo(pos.x - size, pos.y + size);
            ctx.stroke();
        });
    }

    drawTerritory() {
        const tempBoard = this.game.copyBoard();
        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            tempBoard[x][y] = null;
        });

        const visited = new Set();

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (tempBoard[x][y] === null && !visited.has(`${x},${y}`)) {
                    const result = this.floodFillTerritoryOnBoard(tempBoard, x, y, visited);
                    if (result.owner) {
                        result.area.forEach(pos => {
                            this.drawTerritoryMark(pos.x, pos.y, result.owner);
                        });
                    }
                }
            }
        }
    }

    drawTerritoryMark(x, y, owner) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);
        const size = this.cellSize * 0.2;

        ctx.fillStyle = owner === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
        ctx.fillRect(pos.x - size, pos.y - size, size * 2, size * 2);

        if (owner === 'white') {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x - size, pos.y - size, size * 2, size * 2);
        }
    }

    // UI 업데이트
    updateUI() {
        document.getElementById('black-captures').textContent = this.game.captures.black;
        document.getElementById('white-captures').textContent = this.game.captures.white;
        document.getElementById('move-count').textContent = this.game.moveHistory.length;

        const turnStone = document.getElementById('turn-stone');
        const turnText = document.getElementById('turn-text');

        turnStone.className = 'turn-stone ' + this.game.currentPlayer;
        turnText.textContent = this.game.currentPlayer === 'black' ? '흑 차례' : '백 차례';
    }

    // 모달
    openSettingsModal() {
        document.getElementById('settings-modal').classList.add('show');
    }

    closeSettingsModal() {
        document.getElementById('settings-modal').classList.remove('show');
    }

    showGameOver(message = null) {
        const modal = document.getElementById('gameover-modal');
        const msgEl = document.getElementById('gameover-message');
        const score = this.game.calculateScore();

        document.getElementById('black-score').textContent = score.black.toFixed(1);
        document.getElementById('white-score').textContent = score.white.toFixed(1);

        if (message) {
            msgEl.textContent = message;
        } else {
            const winner = score.black > score.white ? '흑' : '백';
            const diff = Math.abs(score.black - score.white).toFixed(1);
            msgEl.textContent = `${winner} ${diff}집 승!`;
        }

        modal.classList.add('show');
    }

    closeGameOver() {
        document.getElementById('gameover-modal').classList.remove('show');
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // SGF
    saveSGF() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        this.sgf.downloadSGF(this.game, `baduk_${date}.sgf`);
        this.showToast('기보 저장 완료');
    }

    async loadSGF(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const sgfData = await this.sgf.loadSGFFile(file);
            this.sgf.applyToGame(this.game, sgfData);

            document.getElementById('board-size').value = sgfData.size;

            this.lastMove = this.getLastMoveFromHistory();
            this.resizeCanvas();
            this.updateUI();

            this.showToast('기보 불러오기 완료');
        } catch (e) {
            this.showToast('기보 파일을 읽을 수 없습니다');
            console.error(e);
        }

        event.target.value = '';
    }

    // 개가 모드
    toggleCountingMode() {
        this.countingMode = !this.countingMode;
        const btn = document.getElementById('btn-count');

        if (this.countingMode) {
            btn.classList.add('active');
            btn.textContent = '확정';
            this.deadStones.clear();
            this.showToast('사석을 클릭하여 표시하세요');
        } else {
            btn.classList.remove('active');
            btn.textContent = '개가';
            this.showCountingResult();
        }
        this.render();
    }

    handleCountingClick(x, y) {
        const stone = this.game.board[x][y];
        if (!stone) return;

        const key = `${x},${y}`;
        const group = this.getStoneGroup(x, y);

        const isCurrentlyDead = this.deadStones.has(key);
        group.forEach(pos => {
            const k = `${pos.x},${pos.y}`;
            if (isCurrentlyDead) {
                this.deadStones.delete(k);
            } else {
                this.deadStones.add(k);
            }
        });

        if (this.settings.soundEnabled) {
            this.soundManager.playStoneSound();
        }
        this.render();
    }

    getStoneGroup(x, y) {
        const color = this.game.board[x][y];
        if (!color) return [];

        const group = [];
        const visited = new Set();
        const stack = [{ x, y }];

        while (stack.length > 0) {
            const pos = stack.pop();
            const key = `${pos.x},${pos.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (this.game.board[pos.x][pos.y] === color) {
                group.push(pos);
                const neighbors = this.game.getNeighbors(pos.x, pos.y);
                for (const [nx, ny] of neighbors) {
                    if (!visited.has(`${nx},${ny}`)) {
                        stack.push({ x: nx, y: ny });
                    }
                }
            }
        }

        return group;
    }

    showCountingResult() {
        const tempBoard = this.game.copyBoard();
        const tempCaptures = { ...this.game.captures };

        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const color = tempBoard[x][y];
            if (color) {
                const opponent = color === 'black' ? 'white' : 'black';
                tempCaptures[opponent]++;
                tempBoard[x][y] = null;
            }
        });

        const territory = this.calculateTerritoryOnBoard(tempBoard);
        const komi = 6.5;
        const blackScore = territory.black + tempCaptures.black;
        const whiteScore = territory.white + tempCaptures.white + komi;

        const winner = blackScore > whiteScore ? '흑' : '백';
        const diff = Math.abs(blackScore - whiteScore).toFixed(1);

        document.getElementById('black-score').textContent = blackScore.toFixed(1);
        document.getElementById('white-score').textContent = whiteScore.toFixed(1);
        document.getElementById('gameover-message').textContent = `${winner} ${diff}집 승!`;
        document.getElementById('gameover-modal').classList.add('show');

        this.game.gameOver = true;
    }

    calculateTerritoryOnBoard(board) {
        const territory = { black: 0, white: 0 };
        const visited = new Set();

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (board[x][y] === null && !visited.has(`${x},${y}`)) {
                    const result = this.floodFillTerritoryOnBoard(board, x, y, visited);
                    if (result.owner === 'black') {
                        territory.black += result.size;
                    } else if (result.owner === 'white') {
                        territory.white += result.size;
                    }
                }
            }
        }

        return territory;
    }

    floodFillTerritoryOnBoard(board, startX, startY, visited) {
        const stack = [{ x: startX, y: startY }];
        const area = [];
        let touchesBlack = false;
        let touchesWhite = false;

        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (board[x][y] === null) {
                area.push({ x, y });
                const neighbors = this.game.getNeighbors(x, y);
                for (const [nx, ny] of neighbors) {
                    if (!visited.has(`${nx},${ny}`)) {
                        stack.push({ x: nx, y: ny });
                    }
                }
            } else if (board[x][y] === 'black') {
                touchesBlack = true;
            } else if (board[x][y] === 'white') {
                touchesWhite = true;
            }
        }

        let owner = null;
        if (touchesBlack && !touchesWhite) owner = 'black';
        else if (touchesWhite && !touchesBlack) owner = 'white';

        return { size: area.length, owner, area };
    }

    // 설정 저장/불러오기
    saveSettings() {
        const data = {
            soundEnabled: this.settings.soundEnabled,
            faceEnabled: this.settings.faceEnabled
        };
        localStorage.setItem('baduk_settings', JSON.stringify(data));
    }

    loadSettings() {
        const saved = localStorage.getItem('baduk_settings');
        if (saved) {
            const data = JSON.parse(saved);
            this.settings.soundEnabled = data.soundEnabled ?? true;
            this.settings.faceEnabled = data.faceEnabled ?? true;
            document.getElementById('sound-enabled').checked = this.settings.soundEnabled;
            const faceEl = document.getElementById('face-enabled');
            if (faceEl) faceEl.checked = this.settings.faceEnabled;
        }
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BadukApp();
});
