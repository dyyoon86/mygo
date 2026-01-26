/**
 * 온라인 대국 모듈 (WebSocket)
 * 향후 서버 구현 시 사용
 */
class BadukOnline {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.playerId = null;
        this.myColor = null;
        this.connected = false;
        this.serverUrl = null; // 서버 URL (나중에 설정)

        // 이벤트 콜백
        this.onConnect = null;
        this.onDisconnect = null;
        this.onRoomJoined = null;
        this.onOpponentMove = null;
        this.onOpponentPass = null;
        this.onOpponentResign = null;
        this.onGameStart = null;
        this.onError = null;
        this.onChat = null;
    }

    // 서버 연결
    connect(serverUrl) {
        if (this.connected) {
            console.warn('Already connected');
            return;
        }

        this.serverUrl = serverUrl;

        try {
            this.socket = new WebSocket(serverUrl);

            this.socket.onopen = () => {
                this.connected = true;
                console.log('Connected to server');
                if (this.onConnect) this.onConnect();
            };

            this.socket.onclose = () => {
                this.connected = false;
                this.roomId = null;
                console.log('Disconnected from server');
                if (this.onDisconnect) this.onDisconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this.onError) this.onError(error);
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

        } catch (e) {
            console.error('Connection failed:', e);
            if (this.onError) this.onError(e);
        }
    }

    // 연결 해제
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.connected = false;
        this.roomId = null;
    }

    // 메시지 전송
    send(type, data = {}) {
        if (!this.connected || !this.socket) {
            console.error('Not connected');
            return false;
        }

        this.socket.send(JSON.stringify({
            type,
            roomId: this.roomId,
            playerId: this.playerId,
            ...data
        }));

        return true;
    }

    // 메시지 처리
    handleMessage(message) {
        console.log('Received:', message);

        switch (message.type) {
            case 'room_joined':
                this.roomId = message.roomId;
                this.playerId = message.playerId;
                if (this.onRoomJoined) {
                    this.onRoomJoined(message);
                }
                break;

            case 'game_start':
                this.myColor = message.yourColor;
                this.game.reset(message.boardSize || 19);
                if (this.onGameStart) {
                    this.onGameStart(message);
                }
                break;

            case 'move':
                if (message.playerId !== this.playerId) {
                    // 상대방 착수
                    this.game.placeStone(message.x, message.y);
                    if (this.onOpponentMove) {
                        this.onOpponentMove(message.x, message.y);
                    }
                }
                break;

            case 'pass':
                if (message.playerId !== this.playerId) {
                    this.game.pass();
                    if (this.onOpponentPass) {
                        this.onOpponentPass();
                    }
                }
                break;

            case 'resign':
                if (message.playerId !== this.playerId) {
                    this.game.resign();
                    if (this.onOpponentResign) {
                        this.onOpponentResign();
                    }
                }
                break;

            case 'chat':
                if (this.onChat) {
                    this.onChat(message.from, message.text);
                }
                break;

            case 'error':
                console.error('Server error:', message.error);
                if (this.onError) {
                    this.onError(message.error);
                }
                break;

            case 'opponent_disconnected':
                if (this.onError) {
                    this.onError('상대방 연결 끊김');
                }
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    // 방 생성
    createRoom(boardSize = 19) {
        return this.send('create_room', { boardSize });
    }

    // 방 참가
    joinRoom(roomId) {
        return this.send('join_room', { roomId });
    }

    // 빠른 매칭
    quickMatch(boardSize = 19) {
        return this.send('quick_match', { boardSize });
    }

    // 착수 전송
    sendMove(x, y) {
        return this.send('move', { x, y });
    }

    // 패스 전송
    sendPass() {
        return this.send('pass');
    }

    // 기권 전송
    sendResign() {
        return this.send('resign');
    }

    // 채팅 전송
    sendChat(text) {
        return this.send('chat', { text });
    }

    // 방 나가기
    leaveRoom() {
        this.send('leave_room');
        this.roomId = null;
        this.myColor = null;
    }

    // 내 턴인지 확인
    isMyTurn() {
        return this.myColor === this.game.currentPlayer;
    }

    // 연결 상태 확인
    isConnected() {
        return this.connected;
    }

    // 방에 있는지 확인
    isInRoom() {
        return this.roomId !== null;
    }
}

/**
 * 온라인 모드 서버 예시 (Node.js + ws)
 *
 * 서버 구현 시 필요한 메시지 프로토콜:
 *
 * 클라이언트 -> 서버:
 * - { type: 'create_room', boardSize: 19 }
 * - { type: 'join_room', roomId: 'xxx' }
 * - { type: 'quick_match', boardSize: 19 }
 * - { type: 'move', roomId: 'xxx', x: 0, y: 0 }
 * - { type: 'pass', roomId: 'xxx' }
 * - { type: 'resign', roomId: 'xxx' }
 * - { type: 'chat', roomId: 'xxx', text: 'hello' }
 * - { type: 'leave_room', roomId: 'xxx' }
 *
 * 서버 -> 클라이언트:
 * - { type: 'room_joined', roomId: 'xxx', playerId: 'yyy' }
 * - { type: 'game_start', yourColor: 'black', boardSize: 19 }
 * - { type: 'move', playerId: 'yyy', x: 0, y: 0 }
 * - { type: 'pass', playerId: 'yyy' }
 * - { type: 'resign', playerId: 'yyy' }
 * - { type: 'chat', from: 'player1', text: 'hello' }
 * - { type: 'error', error: 'message' }
 * - { type: 'opponent_disconnected' }
 */

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BadukOnline;
}
