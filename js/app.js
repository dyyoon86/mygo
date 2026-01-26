/**
 * 바둑돌 사운드 매니저 (Web Audio API)
 * 실제 바둑돌 소리를 모방
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

    // 바둑돌 착수 소리 (슬레이트/조개 돌이 나무판에 놓이는 "딱" 소리)
    playStoneSound() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // 1. 초기 임팩트 - 날카로운 "딱" 소리
        const impact = ctx.createOscillator();
        const impactGain = ctx.createGain();
        impact.type = 'square';
        impact.frequency.setValueAtTime(1800, now);
        impact.frequency.exponentialRampToValueAtTime(400, now + 0.015);
        impactGain.gain.setValueAtTime(0.3, now);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        impact.connect(impactGain);
        impactGain.connect(ctx.destination);
        impact.start(now);
        impact.stop(now + 0.03);

        // 2. 돌의 울림 - 중저음 공명
        const resonance = ctx.createOscillator();
        const resGain = ctx.createGain();
        resonance.type = 'sine';
        resonance.frequency.setValueAtTime(220, now);
        resonance.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        resGain.gain.setValueAtTime(0.15, now + 0.01);
        resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        resonance.connect(resGain);
        resGain.connect(ctx.destination);
        resonance.start(now);
        resonance.stop(now + 0.1);

        // 3. 나무판 공명 - 깊은 울림
        const wood = ctx.createOscillator();
        const woodGain = ctx.createGain();
        wood.type = 'triangle';
        wood.frequency.setValueAtTime(120, now);
        wood.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        woodGain.gain.setValueAtTime(0.12, now + 0.005);
        woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        wood.connect(woodGain);
        woodGain.connect(ctx.destination);
        wood.start(now);
        wood.stop(now + 0.15);

        // 4. 클릭 노이즈 - 돌 표면 질감
        const noiseLen = ctx.sampleRate * 0.02;
        const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.15));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 3000;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
    }

    // 돌 따먹는 소리 - 경쾌한 "찰칵찰칵" 소리
    playCaptureSound(count = 1) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const num = Math.min(count, 6);

        // 여러 돌이 부딪히며 치워지는 경쾌한 소리
        for (let i = 0; i < num; i++) {
            const delay = i * 0.04 + Math.random() * 0.02;

            // 높은 음의 경쾌한 클릭
            const click = ctx.createOscillator();
            const clickGain = ctx.createGain();
            click.type = 'sine';
            const freq = 1200 + Math.random() * 600; // 높은 주파수로 경쾌하게
            click.frequency.setValueAtTime(freq, now + delay);
            click.frequency.exponentialRampToValueAtTime(freq * 0.4, now + delay + 0.05);
            clickGain.gain.setValueAtTime(0.15, now + delay);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
            click.connect(clickGain);
            clickGain.connect(ctx.destination);
            click.start(now + delay);
            click.stop(now + delay + 0.06);

            // 부딪히는 노이즈
            const clickNoiseLen = ctx.sampleRate * 0.015;
            const clickNoiseBuffer = ctx.createBuffer(1, clickNoiseLen, ctx.sampleRate);
            const clickNoiseData = clickNoiseBuffer.getChannelData(0);
            for (let j = 0; j < clickNoiseLen; j++) {
                clickNoiseData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (clickNoiseLen * 0.2));
            }
            const clickNoise = ctx.createBufferSource();
            clickNoise.buffer = clickNoiseBuffer;
            const clickNoiseFilter = ctx.createBiquadFilter();
            clickNoiseFilter.type = 'bandpass';
            clickNoiseFilter.frequency.value = 4000;
            clickNoiseFilter.Q.value = 2;
            const clickNoiseGain = ctx.createGain();
            clickNoiseGain.gain.setValueAtTime(0.1, now + delay);
            clickNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.02);
            clickNoise.connect(clickNoiseFilter);
            clickNoiseFilter.connect(clickNoiseGain);
            clickNoiseGain.connect(ctx.destination);
            clickNoise.start(now + delay);
        }

        // 마무리 - 그릇에 담기는 가벼운 울림
        const bowl = ctx.createOscillator();
        const bowlGain = ctx.createGain();
        bowl.type = 'sine';
        bowl.frequency.setValueAtTime(800, now + num * 0.04 + 0.05);
        bowl.frequency.exponentialRampToValueAtTime(400, now + num * 0.04 + 0.15);
        bowlGain.gain.setValueAtTime(0.08, now + num * 0.04 + 0.05);
        bowlGain.gain.exponentialRampToValueAtTime(0.001, now + num * 0.04 + 0.2);
        bowl.connect(bowlGain);
        bowlGain.connect(ctx.destination);
        bowl.start(now + num * 0.04 + 0.05);
        bowl.stop(now + num * 0.04 + 0.2);
    }
}

/**
 * 바둑 게임 메인 애플리케이션
 */
