/**
 * ChessApp - Chess Game UI Controller
 *
 * Features:
 * - Canvas-based board rendering
 * - Click-to-move and drag-and-drop interaction
 * - AI opponent integration
 * - Settings, game over, and promotion modals
 * - Sound effects
 * - Move history panel
 */

// Sound Manager for Chess
class ChessSoundManager {
    constructor() {
        this.enabled = true;
        this.audioContext = null;
        this.sounds = {};
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    synthesizeSound(type) {
        if (!this.audioContext || !this.enabled) return;

        this.resume();
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'move':
                osc.frequency.setValueAtTime(440, now);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialDecayTo = 0.01;
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'capture':
                osc.frequency.setValueAtTime(220, now);
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'check':
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(660, now + 0.1);
                osc.type = 'square';
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'castle':
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.setValueAtTime(440, now + 0.1);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'gameEnd':
                osc.frequency.setValueAtTime(523, now);
                osc.frequency.setValueAtTime(659, now + 0.15);
                osc.frequency.setValueAtTime(784, now + 0.3);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;

            case 'invalid':
                osc.frequency.setValueAtTime(200, now);
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
        }
    }

    play(type) {
        this.synthesizeSound(type);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

// Main Chess App Class
class ChessApp {
    constructor() {
        this.game = new ChessGame();
        this.ai = new ChessAI(this.game, 2);
        this.pgn = new PGNHandler();
        this.sound = new ChessSoundManager();
        this.online = null; // Initialized when needed

        // Canvas setup
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 60;
        this.boardSize = this.cellSize * 8;
        this.boardOffset = 30; // For coordinates

        // UI state
        this.selectedPiece = null;
        this.validMoves = [];
        this.lastMove = null;
        this.isDragging = false;
        this.dragPiece = null;
        this.dragPos = { x: 0, y: 0 };
        this.flipped = false;

        // Game settings
        this.gameMode = 'ai'; // 'ai', 'local', or 'online'
        this.aiLevel = 2;
        this.aiColor = ChessGame.BLACK;
        this.playerName = '플레이어';

        // Colors
        this.colors = {
            lightSquare: '#f0d9b5',
            darkSquare: '#b58863',
            selected: 'rgba(255, 255, 0, 0.5)',
            validMove: 'rgba(0, 128, 0, 0.4)',
            lastMove: 'rgba(155, 199, 0, 0.5)',
            check: 'rgba(255, 0, 0, 0.5)',
            coordinates: '#7c6a5a'
        };

        // Piece unicode characters
        this.pieceUnicode = {
            white: {
                K: '\u2654', Q: '\u2655', R: '\u2656',
                B: '\u2657', N: '\u2658', P: '\u2659'
            },
            black: {
                K: '\u265A', Q: '\u265B', R: '\u265C',
                B: '\u265D', N: '\u265E', P: '\u265F'
            }
        };
    }

    /**
     * Initialize the app
     */
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.loadSettings();
        this.render();
        this.updateUI();

        // Start AI if it's AI's turn
        if (this.gameMode === 'ai' && this.ai.isMyTurn()) {
            this.aiMove();
        }
    }

    /**
     * Setup canvas
     */
    setupCanvas() {
        this.canvas = document.getElementById('chess-board');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        // Set canvas size - larger board for better visibility
        const container = this.canvas.parentElement;
        const maxSize = window.innerWidth < 768 ? 560 : 720;
        const size = Math.min(container.clientWidth - 20, maxSize);
        this.cellSize = Math.floor((size - this.boardOffset * 2) / 8);
        this.boardSize = this.cellSize * 8;

        this.canvas.width = this.boardSize + this.boardOffset * 2;
        this.canvas.height = this.boardSize + this.boardOffset * 2;

        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Canvas events
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Button events
        document.getElementById('btn-new-game')?.addEventListener('click', () => this.newGame());
        document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());
        document.getElementById('btn-settings')?.addEventListener('click', () => this.showSettings());
        document.getElementById('btn-resign')?.addEventListener('click', () => this.resign());

        // Settings modal events
        document.getElementById('btn-save-settings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-close-settings')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('btn-save-pgn')?.addEventListener('click', () => this.savePGN());
        document.getElementById('btn-load-pgn')?.addEventListener('click', () => this.triggerLoadPGN());
        document.getElementById('pgn-file-input')?.addEventListener('change', (e) => this.loadPGN(e));

        // Game over modal events
        document.getElementById('btn-rematch')?.addEventListener('click', () => this.newGame());
        document.getElementById('btn-close-gameover')?.addEventListener('click', () => this.hideGameOver());

        // Promotion modal events
        document.querySelectorAll('.promotion-piece').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePromotion(e.target.dataset.piece));
        });

        // Online modal events
        document.getElementById('btn-online')?.addEventListener('click', () => this.showOnlineModal());
        document.getElementById('btn-close-online')?.addEventListener('click', () => this.hideOnlineModal());
        document.getElementById('btn-create-room')?.addEventListener('click', () => this.createOnlineRoom());
        document.getElementById('btn-join-room')?.addEventListener('click', () => this.joinOnlineRoom());
        document.getElementById('btn-copy-room')?.addEventListener('click', () => this.copyRoomCode());

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });

        // Resume audio context on first interaction
        document.addEventListener('click', () => this.sound.resume(), { once: true });
    }

    /**
     * Convert canvas coordinates to board position
     */
    canvasToBoard(canvasX, canvasY) {
        const x = Math.floor((canvasX - this.boardOffset) / this.cellSize);
        const y = Math.floor((canvasY - this.boardOffset) / this.cellSize);

        if (this.flipped) {
            return { x: 7 - x, y };
        }
        return { x, y: 7 - y };
    }

    /**
     * Convert board position to canvas coordinates
     */
    boardToCanvas(boardX, boardY) {
        let x, y;
        if (this.flipped) {
            x = this.boardOffset + (7 - boardX) * this.cellSize;
            y = this.boardOffset + boardY * this.cellSize;
        } else {
            x = this.boardOffset + boardX * this.cellSize;
            y = this.boardOffset + (7 - boardY) * this.cellSize;
        }
        return { x, y };
    }

    /**
     * Handle canvas click
     */
    handleClick(e) {
        if (this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const pos = this.canvasToBoard(canvasX, canvasY);

        if (pos.x < 0 || pos.x > 7 || pos.y < 0 || pos.y > 7) return;

        this.handleSquareClick(pos.x, pos.y);
    }

    /**
     * Handle square click for move selection
     */
    handleSquareClick(x, y) {
        // Ignore if game over or AI's turn or not my turn in online mode
        if (this.game.gameOver) return;
        if (this.gameMode === 'ai' && this.ai.isMyTurn()) return;
        if (this.gameMode === 'online' && this.online && !this.online.isMyTurn()) return;

        const piece = this.game.getPiece(x, y);

        if (this.selectedPiece) {
            // Try to make a move
            const move = this.validMoves.find(m => m.x === x && m.y === y);

            if (move) {
                // Check for promotion
                if (move.promotion) {
                    this.pendingPromotion = { from: this.selectedPiece, to: { x, y } };
                    this.showPromotion();
                    return;
                }

                this.makeMove(this.selectedPiece.x, this.selectedPiece.y, x, y);
            } else if (piece && piece.color === this.game.currentPlayer) {
                // Select new piece
                this.selectPiece(x, y);
            } else {
                // Deselect
                this.deselectPiece();
            }
        } else if (piece && piece.color === this.game.currentPlayer) {
            // Select piece
            this.selectPiece(x, y);
        }

        this.render();
    }

    /**
     * Select a piece
     */
    selectPiece(x, y) {
        this.selectedPiece = { x, y };
        this.validMoves = this.game.getLegalMoves(x, y);
    }

    /**
     * Deselect current piece
     */
    deselectPiece() {
        this.selectedPiece = null;
        this.validMoves = [];
    }

    /**
     * Make a move
     */
    makeMove(fromX, fromY, toX, toY, promotion = null) {
        const piece = this.game.getPiece(fromX, fromY);
        const captured = this.game.getPiece(toX, toY);
        const wasInCheck = this.game.isInCheck(this.game.currentPlayer);

        // Detect castling
        const isCastling = piece.type === ChessGame.KING && Math.abs(toX - fromX) === 2;

        if (this.game.makeMove(fromX, fromY, toX, toY, promotion)) {
            // Update last move
            this.lastMove = { from: { x: fromX, y: fromY }, to: { x: toX, y: toY } };

            // Play sound
            if (this.game.gameOver) {
                this.sound.play('gameEnd');
            } else if (this.game.isInCheck(this.game.currentPlayer)) {
                this.sound.play('check');
            } else if (isCastling) {
                this.sound.play('castle');
            } else if (captured) {
                this.sound.play('capture');
            } else {
                this.sound.play('move');
            }

            this.deselectPiece();
            this.updateUI();
            this.render();

            // Notify online opponent of move
            if (this.gameMode === 'online' && this.online) {
                this.online.onLocalMove(fromX, fromY, toX, toY, promotion);
            }

            // Check game over
            if (this.game.gameOver) {
                setTimeout(() => this.showGameOver(), 500);
            } else if (this.gameMode === 'ai' && this.ai.isMyTurn()) {
                // AI's turn
                setTimeout(() => this.aiMove(), 100);
            }
        } else {
            this.sound.play('invalid');
        }
    }

    /**
     * AI makes a move
     */
    async aiMove() {
        if (!this.ai.isMyTurn()) return;

        this.updateUI(); // Show "thinking" indicator

        const move = await this.ai.getNextMove();
        if (move) {
            this.makeMove(move.from.x, move.from.y, move.to.x, move.to.y, move.to.promotion);
        }
    }

    /**
     * Handle mouse down for drag
     */
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const pos = this.canvasToBoard(canvasX, canvasY);

        if (pos.x < 0 || pos.x > 7 || pos.y < 0 || pos.y > 7) return;

        const piece = this.game.getPiece(pos.x, pos.y);
        if (piece && piece.color === this.game.currentPlayer) {
            if (this.game.gameOver) return;
            if (this.gameMode === 'ai' && this.ai.isMyTurn()) return;
            if (this.gameMode === 'online' && this.online && !this.online.isMyTurn()) return;

            this.isDragging = true;
            this.dragPiece = { x: pos.x, y: pos.y, piece };
            this.dragPos = { x: canvasX, y: canvasY };
            this.selectPiece(pos.x, pos.y);
            this.render();
        }
    }

    /**
     * Handle mouse move for drag
     */
    handleMouseMove(e) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        this.dragPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        this.render();
    }

    /**
     * Handle mouse up for drop
     */
    handleMouseUp(e) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const pos = this.canvasToBoard(canvasX, canvasY);

        this.isDragging = false;

        if (pos.x >= 0 && pos.x <= 7 && pos.y >= 0 && pos.y <= 7) {
            const move = this.validMoves.find(m => m.x === pos.x && m.y === pos.y);
            if (move) {
                if (move.promotion) {
                    this.pendingPromotion = {
                        from: { x: this.dragPiece.x, y: this.dragPiece.y },
                        to: { x: pos.x, y: pos.y }
                    };
                    this.showPromotion();
                } else {
                    this.makeMove(this.dragPiece.x, this.dragPiece.y, pos.x, pos.y);
                }
            }
        }

        this.dragPiece = null;
        this.render();
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
    }

    /**
     * Render the board
     */
    render() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBoard();
        this.drawCoordinates();
        this.drawHighlights();
        this.drawPieces();

        if (this.isDragging && this.dragPiece) {
            this.drawDraggedPiece();
        }
    }

    /**
     * Draw the chess board
     */
    drawBoard() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;
                this.ctx.fillStyle = isLight ? this.colors.lightSquare : this.colors.darkSquare;

                const x = this.boardOffset + col * this.cellSize;
                const y = this.boardOffset + row * this.cellSize;

                this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    /**
     * Draw board coordinates
     */
    drawCoordinates() {
        this.ctx.fillStyle = this.colors.coordinates;
        this.ctx.font = `${Math.floor(this.cellSize * 0.25)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Files (a-h)
        const files = this.flipped ? 'hgfedcba' : 'abcdefgh';
        for (let i = 0; i < 8; i++) {
            const x = this.boardOffset + i * this.cellSize + this.cellSize / 2;
            this.ctx.fillText(files[i], x, this.boardOffset + this.boardSize + 15);
        }

        // Ranks (1-8)
        const ranks = this.flipped ? '12345678' : '87654321';
        for (let i = 0; i < 8; i++) {
            const y = this.boardOffset + i * this.cellSize + this.cellSize / 2;
            this.ctx.fillText(ranks[i], 12, y);
        }
    }

    /**
     * Draw move highlights
     */
    drawHighlights() {
        // Last move highlight
        if (this.lastMove) {
            this.ctx.fillStyle = this.colors.lastMove;

            const from = this.boardToCanvas(this.lastMove.from.x, this.lastMove.from.y);
            this.ctx.fillRect(from.x, from.y, this.cellSize, this.cellSize);

            const to = this.boardToCanvas(this.lastMove.to.x, this.lastMove.to.y);
            this.ctx.fillRect(to.x, to.y, this.cellSize, this.cellSize);
        }

        // Check highlight
        if (!this.game.gameOver && this.game.isInCheck(this.game.currentPlayer)) {
            const kingPos = this.game.kingPositions[this.game.currentPlayer];
            const pos = this.boardToCanvas(kingPos.x, kingPos.y);
            this.ctx.fillStyle = this.colors.check;
            this.ctx.fillRect(pos.x, pos.y, this.cellSize, this.cellSize);
        }

        // Selected piece highlight
        if (this.selectedPiece) {
            const pos = this.boardToCanvas(this.selectedPiece.x, this.selectedPiece.y);
            this.ctx.fillStyle = this.colors.selected;
            this.ctx.fillRect(pos.x, pos.y, this.cellSize, this.cellSize);
        }

        // Valid moves highlight
        for (const move of this.validMoves) {
            const pos = this.boardToCanvas(move.x, move.y);
            const centerX = pos.x + this.cellSize / 2;
            const centerY = pos.y + this.cellSize / 2;

            const target = this.game.getPiece(move.x, move.y);

            if (target || move.enPassant) {
                // Capture: draw ring
                this.ctx.strokeStyle = this.colors.validMove;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, this.cellSize / 2 - 4, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                // Move: draw dot
                this.ctx.fillStyle = this.colors.validMove;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, this.cellSize / 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Draw all pieces
     */
    drawPieces() {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                // Skip dragged piece
                if (this.isDragging && this.dragPiece &&
                    this.dragPiece.x === x && this.dragPiece.y === y) {
                    continue;
                }

                const piece = this.game.getPiece(x, y);
                if (piece) {
                    this.drawPiece(x, y, piece);
                }
            }
        }
    }

    /**
     * Draw a single piece
     */
    drawPiece(boardX, boardY, piece) {
        const pos = this.boardToCanvas(boardX, boardY);
        const centerX = pos.x + this.cellSize / 2;
        const centerY = pos.y + this.cellSize / 2;

        const unicode = this.pieceUnicode[piece.color][piece.type];

        // Draw piece with shadow
        this.ctx.font = `${this.cellSize * 0.8}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillText(unicode, centerX + 2, centerY + 2);

        // Piece
        this.ctx.fillStyle = piece.color === ChessGame.WHITE ? '#fff' : '#000';
        this.ctx.fillText(unicode, centerX, centerY);

        // Outline for white pieces
        if (piece.color === ChessGame.WHITE) {
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 1;
            this.ctx.strokeText(unicode, centerX, centerY);
        }
    }

    /**
     * Draw piece being dragged
     */
    drawDraggedPiece() {
        const piece = this.dragPiece.piece;
        const unicode = this.pieceUnicode[piece.color][piece.type];

        this.ctx.font = `${this.cellSize * 0.9}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillText(unicode, this.dragPos.x + 3, this.dragPos.y + 3);

        // Piece
        this.ctx.fillStyle = piece.color === ChessGame.WHITE ? '#fff' : '#000';
        this.ctx.fillText(unicode, this.dragPos.x, this.dragPos.y);

        if (piece.color === ChessGame.WHITE) {
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 1;
            this.ctx.strokeText(unicode, this.dragPos.x, this.dragPos.y);
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        // Turn indicator
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            const color = this.game.currentPlayer === ChessGame.WHITE ? '백' : '흑';
            let status = `${color}의 차례`;

            if (this.game.gameOver) {
                if (this.game.gameResult === 'draw') {
                    status = '무승부';
                } else {
                    status = `${this.game.gameResult === ChessGame.WHITE ? '백' : '흑'} 승리`;
                }
            } else if (this.gameMode === 'ai' && this.ai.isThinking) {
                status = 'AI 생각 중...';
            } else if (this.gameMode === 'online' && this.online) {
                status = this.online.isMyTurn() ? '내 차례' : '상대방 차례';
            }

            if (!this.game.gameOver && this.game.isInCheck(this.game.currentPlayer)) {
                status += ' (체크!)';
            }

            turnIndicator.textContent = status;

            // Add appropriate classes
            let classes = 'turn-indicator ' + this.game.currentPlayer;
            if (this.gameMode === 'online' && this.online) {
                classes += this.online.isMyTurn() ? ' my-turn' : ' opponent-turn';
            }
            turnIndicator.className = classes;
        }

        // Captured pieces
        this.updateCapturedPieces();

        // Move history
        this.updateMoveHistory();

        // Button states
        const undoBtn = document.getElementById('btn-undo');
        if (undoBtn) {
            undoBtn.disabled = this.game.moveHistory.length === 0;
        }

        const redoBtn = document.getElementById('btn-redo');
        if (redoBtn) {
            redoBtn.disabled = this.game.redoStack.length === 0;
        }
    }

    /**
     * Update captured pieces display
     */
    updateCapturedPieces() {
        const whiteCaptured = document.getElementById('white-captured');
        const blackCaptured = document.getElementById('black-captured');

        if (whiteCaptured) {
            whiteCaptured.textContent = this.game.capturedPieces.black
                .map(p => this.pieceUnicode.black[p.type])
                .join('');
        }

        if (blackCaptured) {
            blackCaptured.textContent = this.game.capturedPieces.white
                .map(p => this.pieceUnicode.white[p.type])
                .join('');
        }
    }

    /**
     * Update move history panel
     */
    updateMoveHistory() {
        const historyPanel = document.getElementById('move-history');
        if (!historyPanel) return;

        let html = '';
        for (let i = 0; i < this.game.moveHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = this.game.moveHistory[i]?.notation || '';
            const blackMove = this.game.moveHistory[i + 1]?.notation || '';

            html += `<div class="move-row">
                <span class="move-num">${moveNum}.</span>
                <span class="move white-move">${whiteMove}</span>
                <span class="move black-move">${blackMove}</span>
            </div>`;
        }

        historyPanel.innerHTML = html;
        historyPanel.scrollTop = historyPanel.scrollHeight;
    }

    /**
     * New game
     */
    newGame() {
        // Show curtain animation
        const curtain = document.getElementById('curtain');
        if (curtain) {
            curtain.classList.add('active');
            setTimeout(() => {
                this.resetGame();
                curtain.classList.remove('active');
            }, 300);
        } else {
            this.resetGame();
        }

        this.hideGameOver();
    }

    /**
     * Reset game state
     */
    resetGame() {
        this.game.reset();
        this.ai = new ChessAI(this.game, this.aiLevel);
        this.ai.setColor(this.aiColor);

        this.selectedPiece = null;
        this.validMoves = [];
        this.lastMove = null;

        this.render();
        this.updateUI();

        // Start AI if it goes first
        if (this.gameMode === 'ai' && this.ai.isMyTurn()) {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    /**
     * Undo move
     */
    undo() {
        if (this.gameMode === 'ai') {
            // Undo both AI and player moves
            this.game.undo();
            this.game.undo();
        } else {
            this.game.undo();
        }

        this.lastMove = null;
        if (this.game.moveHistory.length > 0) {
            const last = this.game.moveHistory[this.game.moveHistory.length - 1];
            this.lastMove = { from: last.from, to: last.to };
        }

        this.deselectPiece();
        this.render();
        this.updateUI();
    }

    /**
     * Redo move
     */
    redo() {
        if (this.game.redo()) {
            const last = this.game.moveHistory[this.game.moveHistory.length - 1];
            this.lastMove = { from: last.from, to: last.to };

            this.render();
            this.updateUI();

            if (this.gameMode === 'ai' && this.ai.isMyTurn()) {
                setTimeout(() => this.aiMove(), 100);
            }
        }
    }

    /**
     * Resign game
     */
    resign() {
        if (this.game.gameOver) return;

        if (confirm('정말 기권하시겠습니까?')) {
            const playerColor = this.gameMode === 'ai' ?
                (this.aiColor === ChessGame.WHITE ? ChessGame.BLACK : ChessGame.WHITE) :
                this.game.currentPlayer;

            this.game.resign(playerColor);
            this.sound.play('gameEnd');
            this.updateUI();
            this.render();
            setTimeout(() => this.showGameOver(), 500);
        }
    }

    /**
     * Show settings modal
     */
    showSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            // Set current values
            document.getElementById('game-mode').value = this.gameMode;
            document.getElementById('ai-level').value = this.aiLevel;
            document.getElementById('ai-color').value = this.aiColor;
            document.getElementById('sound-enabled').checked = this.sound.enabled;
            document.getElementById('board-flipped').checked = this.flipped;

            modal.classList.add('active');
        }
    }

    /**
     * Hide settings modal
     */
    hideSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        this.gameMode = document.getElementById('game-mode').value;
        this.aiLevel = parseInt(document.getElementById('ai-level').value);
        this.aiColor = document.getElementById('ai-color').value;
        this.sound.setEnabled(document.getElementById('sound-enabled').checked);
        this.flipped = document.getElementById('board-flipped').checked;

        // Update AI
        this.ai.setLevel(this.aiLevel);
        this.ai.setColor(this.aiColor);

        // Save to localStorage
        localStorage.setItem('chess-settings', JSON.stringify({
            gameMode: this.gameMode,
            aiLevel: this.aiLevel,
            aiColor: this.aiColor,
            soundEnabled: this.sound.enabled,
            flipped: this.flipped
        }));

        this.hideSettings();
        this.render();

        // Show toast
        this.showToast('설정이 저장되었습니다');
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('chess-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.gameMode = settings.gameMode || 'ai';
                this.aiLevel = settings.aiLevel || 2;
                this.aiColor = settings.aiColor || ChessGame.BLACK;
                this.sound.setEnabled(settings.soundEnabled !== false);
                this.flipped = settings.flipped || false;

                this.ai.setLevel(this.aiLevel);
                this.ai.setColor(this.aiColor);
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    /**
     * Show game over modal
     */
    showGameOver() {
        const modal = document.getElementById('gameover-modal');
        if (!modal) return;

        const resultText = document.getElementById('game-result');
        const reasonText = document.getElementById('game-reason');

        if (resultText) {
            if (this.game.gameResult === 'draw') {
                resultText.textContent = '무승부';
            } else {
                const winner = this.game.gameResult === ChessGame.WHITE ? '백' : '흑';
                resultText.textContent = `${winner} 승리!`;
            }
        }

        if (reasonText) {
            const reasons = {
                'checkmate': '체크메이트',
                'stalemate': '스테일메이트',
                'fifty-move': '50수 규칙',
                'repetition': '3회 반복',
                'insufficient': '기물 부족',
                'resign': '기권',
                'agreement': '합의'
            };
            reasonText.textContent = reasons[this.game.gameEndReason] || '';
        }

        modal.classList.add('active');
    }

    /**
     * Hide game over modal
     */
    hideGameOver() {
        const modal = document.getElementById('gameover-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Show promotion modal
     */
    showPromotion() {
        const modal = document.getElementById('promotion-modal');
        if (modal) {
            const color = this.game.currentPlayer;

            // Update piece previews
            document.querySelectorAll('.promotion-piece').forEach(btn => {
                const pieceType = btn.dataset.piece;
                btn.textContent = this.pieceUnicode[color][pieceType];
            });

            modal.classList.add('active');
        }
    }

    /**
     * Handle promotion selection
     */
    handlePromotion(pieceType) {
        const modal = document.getElementById('promotion-modal');
        if (modal) {
            modal.classList.remove('active');
        }

        if (this.pendingPromotion) {
            this.makeMove(
                this.pendingPromotion.from.x,
                this.pendingPromotion.from.y,
                this.pendingPromotion.to.x,
                this.pendingPromotion.to.y,
                pieceType
            );
            this.pendingPromotion = null;
        }
    }

    /**
     * Save game as PGN
     */
    savePGN() {
        const metadata = {
            White: this.gameMode === 'ai' && this.aiColor === ChessGame.BLACK ?
                this.playerName : 'AI',
            Black: this.gameMode === 'ai' && this.aiColor === ChessGame.WHITE ?
                this.playerName : 'AI'
        };

        this.pgn.downloadPGN(this.game, 'chess_game.pgn', metadata);
        this.showToast('PGN 파일이 저장되었습니다');
    }

    /**
     * Trigger PGN file input
     */
    triggerLoadPGN() {
        const input = document.getElementById('pgn-file-input');
        if (input) {
            input.click();
        }
    }

    /**
     * Load PGN file
     */
    async loadPGN(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const pgnData = await this.pgn.loadPGNFile(file);
            this.pgn.applyToGame(this.game, pgnData);

            // Update UI
            if (this.game.moveHistory.length > 0) {
                const last = this.game.moveHistory[this.game.moveHistory.length - 1];
                this.lastMove = { from: last.from, to: last.to };
            }

            this.deselectPiece();
            this.render();
            this.updateUI();
            this.hideSettings();
            this.showToast('게임을 불러왔습니다');
        } catch (err) {
            console.error('Failed to load PGN:', err);
            this.showToast('PGN 파일을 불러올 수 없습니다');
        }

        // Reset file input
        e.target.value = '';
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('active');
            setTimeout(() => toast.classList.remove('active'), 2000);
        }
    }

    /**
     * Show online modal
     */
    showOnlineModal() {
        const modal = document.getElementById('online-modal');
        if (modal) {
            // Reset UI
            document.getElementById('waiting-section').style.display = 'none';
            document.querySelector('.online-options').style.display = 'block';
            modal.classList.add('active');
        }
    }

    /**
     * Hide online modal
     */
    hideOnlineModal() {
        const modal = document.getElementById('online-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Create online room
     */
    async createOnlineRoom() {
        try {
            // Initialize online module if not already
            if (!this.online) {
                this.online = new ChessOnline(this);
            }

            // Set player name
            const nameInput = document.getElementById('player-name');
            this.playerName = nameInput?.value || '플레이어';

            // Create room
            const roomCode = await this.online.createRoom();

            // Show waiting UI
            document.querySelector('.online-options').style.display = 'none';
            document.getElementById('waiting-section').style.display = 'block';
            document.getElementById('display-room-code').textContent = roomCode;

            this.showToast('방이 생성되었습니다. 코드를 공유하세요!');
        } catch (err) {
            console.error('Failed to create room:', err);
            this.showToast('방 생성에 실패했습니다');
        }
    }

    /**
     * Join online room
     */
    async joinOnlineRoom() {
        const roomCodeInput = document.getElementById('join-room-code');
        const roomCode = roomCodeInput?.value?.trim();

        if (!roomCode) {
            this.showToast('방 코드를 입력하세요');
            return;
        }

        try {
            // Initialize online module if not already
            if (!this.online) {
                this.online = new ChessOnline(this);
            }

            // Set player name
            const nameInput = document.getElementById('player-name');
            this.playerName = nameInput?.value || '플레이어';

            // Join room
            await this.online.joinRoom(roomCode);

            this.hideOnlineModal();
            this.showToast('방에 참가했습니다!');

            // Show online panel
            const onlinePanel = document.getElementById('online-panel');
            if (onlinePanel) {
                onlinePanel.style.display = 'flex';
            }
        } catch (err) {
            console.error('Failed to join room:', err);
            this.showToast('방 참가에 실패했습니다');
        }
    }

    /**
     * Copy room code to clipboard
     */
    async copyRoomCode() {
        const roomCode = document.getElementById('display-room-code')?.textContent;
        if (roomCode) {
            try {
                await navigator.clipboard.writeText(roomCode);
                this.showToast('방 코드가 복사되었습니다');
            } catch (err) {
                prompt('방 코드를 복사하세요:', roomCode);
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chessApp = new ChessApp();
    window.chessApp.init();
});
