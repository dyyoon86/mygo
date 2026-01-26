/**
 * 바둑돌 사운드 매니저 (Web Audio API)
 */
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
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

    playStoneSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // 실제 바둑돌 "탁!" 소리 - 짧은 임팩트
        const duration = 0.06;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            // 매우 빠른 어택과 감쇠
            const attack = Math.min(1, t * 500);
            const decay = Math.exp(-t * 100);
            const envelope = attack * decay;
            // 돌 부딪히는 임팩트 주파수 (중저음)
            const impact = Math.sin(2 * Math.PI * 180 * t) * 0.4;
            const click = Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 300) * 0.6;
            data[i] = (impact + click) * envelope;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.value = 0.8;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
    }

    playInvalidSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // 경고 비프음
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

    playBreakSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // 깨지는 소리
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const envelope = Math.exp(-t * 15);
            const noise = (Math.random() * 2 - 1);
            const crackle = Math.sin(2 * Math.PI * (800 + Math.random() * 400) * t);
            data[i] = (noise * 0.5 + crackle * 0.5) * envelope * 0.4;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(now);
    }

    playCaptureSound(count = 1) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const num = Math.min(count, 5);

        // 각 돌마다 경쾌한 클릭 소리
        for (let i = 0; i < num; i++) {
            const delay = i * 0.06;

            // 짧은 클릭 버퍼 생성
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

        // 마지막에 그릇에 담기는 소리
        const bufferSize = ctx.sampleRate * 0.08;
        const bowlBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const bowlData = bowlBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const envelope = Math.exp(-t * 40);
            const tone = Math.sin(2 * Math.PI * 600 * t) * 0.3 +
                        Math.sin(2 * Math.PI * 900 * t) * 0.2;
            bowlData[i] = tone * envelope;
        }

        const bowlSource = ctx.createBufferSource();
        bowlSource.buffer = bowlBuffer;

        const bowlGain = ctx.createGain();
        bowlGain.gain.value = 0.3;

        bowlSource.connect(bowlGain);
        bowlGain.connect(ctx.destination);
        bowlSource.start(now + num * 0.06 + 0.03);
    }

    playJarSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // 항아리 두드리는 소리
        for (let i = 0; i < 3; i++) {
            const delay = i * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600 + i * 100, now + delay);
            osc.frequency.exponentialRampToValueAtTime(300, now + delay + 0.1);
            gain.gain.setValueAtTime(0.1, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.12);
        }
    }
}

/**
 * 프리미엄 보드 시스템
 */