class BadukApp {
    constructor() {
        // 게임 인스턴스
        this.game = new BadukGame(19);
        this.ai = new BadukAI(this.game, 2);
        this.sgf = new SGFHandler();
        this.online = new BadukOnline(this.game);
        this.soundManager = new SoundManager();

        // 게임 모드: 'local', 'ai', 'online'
        this.mode = 'local';

        // 설정
        this.settings = {
            boardTheme: 'classic',
            soundEnabled: true,
            showCoordinates: true,
            showLastMove: true
        };

        // 캔버스 관련
        this.canvas = document.getElementById('board-canvas');
        this.ctx = this.canvas.getContext('2d');

        // 보드 크기 관련
        this.cellSize = 30;
        this.padding = 30;
        this.stoneRadius = 13;

        // 마지막 수 위치
        this.lastMove = null;

        // 초기화
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
        const container = this.canvas.parentElement;
        const maxSize = Math.min(container.clientWidth - 20, 600);

        // 보드 크기에 맞게 셀 크기 계산
        const size = this.game.size;
        this.cellSize = Math.floor((maxSize - this.padding * 2) / (size - 1));
        this.stoneRadius = Math.floor(this.cellSize * 0.45);

        const canvasSize = this.cellSize * (size - 1) + this.padding * 2;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;

        this.render();
    }

    bindEvents() {
        // 캔버스 클릭
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // 캔버스 호버
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('mouseleave', () => this.render());

        // 버튼들
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-pass').addEventListener('click', () => this.handlePass());
        document.getElementById('btn-resign').addEventListener('click', () => this.handleResign());

        // 모드 버튼
        document.getElementById('mode-local').addEventListener('click', () => this.setMode('local'));
        document.getElementById('mode-ai').addEventListener('click', () => this.setMode('ai'));
        document.getElementById('mode-online').addEventListener('click', () => this.setMode('online'));

        // 보드 크기 변경
        document.getElementById('board-size').addEventListener('change', (e) => {
            this.game.reset(parseInt(e.target.value));
            this.resizeCanvas();
            this.updateUI();
        });

        // AI 설정
        document.getElementById('ai-level').addEventListener('change', (e) => {
            this.ai.setLevel(parseInt(e.target.value));
        });

        document.getElementById('ai-color').addEventListener('change', (e) => {
            this.ai.setColor(e.target.value);
            if (this.mode === 'ai' && this.ai.isMyTurn()) {
                this.aiMove();
            }
        });

        // SGF
        document.getElementById('btn-save-sgf').addEventListener('click', () => this.saveSGF());
        document.getElementById('btn-load-sgf').addEventListener('click', () => {
            document.getElementById('sgf-file-input').click();
        });
        document.getElementById('sgf-file-input').addEventListener('change', (e) => this.loadSGF(e));

        // 설정 모달
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());

        // 게임 오버 모달
        document.getElementById('btn-rematch').addEventListener('click', () => {
            this.closeGameOver();
            this.newGame();
        });
        document.getElementById('btn-close-gameover').addEventListener('click', () => this.closeGameOver());

