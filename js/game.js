/**
 * 바둑 게임 코어 로직
 */
class BadukGame {
    constructor(size = 19) {
        this.size = size;
        this.board = [];
        this.currentPlayer = 'black'; // 'black' or 'white'
        this.moveHistory = [];
        this.captures = { black: 0, white: 0 };
        this.passCount = 0;
        this.gameOver = false;
        this.koPoint = null; // 패 규칙을 위한 금지점
        this.undoCount = 0;
        this.maxUndo = 2;

        this.initBoard();
    }

    initBoard() {
        this.board = [];
        for (let i = 0; i < this.size; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.size; j++) {
                this.board[i][j] = null; // null, 'black', or 'white'
            }
        }
    }

    reset(size = null) {
        if (size) this.size = size;
        this.initBoard();
        this.currentPlayer = 'black';
        this.moveHistory = [];
        this.captures = { black: 0, white: 0 };
        this.passCount = 0;
        this.gameOver = false;
        this.koPoint = null;
        this.undoCount = 0;
    }

    // 착수 가능 여부 확인
    isValidMove(x, y) {
        // 범위 체크
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return false;
        }

        // 이미 돌이 있는 곳
        if (this.board[x][y] !== null) {
            return false;
        }

        // 패 규칙 체크
        if (this.koPoint && this.koPoint.x === x && this.koPoint.y === y) {
            return false;
        }

        // 자살수 체크 (임시로 돌을 놓고 확인)
        const tempBoard = this.copyBoard();
        tempBoard[x][y] = this.currentPlayer;

        // 상대 돌을 먼저 잡을 수 있는지 확인
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        const neighbors = this.getNeighbors(x, y);
        let wouldCapture = false;

        for (const [nx, ny] of neighbors) {
            if (tempBoard[nx][ny] === opponent) {
                if (!this.hasLibertyOnBoard(tempBoard, nx, ny)) {
                    wouldCapture = true;
                }
            }
        }

        // 상대를 잡지 않는데 자신도 활로가 없으면 자살수
        if (!wouldCapture && !this.hasLibertyOnBoard(tempBoard, x, y)) {
            return false;
        }

        return true;
    }

    // 착수
    placeStone(x, y) {
        if (this.gameOver) return { success: false, reason: 'Game is over' };
        if (!this.isValidMove(x, y)) return { success: false, reason: 'Invalid move' };

        // 이전 상태 저장 (무르기용)
        const previousState = {
            board: this.copyBoard(),
            currentPlayer: this.currentPlayer,
            captures: { ...this.captures },
            koPoint: this.koPoint ? { ...this.koPoint } : null,
            passCount: this.passCount
        };

        // 돌 놓기
        this.board[x][y] = this.currentPlayer;
        this.passCount = 0;

        // 상대 돌 잡기
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        const neighbors = this.getNeighbors(x, y);
        let capturedStones = [];

        for (const [nx, ny] of neighbors) {
            if (this.board[nx][ny] === opponent) {
                if (!this.hasLiberty(nx, ny)) {
                    const captured = this.captureGroup(nx, ny);
                    capturedStones = capturedStones.concat(captured);
                }
            }
        }

        // 잡은 돌 카운트
        this.captures[this.currentPlayer] += capturedStones.length;

        // 패 체크 (정확히 1개 잡았을 때만)
        if (capturedStones.length === 1) {
            this.koPoint = { x: capturedStones[0].x, y: capturedStones[0].y };
        } else {
            this.koPoint = null;
        }

        // 기보 기록
        this.moveHistory.push({
            x, y,
            player: this.currentPlayer,
            captured: capturedStones,
            previousState
        });

        // 턴 교체
        this.currentPlayer = opponent;

        return {
            success: true,
            captured: capturedStones,
            moveNumber: this.moveHistory.length
        };
    }

    // 패스
    pass() {
        if (this.gameOver) return { success: false };

        this.passCount++;

        const previousState = {
            board: this.copyBoard(),
            currentPlayer: this.currentPlayer,
            captures: { ...this.captures },
            koPoint: this.koPoint,
            passCount: this.passCount - 1
        };

        this.moveHistory.push({
            pass: true,
            player: this.currentPlayer,
            previousState
        });

        this.koPoint = null;

        // 양쪽 다 패스하면 게임 종료
        if (this.passCount >= 2) {
            this.gameOver = true;
            return { success: true, gameOver: true };
        }

        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        return { success: true };
    }

    // 기권
    resign() {
        this.gameOver = true;
        const winner = this.currentPlayer === 'black' ? 'white' : 'black';
        return { winner, reason: 'resign' };
    }

    // 무르기
    undo() {
        if (this.moveHistory.length === 0) {
            return { success: false, reason: 'No moves to undo' };
        }

        const needsAd = this.undoCount >= this.maxUndo;

        const lastMove = this.moveHistory.pop();
        const prev = lastMove.previousState;

        this.board = prev.board;
        this.currentPlayer = prev.currentPlayer;
        this.captures = prev.captures;
        this.koPoint = prev.koPoint;
        this.passCount = prev.passCount;

        this.undoCount++;

        return { success: true, needsAd };
    }

    // 특정 위치에서 시작하는 그룹의 활로 확인
    hasLiberty(x, y) {
        return this.hasLibertyOnBoard(this.board, x, y);
    }

    hasLibertyOnBoard(board, x, y) {
        const color = board[x][y];
        if (!color) return true;

        const visited = new Set();
        const stack = [[x, y]];

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;

            if (visited.has(key)) continue;
            visited.add(key);

            const neighbors = this.getNeighbors(cx, cy);
            for (const [nx, ny] of neighbors) {
                if (board[nx][ny] === null) {
                    return true; // 활로 발견
                }
                if (board[nx][ny] === color && !visited.has(`${nx},${ny}`)) {
                    stack.push([nx, ny]);
                }
            }
        }

        return false;
    }

    // 그룹 잡기
    captureGroup(x, y) {
        const color = this.board[x][y];
        if (!color) return [];

        const captured = [];
        const visited = new Set();
        const stack = [[x, y]];

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (this.board[cx][cy] === color) {
                captured.push({ x: cx, y: cy });
                this.board[cx][cy] = null;

                const neighbors = this.getNeighbors(cx, cy);
                for (const [nx, ny] of neighbors) {
                    if (!visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                    }
                }
            }
        }

        return captured;
    }

    // 이웃 좌표 가져오기
    getNeighbors(x, y) {
        const neighbors = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
                neighbors.push([nx, ny]);
            }
        }

        return neighbors;
    }

    // 보드 복사
    copyBoard() {
        return this.board.map(row => [...row]);
    }

    // 점수 계산 (간단한 집 계산)
    calculateScore() {
        const territory = { black: 0, white: 0 };
        const visited = new Set();

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.board[x][y] === null && !visited.has(`${x},${y}`)) {
                    const result = this.floodFillTerritory(x, y, visited);
                    if (result.owner === 'black') {
                        territory.black += result.size;
                    } else if (result.owner === 'white') {
                        territory.white += result.size;
                    }
                }
            }
        }

        // 덤 6.5 적용 (한국 룰)
        const komi = 6.5;

        return {
            black: territory.black + this.captures.black,
            white: territory.white + this.captures.white + komi,
            territory,
            captures: this.captures
        };
    }

    // 집 영역 탐색
    floodFillTerritory(startX, startY, visited) {
        const stack = [[startX, startY]];
        const area = [];
        let touchesBlack = false;
        let touchesWhite = false;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (this.board[x][y] === null) {
                area.push([x, y]);
                const neighbors = this.getNeighbors(x, y);
                for (const [nx, ny] of neighbors) {
                    if (!visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                    }
                }
            } else if (this.board[x][y] === 'black') {
                touchesBlack = true;
            } else if (this.board[x][y] === 'white') {
                touchesWhite = true;
            }
        }

        let owner = null;
        if (touchesBlack && !touchesWhite) owner = 'black';
        else if (touchesWhite && !touchesBlack) owner = 'white';

        return { size: area.length, owner };
    }

    // 게임 상태 직렬화
    serialize() {
        return {
            size: this.size,
            board: this.copyBoard(),
            currentPlayer: this.currentPlayer,
            moveHistory: this.moveHistory,
            captures: this.captures,
            gameOver: this.gameOver
        };
    }

    // 게임 상태 복원
    deserialize(state) {
        this.size = state.size;
        this.board = state.board;
        this.currentPlayer = state.currentPlayer;
        this.moveHistory = state.moveHistory;
        this.captures = state.captures;
        this.gameOver = state.gameOver;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BadukGame;
}
