/**
 * 간단한 바둑 AI
 * 레벨 1: 랜덤
 * 레벨 2: 기본 휴리스틱 (잡을 수 있으면 잡기, 연결)
 * 레벨 3: 몬테카를로 시뮬레이션
 */
class BadukAI {
    constructor(game, level = 2) {
        this.game = game;
        this.level = level;
        this.color = 'white'; // AI 색상
    }

    setLevel(level) {
        this.level = Math.max(1, Math.min(3, level));
    }

    setColor(color) {
        this.color = color;
    }

    // AI 턴인지 확인
    isMyTurn() {
        return this.game.currentPlayer === this.color;
    }

    // 다음 수 계산
    async getNextMove() {
        if (this.game.gameOver || !this.isMyTurn()) {
            return null;
        }

        // 약간의 딜레이로 자연스러움 추가
        await this.delay(300 + Math.random() * 500);

        switch (this.level) {
            case 1:
                return this.getRandomMove();
            case 2:
                return this.getHeuristicMove();
            case 3:
                return this.getMonteCarloMove();
            default:
                return this.getHeuristicMove();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 레벨 1: 랜덤 착수
    getRandomMove() {
        const validMoves = this.getAllValidMoves();
        if (validMoves.length === 0) {
            return { pass: true };
        }
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    // 모든 유효한 수 가져오기
    getAllValidMoves() {
        const moves = [];
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (this.game.isValidMove(x, y)) {
                    moves.push({ x, y });
                }
            }
        }
        return moves;
    }

    // 레벨 2: 휴리스틱 기반
    getHeuristicMove() {
        const validMoves = this.getAllValidMoves();
        if (validMoves.length === 0) {
            return { pass: true };
        }

        // 각 수에 점수 부여
        const scoredMoves = validMoves.map(move => ({
            ...move,
            score: this.evaluateMove(move.x, move.y)
        }));

        // 점수순 정렬
        scoredMoves.sort((a, b) => b.score - a.score);

        // 상위 수 중에서 약간의 랜덤성 추가
        const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length));
        const weights = topMoves.map((m, i) => Math.pow(0.7, i));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let random = Math.random() * totalWeight;
        for (let i = 0; i < topMoves.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return { x: topMoves[i].x, y: topMoves[i].y };
            }
        }

        return { x: topMoves[0].x, y: topMoves[0].y };
    }

    // 수 평가
    evaluateMove(x, y) {
        let score = 0;
        const opponent = this.color === 'black' ? 'white' : 'black';

        // 1. 잡을 수 있는 돌 확인 (높은 가치)
        score += this.countPotentialCaptures(x, y) * 50;

        // 2. 자신의 돌 연결 보너스
        score += this.countConnections(x, y, this.color) * 5;

        // 3. 상대 돌 차단 보너스
        score += this.countConnections(x, y, opponent) * 3;

        // 4. 활로 확장 보너스
        score += this.countLibertyGain(x, y) * 2;

        // 5. 위치 가치 (중앙 선호, 하지만 변과 귀도 가치)
        score += this.getPositionalScore(x, y);

        // 6. 화점 보너스 (초반)
        if (this.game.moveHistory.length < 20) {
            score += this.getStarPointBonus(x, y);
        }

        // 7. 3-3 침입 방지 (귀 근처 보호)
        score += this.getCornerDefenseScore(x, y);

        return score;
    }

    // 잡을 수 있는 돌 수 계산
    countPotentialCaptures(x, y) {
        const opponent = this.color === 'black' ? 'white' : 'black';
        const neighbors = this.game.getNeighbors(x, y);
        let captures = 0;

        // 임시로 돌 놓기
        const tempBoard = this.game.copyBoard();
        tempBoard[x][y] = this.color;

        for (const [nx, ny] of neighbors) {
            if (tempBoard[nx][ny] === opponent) {
                if (!this.hasLibertyOnBoard(tempBoard, nx, ny, opponent)) {
                    captures += this.getGroupSize(tempBoard, nx, ny, opponent);
                }
            }
        }

        return captures;
    }

    hasLibertyOnBoard(board, x, y, color) {
        const visited = new Set();
        const stack = [[x, y]];

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;

            if (visited.has(key)) continue;
            visited.add(key);

            const neighbors = this.game.getNeighbors(cx, cy);
            for (const [nx, ny] of neighbors) {
                if (board[nx][ny] === null) return true;
                if (board[nx][ny] === color && !visited.has(`${nx},${ny}`)) {
                    stack.push([nx, ny]);
                }
            }
        }
        return false;
    }

    getGroupSize(board, x, y, color) {
        const visited = new Set();
        const stack = [[x, y]];
        let size = 0;

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (board[cx][cy] === color) {
                size++;
                const neighbors = this.game.getNeighbors(cx, cy);
                for (const [nx, ny] of neighbors) {
                    if (!visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                    }
                }
            }
        }
        return size;
    }

    // 연결된 돌 수
    countConnections(x, y, color) {
        const neighbors = this.game.getNeighbors(x, y);
        let count = 0;
        for (const [nx, ny] of neighbors) {
            if (this.game.board[nx][ny] === color) {
                count++;
            }
        }
        return count;
    }

    // 활로 증가량
    countLibertyGain(x, y) {
        const neighbors = this.game.getNeighbors(x, y);
        let liberties = 0;
        for (const [nx, ny] of neighbors) {
            if (this.game.board[nx][ny] === null) {
                liberties++;
            }
        }
        return liberties;
    }

    // 위치 점수 (중앙과 변/귀 밸런스)
    getPositionalScore(x, y) {
        const size = this.game.size;
        const center = (size - 1) / 2;

        // 중앙까지의 거리
        const distFromCenter = Math.abs(x - center) + Math.abs(y - center);
        const maxDist = size - 1;

        // 변에서의 거리
        const distFromEdge = Math.min(x, y, size - 1 - x, size - 1 - y);

        // 중앙 선호 + 너무 변에 붙지 않도록
        let score = (maxDist - distFromCenter) * 0.5;

        // 1선, 2선 페널티
        if (distFromEdge === 0) score -= 5;
        if (distFromEdge === 1) score -= 2;

        // 3선, 4선 보너스
        if (distFromEdge === 2 || distFromEdge === 3) score += 3;

        return score;
    }

    // 화점 보너스
    getStarPointBonus(x, y) {
        const size = this.game.size;
        const starPoints = this.getStarPoints(size);

        for (const [sx, sy] of starPoints) {
            if (x === sx && y === sy) {
                return 15;
            }
        }
        return 0;
    }

    getStarPoints(size) {
        const points = [];

        if (size === 19) {
            const positions = [3, 9, 15];
            for (const x of positions) {
                for (const y of positions) {
                    points.push([x, y]);
                }
            }
        } else if (size === 13) {
            const positions = [3, 6, 9];
            for (const x of positions) {
                for (const y of positions) {
                    points.push([x, y]);
                }
            }
        } else if (size === 9) {
            points.push([4, 4]); // 천원
            points.push([2, 2], [2, 6], [6, 2], [6, 6]);
        }

        return points;
    }

    // 귀 방어 점수
    getCornerDefenseScore(x, y) {
        const size = this.game.size;
        const corners = [[0, 0], [0, size-1], [size-1, 0], [size-1, size-1]];
        let score = 0;

        for (const [cx, cy] of corners) {
            const dist = Math.abs(x - cx) + Math.abs(y - cy);
            if (dist >= 2 && dist <= 5) {
                score += 2;
            }
        }

        return score;
    }

    // 레벨 3: 몬테카를로 트리 탐색 (간략화 버전)
    getMonteCarloMove() {
        const validMoves = this.getAllValidMoves();
        if (validMoves.length === 0) {
            return { pass: true };
        }

        const simulations = 100; // 시뮬레이션 횟수
        const scores = new Map();

        for (const move of validMoves) {
            let wins = 0;

            for (let i = 0; i < simulations; i++) {
                if (this.simulateGame(move)) {
                    wins++;
                }
            }

            scores.set(`${move.x},${move.y}`, wins);
        }

        // 휴리스틱 점수도 조합
        let bestMove = validMoves[0];
        let bestScore = -Infinity;

        for (const move of validMoves) {
            const mcScore = scores.get(`${move.x},${move.y}`) || 0;
            const hScore = this.evaluateMove(move.x, move.y);
            const combined = mcScore * 2 + hScore;

            if (combined > bestScore) {
                bestScore = combined;
                bestMove = move;
            }
        }

        return { x: bestMove.x, y: bestMove.y };
    }

    // 게임 시뮬레이션 (간략화)
    simulateGame(firstMove) {
        // 현재 상태 저장
        const savedState = this.game.serialize();

        // 첫 수 착수
        this.game.placeStone(firstMove.x, firstMove.y);

        // 랜덤 플레이아웃 (최대 100수)
        let moves = 0;
        let passes = 0;

        while (moves < 100 && passes < 2 && !this.game.gameOver) {
            const validMoves = this.getAllValidMoves();

            if (validMoves.length === 0) {
                this.game.pass();
                passes++;
            } else {
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                this.game.placeStone(randomMove.x, randomMove.y);
                passes = 0;
            }
            moves++;
        }

        // 결과 평가
        const score = this.game.calculateScore();
        const myScore = this.color === 'black' ? score.black : score.white;
        const oppScore = this.color === 'black' ? score.white : score.black;
        const won = myScore > oppScore;

        // 상태 복원
        this.game.deserialize(savedState);

        return won;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BadukAI;
}
