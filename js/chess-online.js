/**
 * ChessOnline - P2P Online Multiplayer using PeerJS
 *
 * Enables 1:1 online battles without a dedicated server.
 * Uses PeerJS for WebRTC peer-to-peer connections.
 */

class ChessOnline {
    constructor(app) {
        this.app = app;
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.myColor = null;
        this.opponentName = '상대방';
        this.roomCode = null;
        this.connected = false;

        // Connection status
        this.status = 'disconnected'; // disconnected, connecting, waiting, connected
    }

    /**
     * Initialize PeerJS connection
     */
    async init() {
        return new Promise((resolve, reject) => {
            // Use free PeerJS cloud server
            this.peer = new Peer(null, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('My peer ID:', id);
                this.roomCode = id;
                resolve(id);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                this.updateStatus('disconnected');
                reject(err);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('disconnected', () => {
                this.updateStatus('disconnected');
            });
        });
    }

    /**
     * Create a new game room (host)
     */
    async createRoom() {
        if (!this.peer) {
            await this.init();
        }

        this.isHost = true;
        this.myColor = ChessGame.WHITE; // Host plays white
        this.updateStatus('waiting');

        return this.roomCode;
    }

    /**
     * Join an existing game room
     */
    async joinRoom(roomCode) {
        if (!this.peer) {
            await this.init();
        }

        this.isHost = false;
        this.myColor = ChessGame.BLACK; // Joiner plays black
        this.updateStatus('connecting');

        return new Promise((resolve, reject) => {
            const conn = this.peer.connect(roomCode, {
                reliable: true
            });

            conn.on('open', () => {
                this.conn = conn;
                this.setupConnection();
                this.connected = true;
                this.updateStatus('connected');

                // Send join message
                this.send({
                    type: 'join',
                    name: this.app.playerName || '플레이어'
                });

                resolve(conn);
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                this.updateStatus('disconnected');
                reject(err);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Handle incoming connection (for host)
     */
    handleIncomingConnection(conn) {
        if (this.conn) {
            // Already have a connection, reject new one
            conn.close();
            return;
        }

        this.conn = conn;
        this.setupConnection();
    }

    /**
     * Setup connection event handlers
     */
    setupConnection() {
        this.conn.on('data', (data) => {
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            this.handleDisconnect();
        });

        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.handleDisconnect();
        });
    }

    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        console.log('Received:', data);

        switch (data.type) {
            case 'join':
                // Opponent joined
                this.opponentName = data.name || '상대방';
                this.connected = true;
                this.updateStatus('connected');

                // Send welcome message with host info
                this.send({
                    type: 'welcome',
                    name: this.app.playerName || '플레이어'
                });

                // Start the game
                this.startOnlineGame();
                break;

            case 'welcome':
                // Received host info
                this.opponentName = data.name || '상대방';
                this.startOnlineGame();
                break;

            case 'move':
                // Opponent made a move
                this.handleOpponentMove(data);
                break;

            case 'resign':
                // Opponent resigned
                this.handleOpponentResign();
                break;

            case 'draw-offer':
                // Opponent offers draw
                this.handleDrawOffer();
                break;

            case 'draw-accept':
                // Opponent accepts draw
                this.handleDrawAccepted();
                break;

            case 'draw-decline':
                // Opponent declines draw
                this.app.showToast('상대방이 무승부를 거절했습니다');
                break;

            case 'rematch':
                // Opponent wants rematch
                this.handleRematchRequest();
                break;

            case 'rematch-accept':
                // Opponent accepts rematch
                this.startRematch();
                break;

            case 'chat':
                // Chat message (future feature)
                break;
        }
    }

    /**
     * Send message to opponent
     */
    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    /**
     * Start online game
     */
    startOnlineGame() {
        // Hide modal, show online panel
        this.app.hideOnlineModal();
        const onlinePanel = document.getElementById('online-panel');
        if (onlinePanel) {
            onlinePanel.style.display = 'flex';
        }

        // Reset game
        this.app.game.reset();
        this.app.gameMode = 'online';
        this.app.flipped = (this.myColor === ChessGame.BLACK);

        this.app.selectedPiece = null;
        this.app.validMoves = [];
        this.app.lastMove = null;

        this.app.render();
        this.app.updateUI();

        this.app.showToast(`${this.opponentName}와(과) 게임 시작!`);

        // Update online UI
        this.updateOnlineUI();
    }

    /**
     * Handle local player making a move
     */
    onLocalMove(fromX, fromY, toX, toY, promotion = null) {
        // Send move to opponent
        this.send({
            type: 'move',
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
            promotion: promotion
        });
    }

    /**
     * Handle opponent's move
     */
    handleOpponentMove(data) {
        const { from, to, promotion } = data;

        // Make the move on local board
        if (this.app.game.makeMove(from.x, from.y, to.x, to.y, promotion)) {
            this.app.lastMove = { from, to };

            // Play sound
            if (this.app.game.gameOver) {
                this.app.sound.play('gameEnd');
            } else if (this.app.game.isInCheck(this.app.game.currentPlayer)) {
                this.app.sound.play('check');
            } else {
                this.app.sound.play('move');
            }

            this.app.updateUI();
            this.app.render();

            if (this.app.game.gameOver) {
                setTimeout(() => this.app.showGameOver(), 500);
            }
        }
    }

    /**
     * Handle opponent resign
     */
    handleOpponentResign() {
        this.app.game.resign(this.myColor === ChessGame.WHITE ? ChessGame.BLACK : ChessGame.WHITE);
        this.app.sound.play('gameEnd');
        this.app.updateUI();
        this.app.render();
        setTimeout(() => this.app.showGameOver(), 500);
    }

    /**
     * Send resign
     */
    resign() {
        this.send({ type: 'resign' });
        this.app.game.resign(this.myColor);
    }

    /**
     * Offer draw
     */
    offerDraw() {
        this.send({ type: 'draw-offer' });
        this.app.showToast('무승부를 제안했습니다');
    }

    /**
     * Handle draw offer from opponent
     */
    handleDrawOffer() {
        if (confirm(`${this.opponentName}이(가) 무승부를 제안합니다. 수락하시겠습니까?`)) {
            this.send({ type: 'draw-accept' });
            this.handleDrawAccepted();
        } else {
            this.send({ type: 'draw-decline' });
        }
    }

    /**
     * Handle draw accepted
     */
    handleDrawAccepted() {
        this.app.game.agreeDraw();
        this.app.sound.play('gameEnd');
        this.app.updateUI();
        this.app.render();
        setTimeout(() => this.app.showGameOver(), 500);
    }

    /**
     * Request rematch
     */
    requestRematch() {
        this.send({ type: 'rematch' });
        this.app.showToast('재대결을 요청했습니다');
    }

    /**
     * Handle rematch request
     */
    handleRematchRequest() {
        if (confirm(`${this.opponentName}이(가) 재대결을 원합니다. 수락하시겠습니까?`)) {
            this.send({ type: 'rematch-accept' });
            this.startRematch();
        }
    }

    /**
     * Start rematch (swap colors)
     */
    startRematch() {
        // Swap colors
        this.myColor = this.myColor === ChessGame.WHITE ? ChessGame.BLACK : ChessGame.WHITE;
        this.isHost = !this.isHost;

        this.startOnlineGame();
    }

    /**
     * Handle disconnect
     */
    handleDisconnect() {
        this.connected = false;
        this.conn = null;
        this.updateStatus('disconnected');

        if (this.app.gameMode === 'online') {
            this.app.showToast('상대방과의 연결이 끊어졌습니다');
            this.app.gameMode = 'local';
        }
    }

    /**
     * Disconnect from game
     */
    disconnect() {
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connected = false;
        this.updateStatus('disconnected');
    }

    /**
     * Check if it's my turn
     */
    isMyTurn() {
        return this.app.game.currentPlayer === this.myColor;
    }

    /**
     * Update connection status
     */
    updateStatus(status) {
        this.status = status;
        this.updateOnlineUI();
    }

    /**
     * Update online-specific UI elements
     */
    updateOnlineUI() {
        const statusEl = document.getElementById('online-status');
        const roomCodeEl = document.getElementById('room-code-display');

        if (statusEl) {
            const statusTexts = {
                'disconnected': '오프라인',
                'connecting': '연결 중...',
                'waiting': '상대 대기 중...',
                'connected': `${this.opponentName}와(과) 연결됨`
            };
            statusEl.textContent = statusTexts[this.status] || '';
            statusEl.className = `online-status ${this.status}`;
        }

        if (roomCodeEl && this.roomCode) {
            roomCodeEl.textContent = this.status === 'waiting' ? this.roomCode : '';
        }
    }

    /**
     * Copy room code to clipboard
     */
    async copyRoomCode() {
        if (this.roomCode) {
            try {
                await navigator.clipboard.writeText(this.roomCode);
                this.app.showToast('방 코드가 복사되었습니다');
            } catch (err) {
                // Fallback
                prompt('방 코드를 복사하세요:', this.roomCode);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessOnline;
}