const BOARD_SKINS = [
    { id: 'classic', name: '클래식', price: 0, unlocked: true, boardColor: '#dcb35c', lineColor: '#2d2d2d' },
    { id: 'jade', name: '비취', price: 0, unlocked: true, boardColor: '#3cb371', lineColor: '#1a3a2a' },
    { id: 'dragon', name: '용의 둥지', price: 2900, unlocked: false, boardColor: '#cd5c5c', lineColor: '#4a1a1a' },
    { id: 'celestial', name: '천상계', price: 3900, unlocked: false, boardColor: '#6495ed', lineColor: '#1a1a4a' },
    { id: 'golden', name: '황금', price: 4900, unlocked: false, boardColor: '#ffd700', lineColor: '#4a4a1a' },
];

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
        this.currentSkin = 'classic';

        this.settings = {
            soundEnabled: true
        };

        // 개가(계가) 모드
        this.countingMode = false;
        this.deadStones = new Set(); // 사석 표시

        this.canvas = document.getElementById('board-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.cellSize = 30;
        this.padding = 25;
        this.stoneRadius = 13;
        this.lastMove = null;

        // 따낸 돌 시각화용
        this.capturedStonesBlack = 0;
        this.capturedStonesWhite = 0;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.loadSettings();
        this.renderBoardSkins();
        this.updateUI();
        this.render();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const isMobile = window.innerWidth <= 700;
        const maxSize = isMobile
            ? Math.min(window.innerWidth - 50, window.innerHeight - 200)
            : Math.min(window.innerWidth - 300, window.innerHeight - 250, 550);
        const size = this.game.size;

        this.cellSize = Math.floor((maxSize - this.padding * 2) / (size - 1));
        this.stoneRadius = Math.floor(this.cellSize * 0.45);

        const canvasSize = this.cellSize * (size - 1) + this.padding * 2;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;

        this.render();
    }

    bindEvents() {
        // 캔버스 이벤트
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('mouseleave', () => this.render());

        // 게임 컨트롤
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-pass').addEventListener('click', () => this.handlePass());
        document.getElementById('btn-count').addEventListener('click', () => this.toggleCountingMode());
        document.getElementById('btn-resign').addEventListener('click', () => this.handleResign());

        // 사이드 패널
        document.getElementById('btn-boards').addEventListener('click', () => this.openBoardModal());
        document.getElementById('btn-settings').addEventListener('click', () => this.toggleSettings());
        document.getElementById('btn-save').addEventListener('click', () => this.saveSGF());
        document.getElementById('btn-load').addEventListener('click', () => {
            document.getElementById('sgf-file-input').click();
        });
        document.getElementById('sgf-file-input').addEventListener('change', (e) => this.loadSGF(e));

        // 모바일 메뉴 토글
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                document.querySelector('.side-panel').classList.toggle('show');
            });
        }

        // 설정
        document.getElementById('board-size').addEventListener('change', (e) => {
            this.game.reset(parseInt(e.target.value));
            document.getElementById('board-size-display').textContent = `${e.target.value}×${e.target.value}`;
            this.resizeCanvas();
            this.updateCapturedStones();
            this.updateUI();
        });

        document.getElementById('game-mode').addEventListener('change', (e) => {
            this.mode = e.target.value;
            document.getElementById('game-mode-display').textContent = e.target.value === 'ai' ? 'AI' : '로컬';
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

        // 모달
        document.getElementById('close-board-modal').addEventListener('click', () => this.closeBoardModal());
        document.getElementById('btn-rematch').addEventListener('click', () => {
            this.closeGameOver();
            this.newGame();
        });
        document.getElementById('btn-close-gameover').addEventListener('click', () => this.closeGameOver());

        // 모달 바깥 클릭시 닫기
        document.getElementById('board-modal').addEventListener('click', (e) => {
            if (e.target.id === 'board-modal') {
                this.closeBoardModal();
            }
        });

        // 항아리 클릭 이벤트
        document.getElementById('jar-black').addEventListener('click', () => this.onJarClick('black'));
        document.getElementById('jar-white').addEventListener('click', () => this.onJarClick('white'));

        // 배경 상호작용 오브젝트 초기화
        this.initBackgroundObjects();
    }

    // 배경 상호작용 오브젝트
    initBackgroundObjects() {
        const container = document.getElementById('bg-objects');
        if (!container) return;

        // 오브젝트들 정의
        const objects = [
            { id: 'lantern-1', type: 'lantern', x: 5, y: 20, hp: 5 },
            { id: 'lantern-2', type: 'lantern', x: 90, y: 25, hp: 5 },
            { id: 'pot-1', type: 'pot', x: 8, y: 70, hp: 3 },
            { id: 'pot-2', type: 'pot', x: 88, y: 75, hp: 3 }
        ];

        this.bgObjects = {};

        objects.forEach(obj => {
            const el = document.createElement('div');
            el.className = `bg-object bg-${obj.type}`;
            el.id = obj.id;
            el.style.left = `${obj.x}%`;
            el.style.top = `${obj.y}%`;
            el.dataset.hp = obj.hp;
            el.dataset.maxHp = obj.hp;

            el.addEventListener('click', () => this.hitBgObject(obj.id));
            container.appendChild(el);
            this.bgObjects[obj.id] = { el, ...obj };
        });
    }

    hitBgObject(id) {
        const obj = this.bgObjects[id];
        if (!obj || obj.broken) return;

        obj.hp--;
        obj.el.dataset.hp = obj.hp;

        // 흔들림 효과
        obj.el.classList.add('shake');
        setTimeout(() => obj.el.classList.remove('shake'), 200);

        if (obj.hp <= 0) {
            // 깨짐
            obj.broken = true;
            obj.el.classList.add('broken');
            if (this.settings.soundEnabled) {
                this.soundManager.playBreakSound();
            }
            this.showToast(`${obj.type === 'lantern' ? '등불' : obj.type === 'pot' ? '화분' : '크리스탈'}이 깨졌습니다!`);

            // 10초 후 복구
            setTimeout(() => {
                obj.hp = parseInt(obj.el.dataset.maxHp);
                obj.el.dataset.hp = obj.hp;
                obj.broken = false;
                obj.el.classList.remove('broken');
            }, 10000);
        } else {
            if (this.settings.soundEnabled) {
                this.soundManager.playJarSound();
            }
        }
    }

    // 항아리 클릭 시 상호작용
    onJarClick(color) {
        if (this.settings.soundEnabled) {
            this.soundManager.playJarSound();
        }

        // 항아리 안의 돌들 흔들기 애니메이션
        const containerId = color === 'black' ? 'captured-white' : 'captured-black';
        const container = document.getElementById(containerId);
        const stones = container.querySelectorAll('.captured-stone');

        stones.forEach((stone, i) => {
            setTimeout(() => {
                stone.style.transform = 'translateY(-10px) rotate(10deg)';
                setTimeout(() => {
                    stone.style.transform = '';
                }, 150);
            }, i * 30);
        });

        this.showToast(`${color === 'black' ? '흑' : '백'}이 잡은 돌: ${color === 'black' ? this.game.captures.black : this.game.captures.white}개`);
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

        // 착수 금지 위치면 경고음
        if (!this.game.isValidMove(pos.x, pos.y)) {
            if (this.settings.soundEnabled) {
                this.soundManager.playInvalidSound();
            }
            this.showToast('착수할 수 없는 위치입니다');
            return;
        }

        this.makeMove(pos.x, pos.y);
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
                    this.addCapturedStones(result.captured);
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

    handleResign() {
        if (this.game.gameOver) return;

        if (confirm('정말 기권하시겠습니까?')) {
            const result = this.game.resign();
            this.showGameOver(result.winner + ' 승! (기권)');
        }
    }

    handleUndo() {
        if (this.game.moveHistory.length === 0) return;

        const needsAd = this.game.undoCount >= this.game.maxUndo;

        if (needsAd) {
            this.showAdModal(() => this.performUndo());
        } else {
            this.performUndo();
        }
    }

    performUndo() {
        const undoTwice = this.mode === 'ai';
        const result = this.game.undo();

        if (result.success) {
            this.lastMove = this.getLastMoveFromHistory();
            this.updateCapturedStones();
            this.updateUI();
            this.render();

            if (undoTwice && this.game.moveHistory.length > 0) {
                this.game.undo();
                this.lastMove = this.getLastMoveFromHistory();
                this.updateCapturedStones();
                this.updateUI();
                this.render();
            }
        }
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
        const size = parseInt(document.getElementById('board-size').value);
        this.game.reset(size);
        this.lastMove = null;

        // 개가 모드 리셋
        this.countingMode = false;
        this.deadStones.clear();
        const countBtn = document.getElementById('btn-count');
        countBtn.classList.remove('active');
        countBtn.textContent = '개가';

        this.resizeCanvas();
        this.clearCapturedStones();
        this.updateUI();

        if (this.mode === 'ai' && this.ai.color === 'black') {
            this.aiMove();
        }
    }

    // 따낸 돌 시각화
    addCapturedStones(captured) {
        const capturer = this.game.currentPlayer === 'black' ? 'white' : 'black';
        const containerId = capturer === 'black' ? 'captured-white' : 'captured-black';
        const container = document.getElementById(containerId);

        captured.forEach((stone, i) => {
            setTimeout(() => {
                const stoneEl = document.createElement('div');
                stoneEl.className = `captured-stone ${stone.player || (capturer === 'black' ? 'white' : 'black')}`;
                stoneEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onCapturedStoneClick(stoneEl);
                });
                container.appendChild(stoneEl);
            }, i * 50);
        });
    }

    onCapturedStoneClick(stoneEl) {
        if (this.settings.soundEnabled) {
            this.soundManager.playCaptureSound(1);
        }
        stoneEl.style.transform = 'scale(1.5) translateY(-15px)';
        setTimeout(() => {
            stoneEl.style.transform = '';
        }, 200);
    }

    updateCapturedStones() {
        this.clearCapturedStones();

        // 흑이 잡은 돌 (백돌)
        const capturedWhite = document.getElementById('captured-white');
        for (let i = 0; i < this.game.captures.black; i++) {
            const stoneEl = document.createElement('div');
            stoneEl.className = 'captured-stone white';
            stoneEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onCapturedStoneClick(stoneEl);
            });
            capturedWhite.appendChild(stoneEl);
        }

        // 백이 잡은 돌 (흑돌)
        const capturedBlack = document.getElementById('captured-black');
        for (let i = 0; i < this.game.captures.white; i++) {
            const stoneEl = document.createElement('div');
            stoneEl.className = 'captured-stone black';
            stoneEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onCapturedStoneClick(stoneEl);
            });
            capturedBlack.appendChild(stoneEl);
        }
    }

    clearCapturedStones() {
        document.getElementById('captured-white').innerHTML = '';
        document.getElementById('captured-black').innerHTML = '';
    }

    // 렌더링
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoard();
        this.drawStones();

        if (this.lastMove) {
            this.drawLastMoveMarker(this.lastMove.x, this.lastMove.y);
        }

        // 개가 모드: 사석 표시 및 집 시각화
        if (this.countingMode) {
            this.drawDeadStones();
            this.drawTerritory();
        }
    }

    drawDeadStones() {
        const ctx = this.ctx;

        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const pos = this.boardToCanvas(x, y);

            // X 표시
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
        // 사석 제거한 임시 보드
        const tempBoard = this.game.copyBoard();
        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            tempBoard[x][y] = null;
        });

        // 집 영역 계산
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

    drawBoard() {
        const ctx = this.ctx;
        const size = this.game.size;
        const skin = BOARD_SKINS.find(s => s.id === this.currentSkin) || BOARD_SKINS[0];

        // 배경
        ctx.fillStyle = skin.boardColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 미세한 그라디언트 테두리 효과 (정적)
        const edgeGrad = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.7
        );
        edgeGrad.addColorStop(0, 'transparent');
        edgeGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 격자
        ctx.strokeStyle = skin.lineColor;
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
        const skin = BOARD_SKINS.find(s => s.id === this.currentSkin) || BOARD_SKINS[0];

        let points = [];
        if (size === 19) {
            points = [[3,3], [3,9], [3,15], [9,3], [9,9], [9,15], [15,3], [15,9], [15,15]];
        } else if (size === 13) {
            points = [[3,3], [3,9], [6,6], [9,3], [9,9]];
        } else if (size === 9) {
            points = [[2,2], [2,6], [4,4], [6,2], [6,6]];
        }

        ctx.fillStyle = skin.lineColor;

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
        const skin = BOARD_SKINS.find(s => s.id === this.currentSkin) || BOARD_SKINS[0];

        ctx.fillStyle = skin.lineColor;
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
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const stone = this.game.board[x][y];
                if (stone) {
                    this.drawStone(x, y, stone);
                }
            }
        }
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

    // UI 업데이트
    updateUI() {
        document.getElementById('black-captures').textContent = this.game.captures.black;
        document.getElementById('white-captures').textContent = this.game.captures.white;
        document.getElementById('move-count').textContent = this.game.moveHistory.length;

        const playerBlack = document.getElementById('player-black');
        const playerWhite = document.getElementById('player-white');
        const blackStatus = document.getElementById('black-status');
        const whiteStatus = document.getElementById('white-status');

        if (this.game.currentPlayer === 'black') {
            playerBlack.classList.add('active');
            playerWhite.classList.remove('active');
            blackStatus.textContent = '차례입니다';
            whiteStatus.textContent = '대기 중';
        } else {
            playerBlack.classList.remove('active');
            playerWhite.classList.add('active');
            blackStatus.textContent = '대기 중';
            whiteStatus.textContent = '차례입니다';
        }
    }

    // 보드 스킨
    renderBoardSkins() {
        const grid = document.getElementById('board-grid');
        grid.innerHTML = '';

        BOARD_SKINS.forEach(skin => {
            const card = document.createElement('div');
            card.className = `board-card ${skin.id === this.currentSkin ? 'selected' : ''} ${!skin.unlocked ? 'locked' : ''}`;
            card.innerHTML = `
                <div class="board-preview preview-${skin.id}"></div>
                <div class="board-name">${skin.name}</div>
                <div class="board-price ${skin.price === 0 ? 'free' : ''}">${skin.price === 0 ? '무료' : `₩${skin.price.toLocaleString()}`}</div>
                ${!skin.unlocked ? '<div class="lock-icon">🔒</div>' : ''}
            `;

            card.addEventListener('click', () => this.selectBoardSkin(skin));
            grid.appendChild(card);
        });
    }

    selectBoardSkin(skin) {
        if (!skin.unlocked) {
            this.showToast(`"${skin.name}" 보드는 ₩${skin.price.toLocaleString()}에 구매할 수 있습니다.`);
            return;
        }

        this.currentSkin = skin.id;
        document.getElementById('board-frame').className = `board-frame theme-${skin.id}`;
        this.renderBoardSkins();
        this.render();
        this.saveSettings();
        this.closeBoardModal();
        this.showToast(`"${skin.name}" 보드 적용됨`);
    }

    // 모달
    openBoardModal() {
        document.getElementById('board-modal').classList.add('show');
    }

    closeBoardModal() {
        document.getElementById('board-modal').classList.remove('show');
    }

    toggleSettings() {
        document.getElementById('settings-panel').classList.toggle('show');
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

    showAdModal(callback) {
        const modal = document.getElementById('ad-modal');
        const countdown = document.getElementById('ad-countdown');
        let count = 5;

        modal.classList.add('show');
        countdown.textContent = count;

        const timer = setInterval(() => {
            count--;
            countdown.textContent = count;

            if (count <= 0) {
                clearInterval(timer);
                modal.classList.remove('show');
                if (callback) callback();
            }
        }, 1000);
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
            document.getElementById('board-size-display').textContent = `${sgfData.size}×${sgfData.size}`;

            this.lastMove = this.getLastMoveFromHistory();
            this.resizeCanvas();
            this.updateCapturedStones();
            this.updateUI();

            this.showToast('기보 불러오기 완료');
        } catch (e) {
            this.showToast('기보 파일을 읽을 수 없습니다');
            console.error(e);
        }

        event.target.value = '';
    }

    // 개가(계가) 모드
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

        // 그룹 전체를 사석으로 토글
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
        // 사석 제거 후 점수 계산
        const tempBoard = this.game.copyBoard();
        const tempCaptures = { ...this.game.captures };

        // 사석을 보드에서 제거하고 상대방 캡처로 카운트
        this.deadStones.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const color = tempBoard[x][y];
            if (color) {
                const opponent = color === 'black' ? 'white' : 'black';
                tempCaptures[opponent]++;
                tempBoard[x][y] = null;
            }
        });

        // 집 계산
        const territory = this.calculateTerritoryOnBoard(tempBoard);

        // 덤 6.5
        const komi = 6.5;
        const blackScore = territory.black + tempCaptures.black;
        const whiteScore = territory.white + tempCaptures.white + komi;

        const winner = blackScore > whiteScore ? '흑' : '백';
        const diff = Math.abs(blackScore - whiteScore).toFixed(1);

        // 결과 표시
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
            currentSkin: this.currentSkin
        };
        localStorage.setItem('baduk_settings', JSON.stringify(data));
    }

    loadSettings() {
        const saved = localStorage.getItem('baduk_settings');
        if (saved) {
            const data = JSON.parse(saved);
            this.settings.soundEnabled = data.soundEnabled ?? true;
            this.currentSkin = data.currentSkin || 'classic';

            document.getElementById('sound-enabled').checked = this.settings.soundEnabled;
            document.getElementById('board-frame').className = `board-frame theme-${this.currentSkin}`;
        }
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BadukApp();
});