        // 설정 변경
        document.getElementById('board-theme').addEventListener('change', (e) => {
            this.settings.boardTheme = e.target.value;
            this.saveSettings();
            this.render();
        });

        document.getElementById('sound-enabled').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('show-coordinates').addEventListener('change', (e) => {
            this.settings.showCoordinates = e.target.checked;
            this.saveSettings();
            this.render();
        });

        document.getElementById('show-last-move').addEventListener('change', (e) => {
            this.settings.showLastMove = e.target.checked;
            this.saveSettings();
            this.render();
        });
    }

    // 캔버스 클릭 처리
    handleCanvasClick(e) {
        if (this.game.gameOver) return;

        // 온라인 모드에서 내 턴이 아니면 무시
        if (this.mode === 'online' && !this.online.isMyTurn()) return;

        // AI 모드에서 AI 턴이면 무시
        if (this.mode === 'ai' && this.ai.isMyTurn()) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const pos = this.canvasToBoard(x, y);
        if (!pos) return;

        this.makeMove(pos.x, pos.y);
    }

    // 캔버스 호버 처리
    handleCanvasHover(e) {
        if (this.game.gameOver) return;
        if (this.mode === 'ai' && this.ai.isMyTurn()) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const pos = this.canvasToBoard(x, y);

        this.render();

        if (pos && this.game.isValidMove(pos.x, pos.y)) {
            // 미리보기 돌 그리기
            this.drawStonePreview(pos.x, pos.y);
        }
    }

    // 캔버스 좌표를 보드 좌표로 변환
    canvasToBoard(canvasX, canvasY) {
        const x = Math.round((canvasX - this.padding) / this.cellSize);
        const y = Math.round((canvasY - this.padding) / this.cellSize);

        if (x < 0 || x >= this.game.size || y < 0 || y >= this.game.size) {
            return null;
        }

        return { x, y };
    }

    // 보드 좌표를 캔버스 좌표로 변환
    boardToCanvas(x, y) {
        return {
            x: this.padding + x * this.cellSize,
            y: this.padding + y * this.cellSize
        };
    }

    // 착수
    makeMove(x, y) {
        const result = this.game.placeStone(x, y);

        if (result.success) {
            this.lastMove = { x, y };
            this.playStoneSound();

            // 따먹은 돌이 있으면 캡처 소리도 재생
            if (result.captured && result.captured.length > 0) {
                setTimeout(() => {
                    this.playCaptureSound(result.captured.length);
                }, 100);
            }

            this.updateUI();
            this.render();
            this.updateMoveList();

            // 온라인 모드면 서버에 전송
            if (this.mode === 'online') {
                this.online.sendMove(x, y);
            }

            // AI 모드면 AI 턴 진행
            if (this.mode === 'ai' && !this.game.gameOver && this.ai.isMyTurn()) {
                this.aiMove();
            }

            // 게임 종료 체크
            if (this.game.gameOver) {
                this.showGameOver();
            }
        }
    }

    // AI 착수
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

    // 패스 처리
    handlePass(isAI = false) {
        if (this.game.gameOver) return;

        const result = this.game.pass();

        if (result.success) {
            this.updateUI();
            this.updateMoveList();

            if (this.mode === 'online' && !isAI) {
                this.online.sendPass();
            }

            if (result.gameOver) {
                this.showGameOver();
            } else if (this.mode === 'ai' && !isAI && this.ai.isMyTurn()) {
                this.aiMove();
            }
        }
    }

    // 기권 처리
    handleResign() {
        if (this.game.gameOver) return;

        if (confirm('정말 기권하시겠습니까?')) {
            const result = this.game.resign();

            if (this.mode === 'online') {
                this.online.sendResign();
            }

            this.showGameOver(result.winner + ' 승! (기권)');
        }
    }

    // 무르기 처리
    handleUndo() {
        if (this.game.moveHistory.length === 0) return;

        // AI 모드에서는 2수 무르기 (내 수 + AI 수)
        const undoTwice = this.mode === 'ai';

        const result = this.game.undo();

        if (result.success) {
            if (result.needsAd) {
                this.showAdModal(() => {
                    this.lastMove = this.getLastMoveFromHistory();
                    this.updateUI();
                    this.render();

                    // AI 모드에서 한 번 더 무르기
                    if (undoTwice && this.game.moveHistory.length > 0) {
                        this.game.undo();
                        this.lastMove = this.getLastMoveFromHistory();
                        this.updateUI();
                        this.render();
                    }
                });
            } else {
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

    // 새 게임
    newGame() {
        const size = parseInt(document.getElementById('board-size').value);
        this.game.reset(size);
        this.lastMove = null;
        this.resizeCanvas();
        this.updateUI();
        this.updateMoveList();

        // AI 모드에서 AI가 흑이면 AI 먼저 착수
        if (this.mode === 'ai' && this.ai.color === 'black') {
            this.aiMove();
        }
    }

    // 모드 설정
    setMode(mode) {
        this.mode = mode;

        // 버튼 업데이트
        document.querySelectorAll('.btn-mode').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`mode-${mode}`).classList.add('active');

        // AI 설정 표시/숨김
        document.getElementById('ai-settings').style.display = mode === 'ai' ? 'block' : 'none';

        // 새 게임 시작
        this.newGame();
    }

    // 렌더링
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoard();
        this.drawStones();

        if (this.settings.showLastMove && this.lastMove) {
            this.drawLastMoveMarker(this.lastMove.x, this.lastMove.y);
        }
    }

    // 보드 그리기
    drawBoard() {
        const ctx = this.ctx;
        const size = this.game.size;

        // 배경
        const themes = {
            classic: '#dcb35c',
            dark: '#2d2d2d',
            wood: '#c4a35a'
        };
        ctx.fillStyle = themes[this.settings.boardTheme] || themes.classic;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 선 색상
        const lineColor = this.settings.boardTheme === 'dark' ? '#555' : '#2d2d2d';
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;

        // 격자 그리기
        for (let i = 0; i < size; i++) {
            const pos = this.padding + i * this.cellSize;

            // 세로선
            ctx.beginPath();
            ctx.moveTo(pos, this.padding);
            ctx.lineTo(pos, this.padding + (size - 1) * this.cellSize);
            ctx.stroke();

            // 가로선
            ctx.beginPath();
            ctx.moveTo(this.padding, pos);
            ctx.lineTo(this.padding + (size - 1) * this.cellSize, pos);
            ctx.stroke();
        }

        // 화점
        this.drawStarPoints();

        // 좌표
        if (this.settings.showCoordinates) {
            this.drawCoordinates();
        }
    }

    // 화점 그리기
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
        } else {
            // 다른 크기는 중앙만
            const center = Math.floor(size / 2);
            points = [[center, center]];
        }

        ctx.fillStyle = this.settings.boardTheme === 'dark' ? '#888' : '#2d2d2d';

        for (const [x, y] of points) {
            const pos = this.boardToCanvas(x, y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 좌표 그리기
    drawCoordinates() {
        const ctx = this.ctx;
        const size = this.game.size;

        ctx.fillStyle = this.settings.boardTheme === 'dark' ? '#888' : '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const letters = 'ABCDEFGHJKLMNOPQRST'; // I 제외

        for (let i = 0; i < size; i++) {
            const pos = this.padding + i * this.cellSize;

            // 위쪽 알파벳
            ctx.fillText(letters[i], pos, 10);
            // 아래쪽 알파벳
            ctx.fillText(letters[i], pos, this.canvas.height - 10);

            // 왼쪽 숫자
            ctx.fillText(String(size - i), 10, pos);
            // 오른쪽 숫자
            ctx.fillText(String(size - i), this.canvas.width - 10, pos);
        }
    }

    // 돌 그리기
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

    // 단일 돌 그리기
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

    // 돌 미리보기
    drawStonePreview(x, y) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);
        const color = this.game.currentPlayer;

        ctx.globalAlpha = 0.5;
        this.drawStone(x, y, color);
        ctx.globalAlpha = 1;
    }

    // 마지막 수 표시
    drawLastMoveMarker(x, y) {
        const ctx = this.ctx;
        const pos = this.boardToCanvas(x, y);
        const stone = this.game.board[x][y];

        ctx.strokeStyle = stone === 'black' ? '#fff' : '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.stoneRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 돌 놓는 소리 재생
    playStoneSound() {
        if (!this.settings.soundEnabled) return;
        this.soundManager.playStoneSound();
    }

    // 돌 따먹는 소리 재생
    playCaptureSound(count) {
        if (!this.settings.soundEnabled) return;
        this.soundManager.playCaptureSound(count);
    }

    // UI 업데이트
    updateUI() {
        // 따낸 돌
        document.getElementById('black-captures').textContent = this.game.captures.black;
        document.getElementById('white-captures').textContent = this.game.captures.white;

        // 수순
        document.getElementById('move-count').textContent = this.game.moveHistory.length;

        // 무르기 횟수
        document.getElementById('undo-count').textContent = this.game.undoCount;

        // 턴 표시
        const blackTurn = document.getElementById('black-turn');
        const whiteTurn = document.getElementById('white-turn');

        blackTurn.classList.toggle('active', this.game.currentPlayer === 'black');
        whiteTurn.classList.toggle('active', this.game.currentPlayer === 'white');
    }

    // 기보 목록 업데이트
    updateMoveList() {
        const list = document.getElementById('move-list');
        list.innerHTML = '';

        const letters = 'ABCDEFGHJKLMNOPQRST';

        this.game.moveHistory.forEach((move, index) => {
            const div = document.createElement('div');
            div.className = `move-item ${move.player}`;

            if (move.pass) {
                div.textContent = `${index + 1}. ${move.player === 'black' ? '흑' : '백'} 패스`;
            } else {
                const coord = `${letters[move.x]}${this.game.size - move.y}`;
                div.textContent = `${index + 1}. ${move.player === 'black' ? '흑' : '백'} ${coord}`;
            }

            list.appendChild(div);
        });

        list.scrollTop = list.scrollHeight;
    }

    // SGF 저장
    saveSGF() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        this.sgf.downloadSGF(this.game, `baduk_${date}.sgf`);
    }

    // SGF 불러오기
    async loadSGF(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const sgfData = await this.sgf.loadSGFFile(file);
            this.sgf.applyToGame(this.game, sgfData);

            // 보드 크기 선택 업데이트
            document.getElementById('board-size').value = sgfData.size;

            this.lastMove = this.getLastMoveFromHistory();
            this.resizeCanvas();
            this.updateUI();
            this.updateMoveList();

            alert('기보를 불러왔습니다.');
        } catch (e) {
            alert('기보 파일을 읽을 수 없습니다.');
            console.error(e);
        }

        event.target.value = '';
    }

    // 설정 모달
    openSettings() {
        document.getElementById('settings-modal').classList.add('show');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.remove('show');
    }

    // 게임 오버 모달
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

    // 광고 모달
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

    // 설정 저장
    saveSettings() {
        localStorage.setItem('baduk_settings', JSON.stringify(this.settings));
    }

    // 설정 불러오기
    loadSettings() {
        const saved = localStorage.getItem('baduk_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }

        // UI에 반영
        document.getElementById('board-theme').value = this.settings.boardTheme;
        document.getElementById('sound-enabled').checked = this.settings.soundEnabled;
        document.getElementById('show-coordinates').checked = this.settings.showCoordinates;
        document.getElementById('show-last-move').checked = this.settings.showLastMove;
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BadukApp();
});
