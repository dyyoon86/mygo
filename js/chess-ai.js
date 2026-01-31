/**
 * ChessAI - Chess AI Opponent with 3 Difficulty Levels
 *
 * Level 1: Random legal move
 * Level 2: Minimax with alpha-beta pruning (depth 2-3)
 * Level 3: Minimax with quiescence search (depth 4+)
 */

class ChessAI {
    // Piece values (centipawns)
    static PIECE_VALUES = {
        'P': 100,
        'N': 320,
        'B': 330,
        'R': 500,
        'Q': 900,
        'K': 20000
    };

    // Piece-square tables for positional evaluation (from white's perspective)
    // Values are in centipawns, added to piece base value
    static PST = {
        'P': [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5,  5, 10, 25, 25, 10,  5,  5],
            [0,  0,  0, 20, 20,  0,  0,  0],
            [5, -5,-10,  0,  0,-10, -5,  5],
            [5, 10, 10,-20,-20, 10, 10,  5],
            [0,  0,  0,  0,  0,  0,  0,  0]
        ],
        'N': [
            [-50,-40,-30,-30,-30,-30,-40,-50],
            [-40,-20,  0,  0,  0,  0,-20,-40],
            [-30,  0, 10, 15, 15, 10,  0,-30],
            [-30,  5, 15, 20, 20, 15,  5,-30],
            [-30,  0, 15, 20, 20, 15,  0,-30],
            [-30,  5, 10, 15, 15, 10,  5,-30],
            [-40,-20,  0,  5,  5,  0,-20,-40],
            [-50,-40,-30,-30,-30,-30,-40,-50]
        ],
        'B': [
            [-20,-10,-10,-10,-10,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5, 10, 10,  5,  0,-10],
            [-10,  5,  5, 10, 10,  5,  5,-10],
            [-10,  0, 10, 10, 10, 10,  0,-10],
            [-10, 10, 10, 10, 10, 10, 10,-10],
            [-10,  5,  0,  0,  0,  0,  5,-10],
            [-20,-10,-10,-10,-10,-10,-10,-20]
        ],
        'R': [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [5, 10, 10, 10, 10, 10, 10,  5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [0,  0,  0,  5,  5,  0,  0,  0]
        ],
        'Q': [
            [-20,-10,-10, -5, -5,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5,  5,  5,  5,  0,-10],
            [-5,  0,  5,  5,  5,  5,  0, -5],
            [0,  0,  5,  5,  5,  5,  0, -5],
            [-10,  5,  5,  5,  5,  5,  0,-10],
            [-10,  0,  5,  0,  0,  0,  0,-10],
            [-20,-10,-10, -5, -5,-10,-10,-20]
        ],
        'K_MIDDLEGAME': [
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-20,-30,-30,-40,-40,-30,-30,-20],
            [-10,-20,-20,-20,-20,-20,-20,-10],
            [20, 20,  0,  0,  0,  0, 20, 20],
            [20, 30, 10,  0,  0, 10, 30, 20]
        ],
        'K_ENDGAME': [
            [-50,-40,-30,-20,-20,-30,-40,-50],
            [-30,-20,-10,  0,  0,-10,-20,-30],
            [-30,-10, 20, 30, 30, 20,-10,-30],
            [-30,-10, 30, 40, 40, 30,-10,-30],
            [-30,-10, 30, 40, 40, 30,-10,-30],
            [-30,-10, 20, 30, 30, 20,-10,-30],
            [-30,-30,  0,  0,  0,  0,-30,-30],
            [-50,-30,-30,-30,-30,-30,-30,-50]
        ]
    };

    constructor(game, level = 2) {
        this.game = game;
        this.level = level;
        this.color = ChessGame.BLACK;
        this.isThinking = false;
        this.nodes = 0;
        this.maxTime = 3000; // Max thinking time in ms

        // Transposition table for caching evaluations
        this.transpositionTable = new Map();
    }

    /**
     * Set AI difficulty level
     */
    setLevel(level) {
        this.level = Math.max(1, Math.min(3, level));
    }

    /**
     * Set AI color
     */
    setColor(color) {
        this.color = color;
    }

    /**
     * Check if it's AI's turn
     */
    isMyTurn() {
        return this.game.currentPlayer === this.color && !this.game.gameOver;
    }

    /**
     * Get next move asynchronously
     */
    async getNextMove() {
        if (!this.isMyTurn()) return null;

        this.isThinking = true;
        this.nodes = 0;
        this.transpositionTable.clear();

        // Add delay for natural feel
        const delay = this.getThinkingDelay();

        const startTime = performance.now();
        let move;

        switch (this.level) {
            case 1:
                move = this.getRandomMove();
                break;
            case 2:
                move = this.getMinimaxMove(3);
                break;
            case 3:
                move = this.getIterativeDeepeningMove();
                break;
            default:
                move = this.getRandomMove();
        }

        const elapsed = performance.now() - startTime;
        const remainingDelay = Math.max(0, delay - elapsed);

        if (remainingDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }

        this.isThinking = false;
        return move;
    }

    /**
     * Get thinking delay based on level
     */
    getThinkingDelay() {
        switch (this.level) {
            case 1: return 300;
            case 2: return 500;
            case 3: return 1000;
            default: return 300;
        }
    }

    /**
     * Get random legal move (Level 1)
     */
    getRandomMove() {
        const moves = this.game.getAllLegalMoves();
        if (moves.length === 0) return null;
        return moves[Math.floor(Math.random() * moves.length)];
    }

    /**
     * Get move using minimax (Level 2)
     */
    getMinimaxMove(depth) {
        const moves = this.game.getAllLegalMoves();
        if (moves.length === 0) return null;

        // Sort moves for better alpha-beta pruning
        this.orderMoves(moves);

        let bestMove = null;
        let bestScore = -Infinity;
        const alpha = -Infinity;
        const beta = Infinity;

        for (const move of moves) {
            const gameClone = this.game.clone();
            gameClone.makeMove(move.from.x, move.from.y, move.to.x, move.to.y, move.to.promotion);

            const score = -this.minimax(gameClone, depth - 1, -beta, -alpha, false);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    /**
     * Minimax with alpha-beta pruning
     */
    minimax(game, depth, alpha, beta, isMaximizing) {
        this.nodes++;

        // Terminal conditions
        if (game.gameOver) {
            if (game.gameResult === 'draw') return 0;
            const winner = game.gameResult === this.color ? 1 : -1;
            return winner * (ChessAI.PIECE_VALUES['K'] + depth * 100);
        }

        if (depth === 0) {
            return this.quiescenceSearch(game, alpha, beta, 4);
        }

        const moves = game.getAllLegalMoves();
        this.orderMovesForGame(moves, game);

        let bestScore = -Infinity;

        for (const move of moves) {
            const gameClone = game.clone();
            gameClone.makeMove(move.from.x, move.from.y, move.to.x, move.to.y, move.to.promotion);

            const score = -this.minimax(gameClone, depth - 1, -beta, -alpha, !isMaximizing);

            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);

            if (alpha >= beta) break; // Pruning
        }

        return bestScore;
    }

    /**
     * Quiescence search to avoid horizon effect
     */
    quiescenceSearch(game, alpha, beta, depth) {
        const standPat = this.evaluate(game);

        if (depth === 0) return standPat;

        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        // Only search captures
        const moves = game.getAllLegalMoves().filter(m => {
            const target = game.getPiece(m.to.x, m.to.y);
            return target !== null || m.to.enPassant;
        });

        this.orderMovesForGame(moves, game);

        for (const move of moves) {
            const gameClone = game.clone();
            gameClone.makeMove(move.from.x, move.from.y, move.to.x, move.to.y, move.to.promotion);

            const score = -this.quiescenceSearch(gameClone, -beta, -alpha, depth - 1);

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    /**
     * Iterative deepening with time limit (Level 3)
     */
    getIterativeDeepeningMove() {
        const startTime = performance.now();
        let bestMove = null;
        let depth = 1;
        const maxDepth = 6;

        while (depth <= maxDepth && (performance.now() - startTime) < this.maxTime * 0.8) {
            const move = this.getMinimaxMove(depth);
            if (move) bestMove = move;
            depth++;
        }

        return bestMove || this.getRandomMove();
    }

    /**
     * Evaluate board position
     */
    evaluate(game) {
        if (game.gameOver) {
            if (game.gameResult === 'draw') return 0;
            const winner = game.gameResult === this.color ? 1 : -1;
            return winner * ChessAI.PIECE_VALUES['K'];
        }

        let score = 0;
        const isEndgame = this.isEndgame(game);

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = game.getPiece(x, y);
                if (!piece) continue;

                const pieceValue = ChessAI.PIECE_VALUES[piece.type];
                const pstValue = this.getPieceSquareValue(piece.type, x, y, piece.color, isEndgame);

                const multiplier = piece.color === this.color ? 1 : -1;
                score += multiplier * (pieceValue + pstValue);
            }
        }

        // Mobility bonus
        const myMoves = game.currentPlayer === this.color ?
            game.getAllLegalMoves().length : 0;
        score += myMoves * 5;

        return score;
    }

    /**
     * Get piece-square table value
     */
    getPieceSquareValue(type, x, y, color, isEndgame) {
        let pst;
        if (type === 'K') {
            pst = isEndgame ? ChessAI.PST['K_ENDGAME'] : ChessAI.PST['K_MIDDLEGAME'];
        } else {
            pst = ChessAI.PST[type];
        }

        if (!pst) return 0;

        // Mirror for black pieces
        const row = color === ChessGame.WHITE ? y : 7 - y;
        return pst[7 - row][x];
    }

    /**
     * Check if position is in endgame
     */
    isEndgame(game) {
        let totalMaterial = 0;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = game.getPiece(x, y);
                if (piece && piece.type !== 'K' && piece.type !== 'P') {
                    totalMaterial += ChessAI.PIECE_VALUES[piece.type];
                }
            }
        }
        // Endgame if less than 2 queens worth of material
        return totalMaterial < 1800;
    }

    /**
     * Order moves for better pruning (MVV-LVA)
     */
    orderMoves(moves) {
        moves.sort((a, b) => {
            // Captures first (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
            const aTarget = this.game.getPiece(a.to.x, a.to.y);
            const bTarget = this.game.getPiece(b.to.x, b.to.y);

            const aCapture = aTarget ? ChessAI.PIECE_VALUES[aTarget.type] - ChessAI.PIECE_VALUES[a.piece.type] / 10 : 0;
            const bCapture = bTarget ? ChessAI.PIECE_VALUES[bTarget.type] - ChessAI.PIECE_VALUES[b.piece.type] / 10 : 0;

            if (aCapture !== bCapture) return bCapture - aCapture;

            // Promotions
            if (a.to.promotion && !b.to.promotion) return -1;
            if (!a.to.promotion && b.to.promotion) return 1;

            return 0;
        });
    }

    /**
     * Order moves for a game instance
     */
    orderMovesForGame(moves, game) {
        moves.sort((a, b) => {
            const aTarget = game.getPiece(a.to.x, a.to.y);
            const bTarget = game.getPiece(b.to.x, b.to.y);

            const aCapture = aTarget ? ChessAI.PIECE_VALUES[aTarget.type] : 0;
            const bCapture = bTarget ? ChessAI.PIECE_VALUES[bTarget.type] : 0;

            return bCapture - aCapture;
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessAI;
}
