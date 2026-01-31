/**
 * ChessGame - Complete Chess Game Logic with Modern Rules
 *
 * Implements all standard chess rules including:
 * - All piece movements (King, Queen, Rook, Bishop, Knight, Pawn)
 * - Castling (kingside and queenside)
 * - En passant capture
 * - Pawn promotion
 * - Check, Checkmate, Stalemate detection
 * - Fifty-move rule
 * - Threefold repetition
 * - Insufficient material draw
 */

class ChessGame {
    // Piece type constants
    static KING = 'K';
    static QUEEN = 'Q';
    static ROOK = 'R';
    static BISHOP = 'B';
    static KNIGHT = 'N';
    static PAWN = 'P';

    // Color constants
    static WHITE = 'white';
    static BLACK = 'black';

    constructor() {
        this.reset();
    }

    /**
     * Reset game to initial state
     */
    reset() {
        this.board = this.createInitialBoard();
        this.currentPlayer = ChessGame.WHITE;
        this.moveHistory = [];
        this.redoStack = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.gameResult = null; // 'white', 'black', 'draw'
        this.gameEndReason = null; // 'checkmate', 'stalemate', 'fifty-move', 'repetition', 'insufficient', 'resign', 'agreement'

        // Castling rights
        this.castlingRights = {
            whiteKingside: true,
            whiteQueenside: true,
            blackKingside: true,
            blackQueenside: true
        };

        // En passant target square (null or {x, y})
        this.enPassantTarget = null;

        // Fifty-move rule counter (increments each half-move, resets on pawn move or capture)
        this.halfMoveClock = 0;

        // Full move number (starts at 1, increments after Black's move)
        this.fullMoveNumber = 1;

        // Position history for threefold repetition (array of position strings)
        this.positionHistory = [];
        this.positionHistory.push(this.getPositionKey());

        // King positions for quick access
        this.kingPositions = {
            white: { x: 4, y: 0 },
            black: { x: 4, y: 7 }
        };
    }

    /**
     * Create initial chess board setup
     * Board is 8x8, with [0][0] being a1 (bottom-left from white's perspective)
     */
    createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));

        // Back row pieces order
        const backRow = [
            ChessGame.ROOK, ChessGame.KNIGHT, ChessGame.BISHOP, ChessGame.QUEEN,
            ChessGame.KING, ChessGame.BISHOP, ChessGame.KNIGHT, ChessGame.ROOK
        ];

        // White pieces (rank 1 and 2)
        for (let x = 0; x < 8; x++) {
            board[x][0] = { type: backRow[x], color: ChessGame.WHITE };
            board[x][1] = { type: ChessGame.PAWN, color: ChessGame.WHITE };
        }

        // Black pieces (rank 7 and 8)
        for (let x = 0; x < 8; x++) {
            board[x][7] = { type: backRow[x], color: ChessGame.BLACK };
            board[x][6] = { type: ChessGame.PAWN, color: ChessGame.BLACK };
        }

        return board;
    }

    /**
     * Get piece at position
     */
    getPiece(x, y) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return null;
        return this.board[x][y];
    }

    /**
     * Set piece at position
     */
    setPiece(x, y, piece) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return;
        this.board[x][y] = piece;
    }

    /**
     * Get all pseudo-legal moves for a piece (ignoring check)
     */
    getPieceMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        const moves = [];

        switch (piece.type) {
            case ChessGame.PAWN:
                this.getPawnMoves(x, y, piece.color, moves);
                break;
            case ChessGame.KNIGHT:
                this.getKnightMoves(x, y, piece.color, moves);
                break;
            case ChessGame.BISHOP:
                this.getSlidingMoves(x, y, piece.color, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
                break;
            case ChessGame.ROOK:
                this.getSlidingMoves(x, y, piece.color, moves, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
                break;
            case ChessGame.QUEEN:
                this.getSlidingMoves(x, y, piece.color, moves, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
                break;
            case ChessGame.KING:
                this.getKingMoves(x, y, piece.color, moves);
                break;
        }

        return moves;
    }

    /**
     * Get pawn moves
     */
    getPawnMoves(x, y, color, moves) {
        const direction = color === ChessGame.WHITE ? 1 : -1;
        const startRank = color === ChessGame.WHITE ? 1 : 6;
        const promotionRank = color === ChessGame.WHITE ? 7 : 0;

        // Forward move
        const newY = y + direction;
        if (newY >= 0 && newY <= 7 && !this.getPiece(x, newY)) {
            if (newY === promotionRank) {
                // Promotion moves
                moves.push({ x, y: newY, promotion: ChessGame.QUEEN });
                moves.push({ x, y: newY, promotion: ChessGame.ROOK });
                moves.push({ x, y: newY, promotion: ChessGame.BISHOP });
                moves.push({ x, y: newY, promotion: ChessGame.KNIGHT });
            } else {
                moves.push({ x, y: newY });
            }

            // Double move from start
            if (y === startRank) {
                const doubleY = y + 2 * direction;
                if (!this.getPiece(x, doubleY)) {
                    moves.push({ x, y: doubleY });
                }
            }
        }

        // Diagonal captures
        for (const dx of [-1, 1]) {
            const captureX = x + dx;
            const captureY = y + direction;
            if (captureX >= 0 && captureX <= 7 && captureY >= 0 && captureY <= 7) {
                const target = this.getPiece(captureX, captureY);
                if (target && target.color !== color) {
                    if (captureY === promotionRank) {
                        moves.push({ x: captureX, y: captureY, promotion: ChessGame.QUEEN });
                        moves.push({ x: captureX, y: captureY, promotion: ChessGame.ROOK });
                        moves.push({ x: captureX, y: captureY, promotion: ChessGame.BISHOP });
                        moves.push({ x: captureX, y: captureY, promotion: ChessGame.KNIGHT });
                    } else {
                        moves.push({ x: captureX, y: captureY });
                    }
                }

                // En passant
                if (this.enPassantTarget && captureX === this.enPassantTarget.x && captureY === this.enPassantTarget.y) {
                    moves.push({ x: captureX, y: captureY, enPassant: true });
                }
            }
        }
    }

    /**
     * Get knight moves
     */
    getKnightMoves(x, y, color, moves) {
        const offsets = [
            [1, 2], [2, 1], [2, -1], [1, -2],
            [-1, -2], [-2, -1], [-2, 1], [-1, 2]
        ];

        for (const [dx, dy] of offsets) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX <= 7 && newY >= 0 && newY <= 7) {
                const target = this.getPiece(newX, newY);
                if (!target || target.color !== color) {
                    moves.push({ x: newX, y: newY });
                }
            }
        }
    }

    /**
     * Get sliding piece moves (rook, bishop, queen)
     */
    getSlidingMoves(x, y, color, moves, directions) {
        for (const [dx, dy] of directions) {
            let newX = x + dx;
            let newY = y + dy;

            while (newX >= 0 && newX <= 7 && newY >= 0 && newY <= 7) {
                const target = this.getPiece(newX, newY);
                if (!target) {
                    moves.push({ x: newX, y: newY });
                } else {
                    if (target.color !== color) {
                        moves.push({ x: newX, y: newY });
                    }
                    break;
                }
                newX += dx;
                newY += dy;
            }
        }
    }

    /**
     * Get king moves (including castling)
     */
    getKingMoves(x, y, color, moves) {
        // Regular king moves
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX <= 7 && newY >= 0 && newY <= 7) {
                    const target = this.getPiece(newX, newY);
                    if (!target || target.color !== color) {
                        moves.push({ x: newX, y: newY });
                    }
                }
            }
        }

        // Castling
        if (this.canCastle(color, 'kingside')) {
            moves.push({ x: x + 2, y, castling: 'kingside' });
        }
        if (this.canCastle(color, 'queenside')) {
            moves.push({ x: x - 2, y, castling: 'queenside' });
        }
    }

    /**
     * Check if castling is possible
     */
    canCastle(color, side) {
        // Check castling rights
        const rightsKey = `${color}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
        if (!this.castlingRights[rightsKey]) return false;

        // King must not be in check
        if (this.isInCheck(color)) return false;

        const y = color === ChessGame.WHITE ? 0 : 7;
        const kingX = 4;

        if (side === 'kingside') {
            // Check squares between king and rook are empty
            if (this.getPiece(5, y) || this.getPiece(6, y)) return false;

            // Check king doesn't pass through or end in check
            if (this.isSquareAttacked(5, y, this.getOpponent(color))) return false;
            if (this.isSquareAttacked(6, y, this.getOpponent(color))) return false;

            return true;
        } else {
            // Queenside
            if (this.getPiece(3, y) || this.getPiece(2, y) || this.getPiece(1, y)) return false;

            if (this.isSquareAttacked(3, y, this.getOpponent(color))) return false;
            if (this.isSquareAttacked(2, y, this.getOpponent(color))) return false;

            return true;
        }
    }

    /**
     * Check if a square is attacked by a color
     */
    isSquareAttacked(x, y, byColor) {
        // Check pawn attacks
        const pawnDir = byColor === ChessGame.WHITE ? -1 : 1;
        for (const dx of [-1, 1]) {
            const px = x + dx;
            const py = y + pawnDir;
            if (px >= 0 && px <= 7 && py >= 0 && py <= 7) {
                const piece = this.getPiece(px, py);
                if (piece && piece.color === byColor && piece.type === ChessGame.PAWN) {
                    return true;
                }
            }
        }

        // Check knight attacks
        const knightOffsets = [
            [1, 2], [2, 1], [2, -1], [1, -2],
            [-1, -2], [-2, -1], [-2, 1], [-1, 2]
        ];
        for (const [dx, dy] of knightOffsets) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx <= 7 && ny >= 0 && ny <= 7) {
                const piece = this.getPiece(nx, ny);
                if (piece && piece.color === byColor && piece.type === ChessGame.KNIGHT) {
                    return true;
                }
            }
        }

        // Check king attacks (for adjacent squares)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const kx = x + dx;
                const ky = y + dy;
                if (kx >= 0 && kx <= 7 && ky >= 0 && ky <= 7) {
                    const piece = this.getPiece(kx, ky);
                    if (piece && piece.color === byColor && piece.type === ChessGame.KING) {
                        return true;
                    }
                }
            }
        }

        // Check sliding piece attacks (rook, bishop, queen)
        const directions = [
            { dx: 1, dy: 0, pieces: [ChessGame.ROOK, ChessGame.QUEEN] },
            { dx: -1, dy: 0, pieces: [ChessGame.ROOK, ChessGame.QUEEN] },
            { dx: 0, dy: 1, pieces: [ChessGame.ROOK, ChessGame.QUEEN] },
            { dx: 0, dy: -1, pieces: [ChessGame.ROOK, ChessGame.QUEEN] },
            { dx: 1, dy: 1, pieces: [ChessGame.BISHOP, ChessGame.QUEEN] },
            { dx: 1, dy: -1, pieces: [ChessGame.BISHOP, ChessGame.QUEEN] },
            { dx: -1, dy: 1, pieces: [ChessGame.BISHOP, ChessGame.QUEEN] },
            { dx: -1, dy: -1, pieces: [ChessGame.BISHOP, ChessGame.QUEEN] }
        ];

        for (const { dx, dy, pieces } of directions) {
            let cx = x + dx;
            let cy = y + dy;
            while (cx >= 0 && cx <= 7 && cy >= 0 && cy <= 7) {
                const piece = this.getPiece(cx, cy);
                if (piece) {
                    if (piece.color === byColor && pieces.includes(piece.type)) {
                        return true;
                    }
                    break;
                }
                cx += dx;
                cy += dy;
            }
        }

        return false;
    }

    /**
     * Check if a color's king is in check
     */
    isInCheck(color) {
        const kingPos = this.kingPositions[color];
        return this.isSquareAttacked(kingPos.x, kingPos.y, this.getOpponent(color));
    }

    /**
     * Get legal moves for a piece (filtered by check)
     */
    getLegalMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        const pseudoMoves = this.getPieceMoves(x, y);
        const legalMoves = [];

        for (const move of pseudoMoves) {
            if (this.isMoveLegal(x, y, move)) {
                legalMoves.push(move);
            }
        }

        return legalMoves;
    }

    /**
     * Check if a move is legal (doesn't leave own king in check)
     */
    isMoveLegal(fromX, fromY, move) {
        const piece = this.getPiece(fromX, fromY);
        if (!piece) return false;

        // Make the move temporarily
        const captured = this.getPiece(move.x, move.y);
        const originalEnPassant = this.enPassantTarget;
        let enPassantCaptured = null;

        // Handle en passant capture
        if (move.enPassant) {
            const captureY = piece.color === ChessGame.WHITE ? move.y - 1 : move.y + 1;
            enPassantCaptured = this.getPiece(move.x, captureY);
            this.setPiece(move.x, captureY, null);
        }

        // Handle castling - check intermediate squares
        if (move.castling) {
            // Already checked in canCastle, but double-check king path
            const y = piece.color === ChessGame.WHITE ? 0 : 7;
            const direction = move.castling === 'kingside' ? 1 : -1;

            // Move king temporarily
            this.setPiece(fromX, fromY, null);
            this.setPiece(move.x, move.y, piece);

            // Update king position temporarily
            const oldKingPos = { ...this.kingPositions[piece.color] };
            this.kingPositions[piece.color] = { x: move.x, y: move.y };

            const inCheck = this.isInCheck(piece.color);

            // Restore
            this.setPiece(move.x, move.y, captured);
            this.setPiece(fromX, fromY, piece);
            this.kingPositions[piece.color] = oldKingPos;

            return !inCheck;
        }

        // Standard move
        this.setPiece(fromX, fromY, null);
        this.setPiece(move.x, move.y, piece);

        // Update king position temporarily if king moved
        const oldKingPos = { ...this.kingPositions[piece.color] };
        if (piece.type === ChessGame.KING) {
            this.kingPositions[piece.color] = { x: move.x, y: move.y };
        }

        const inCheck = this.isInCheck(piece.color);

        // Restore position
        this.setPiece(move.x, move.y, captured);
        this.setPiece(fromX, fromY, piece);
        this.kingPositions[piece.color] = oldKingPos;

        if (enPassantCaptured) {
            const captureY = piece.color === ChessGame.WHITE ? move.y - 1 : move.y + 1;
            this.setPiece(move.x, captureY, enPassantCaptured);
        }

        return !inCheck;
    }

    /**
     * Make a move
     * @param {number} fromX - Source X
     * @param {number} fromY - Source Y
     * @param {number} toX - Target X
     * @param {number} toY - Target Y
     * @param {string} promotion - Promotion piece type (optional)
     * @returns {boolean} - Whether the move was successful
     */
    makeMove(fromX, fromY, toX, toY, promotion = null) {
        if (this.gameOver) return false;

        const piece = this.getPiece(fromX, fromY);
        if (!piece || piece.color !== this.currentPlayer) return false;

        // Find the move in legal moves
        const legalMoves = this.getLegalMoves(fromX, fromY);
        let move = legalMoves.find(m => m.x === toX && m.y === toY);

        if (!move) return false;

        // Handle promotion
        if (move.promotion) {
            if (promotion) {
                move = { ...move, promotion };
            }
            // else use the default (Queen) from the move
        }

        // Save state for undo
        const moveRecord = {
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
            piece: { ...piece },
            captured: this.getPiece(toX, toY),
            castling: move.castling,
            enPassant: move.enPassant,
            promotion: move.promotion,
            previousEnPassantTarget: this.enPassantTarget,
            previousCastlingRights: { ...this.castlingRights },
            previousHalfMoveClock: this.halfMoveClock,
            enPassantCaptured: null
        };

        // Clear redo stack
        this.redoStack = [];

        // Execute the move
        let capturedPiece = null;

        // Handle en passant capture
        if (move.enPassant) {
            const captureY = piece.color === ChessGame.WHITE ? toY - 1 : toY + 1;
            capturedPiece = this.getPiece(toX, captureY);
            moveRecord.enPassantCaptured = capturedPiece;
            this.setPiece(toX, captureY, null);
        } else {
            capturedPiece = this.getPiece(toX, toY);
        }

        // Handle castling
        if (move.castling) {
            const rookFromX = move.castling === 'kingside' ? 7 : 0;
            const rookToX = move.castling === 'kingside' ? 5 : 3;
            const y = piece.color === ChessGame.WHITE ? 0 : 7;

            const rook = this.getPiece(rookFromX, y);
            this.setPiece(rookFromX, y, null);
            this.setPiece(rookToX, y, rook);
        }

        // Move the piece
        this.setPiece(fromX, fromY, null);

        // Handle promotion
        if (move.promotion) {
            this.setPiece(toX, toY, { type: move.promotion, color: piece.color });
        } else {
            this.setPiece(toX, toY, piece);
        }

        // Update king position
        if (piece.type === ChessGame.KING) {
            this.kingPositions[piece.color] = { x: toX, y: toY };
        }

        // Add captured piece to list
        if (capturedPiece) {
            this.capturedPieces[this.getOpponent(piece.color)].push(capturedPiece);
        }

        // Update castling rights
        if (piece.type === ChessGame.KING) {
            if (piece.color === ChessGame.WHITE) {
                this.castlingRights.whiteKingside = false;
                this.castlingRights.whiteQueenside = false;
            } else {
                this.castlingRights.blackKingside = false;
                this.castlingRights.blackQueenside = false;
            }
        }
        if (piece.type === ChessGame.ROOK) {
            if (fromX === 0 && fromY === 0) this.castlingRights.whiteQueenside = false;
            if (fromX === 7 && fromY === 0) this.castlingRights.whiteKingside = false;
            if (fromX === 0 && fromY === 7) this.castlingRights.blackQueenside = false;
            if (fromX === 7 && fromY === 7) this.castlingRights.blackKingside = false;
        }
        // Also update if rook is captured
        if (capturedPiece && capturedPiece.type === ChessGame.ROOK) {
            if (toX === 0 && toY === 0) this.castlingRights.whiteQueenside = false;
            if (toX === 7 && toY === 0) this.castlingRights.whiteKingside = false;
            if (toX === 0 && toY === 7) this.castlingRights.blackQueenside = false;
            if (toX === 7 && toY === 7) this.castlingRights.blackKingside = false;
        }

        // Update en passant target
        this.enPassantTarget = null;
        if (piece.type === ChessGame.PAWN && Math.abs(toY - fromY) === 2) {
            this.enPassantTarget = { x: fromX, y: (fromY + toY) / 2 };
        }

        // Update half-move clock
        if (piece.type === ChessGame.PAWN || capturedPiece) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // Generate algebraic notation before switching player
        moveRecord.notation = this.moveToAlgebraic(moveRecord);

        // Add to move history
        this.moveHistory.push(moveRecord);

        // Switch player
        if (this.currentPlayer === ChessGame.BLACK) {
            this.fullMoveNumber++;
        }
        this.currentPlayer = this.getOpponent(this.currentPlayer);

        // Update position history for threefold repetition
        this.positionHistory.push(this.getPositionKey());

        // Check for game end
        this.checkGameEnd();

        return true;
    }

    /**
     * Undo the last move
     */
    undo() {
        if (this.moveHistory.length === 0) return false;

        const move = this.moveHistory.pop();
        this.redoStack.push(move);

        // Remove last position from history
        this.positionHistory.pop();

        // Restore piece positions
        this.setPiece(move.from.x, move.from.y, move.piece);

        if (move.promotion) {
            // Remove promoted piece
            this.setPiece(move.to.x, move.to.y, move.captured);
        } else {
            this.setPiece(move.to.x, move.to.y, move.captured);
        }

        // Restore en passant captured piece
        if (move.enPassant && move.enPassantCaptured) {
            const captureY = move.piece.color === ChessGame.WHITE ? move.to.y - 1 : move.to.y + 1;
            this.setPiece(move.to.x, captureY, move.enPassantCaptured);
        }

        // Restore castling rook
        if (move.castling) {
            const rookFromX = move.castling === 'kingside' ? 7 : 0;
            const rookToX = move.castling === 'kingside' ? 5 : 3;
            const y = move.piece.color === ChessGame.WHITE ? 0 : 7;

            const rook = this.getPiece(rookToX, y);
            this.setPiece(rookToX, y, null);
            this.setPiece(rookFromX, y, rook);
        }

        // Restore king position
        if (move.piece.type === ChessGame.KING) {
            this.kingPositions[move.piece.color] = { x: move.from.x, y: move.from.y };
        }

        // Restore captured pieces list
        if (move.captured || move.enPassantCaptured) {
            const capturedColor = this.getOpponent(move.piece.color);
            this.capturedPieces[capturedColor].pop();
        }

        // Restore game state
        this.enPassantTarget = move.previousEnPassantTarget;
        this.castlingRights = { ...move.previousCastlingRights };
        this.halfMoveClock = move.previousHalfMoveClock;

        // Switch player back
        this.currentPlayer = move.piece.color;
        if (this.currentPlayer === ChessGame.BLACK) {
            this.fullMoveNumber--;
        }

        // Reset game over state
        this.gameOver = false;
        this.gameResult = null;
        this.gameEndReason = null;

        return true;
    }

    /**
     * Redo an undone move
     */
    redo() {
        if (this.redoStack.length === 0) return false;

        const move = this.redoStack.pop();

        // Replay the move
        return this.makeMove(
            move.from.x, move.from.y,
            move.to.x, move.to.y,
            move.promotion
        );
    }

    /**
     * Check for game end conditions
     */
    checkGameEnd() {
        // Check if current player has any legal moves
        const hasLegalMoves = this.hasAnyLegalMoves(this.currentPlayer);

        if (!hasLegalMoves) {
            if (this.isInCheck(this.currentPlayer)) {
                // Checkmate
                this.gameOver = true;
                this.gameResult = this.getOpponent(this.currentPlayer);
                this.gameEndReason = 'checkmate';
            } else {
                // Stalemate
                this.gameOver = true;
                this.gameResult = 'draw';
                this.gameEndReason = 'stalemate';
            }
            return;
        }

        // Fifty-move rule
        if (this.halfMoveClock >= 100) {
            this.gameOver = true;
            this.gameResult = 'draw';
            this.gameEndReason = 'fifty-move';
            return;
        }

        // Threefold repetition
        if (this.isThreefoldRepetition()) {
            this.gameOver = true;
            this.gameResult = 'draw';
            this.gameEndReason = 'repetition';
            return;
        }

        // Insufficient material
        if (this.hasInsufficientMaterial()) {
            this.gameOver = true;
            this.gameResult = 'draw';
            this.gameEndReason = 'insufficient';
            return;
        }
    }

    /**
     * Check if a player has any legal moves
     */
    hasAnyLegalMoves(color) {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.color === color) {
                    const moves = this.getLegalMoves(x, y);
                    if (moves.length > 0) return true;
                }
            }
        }
        return false;
    }

    /**
     * Check for threefold repetition
     */
    isThreefoldRepetition() {
        const currentKey = this.getPositionKey();
        let count = 0;
        for (const key of this.positionHistory) {
            if (key === currentKey) count++;
            if (count >= 3) return true;
        }
        return false;
    }

    /**
     * Generate position key for repetition detection
     */
    getPositionKey() {
        let key = '';

        // Board position
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = this.getPiece(x, y);
                if (piece) {
                    key += piece.color.charAt(0) + piece.type;
                } else {
                    key += '.';
                }
            }
        }

        // Current player
        key += this.currentPlayer.charAt(0);

        // Castling rights
        key += this.castlingRights.whiteKingside ? 'K' : '-';
        key += this.castlingRights.whiteQueenside ? 'Q' : '-';
        key += this.castlingRights.blackKingside ? 'k' : '-';
        key += this.castlingRights.blackQueenside ? 'q' : '-';

        // En passant target
        if (this.enPassantTarget) {
            key += String.fromCharCode(97 + this.enPassantTarget.x) + (this.enPassantTarget.y + 1);
        } else {
            key += '-';
        }

        return key;
    }

    /**
     * Check for insufficient mating material
     */
    hasInsufficientMaterial() {
        const pieces = { white: [], black: [] };

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.type !== ChessGame.KING) {
                    pieces[piece.color].push({ type: piece.type, x, y });
                }
            }
        }

        const whitePieces = pieces.white;
        const blackPieces = pieces.black;

        // King vs King
        if (whitePieces.length === 0 && blackPieces.length === 0) return true;

        // King + Bishop vs King or King + Knight vs King
        if (whitePieces.length === 0 && blackPieces.length === 1) {
            if (blackPieces[0].type === ChessGame.BISHOP || blackPieces[0].type === ChessGame.KNIGHT) {
                return true;
            }
        }
        if (blackPieces.length === 0 && whitePieces.length === 1) {
            if (whitePieces[0].type === ChessGame.BISHOP || whitePieces[0].type === ChessGame.KNIGHT) {
                return true;
            }
        }

        // King + Bishop vs King + Bishop (same color bishops)
        if (whitePieces.length === 1 && blackPieces.length === 1) {
            if (whitePieces[0].type === ChessGame.BISHOP && blackPieces[0].type === ChessGame.BISHOP) {
                const whiteColor = (whitePieces[0].x + whitePieces[0].y) % 2;
                const blackColor = (blackPieces[0].x + blackPieces[0].y) % 2;
                if (whiteColor === blackColor) return true;
            }
        }

        return false;
    }

    /**
     * Convert move to algebraic notation
     */
    moveToAlgebraic(moveRecord) {
        const { from, to, piece, captured, castling, enPassant, promotion } = moveRecord;

        // Castling
        if (castling) {
            return castling === 'kingside' ? 'O-O' : 'O-O-O';
        }

        let notation = '';

        // Piece letter (except pawn)
        if (piece.type !== ChessGame.PAWN) {
            notation += piece.type;

            // Disambiguation for same piece type that can reach same square
            const disambig = this.getDisambiguation(from, to, piece);
            notation += disambig;
        }

        // Capture indicator
        if (captured || enPassant) {
            if (piece.type === ChessGame.PAWN) {
                notation += String.fromCharCode(97 + from.x);
            }
            notation += 'x';
        }

        // Destination square
        notation += String.fromCharCode(97 + to.x) + (to.y + 1);

        // Promotion
        if (promotion) {
            notation += '=' + promotion;
        }

        // Check or checkmate indicator
        // This should be calculated after the move is made
        // We'll add it later in the move execution

        return notation;
    }

    /**
     * Get disambiguation string for algebraic notation
     */
    getDisambiguation(from, to, piece) {
        let sameTypePieces = [];

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                if (x === from.x && y === from.y) continue;
                const p = this.getPiece(x, y);
                if (p && p.type === piece.type && p.color === piece.color) {
                    const moves = this.getLegalMoves(x, y);
                    if (moves.some(m => m.x === to.x && m.y === to.y)) {
                        sameTypePieces.push({ x, y });
                    }
                }
            }
        }

        if (sameTypePieces.length === 0) return '';

        // Check if file is unique
        const sameFile = sameTypePieces.some(p => p.x === from.x);
        const sameRank = sameTypePieces.some(p => p.y === from.y);

        if (!sameFile) {
            return String.fromCharCode(97 + from.x);
        } else if (!sameRank) {
            return String(from.y + 1);
        } else {
            return String.fromCharCode(97 + from.x) + (from.y + 1);
        }
    }

    /**
     * Add check/checkmate symbols to notation
     */
    addCheckSymbol(notation) {
        if (this.gameOver && this.gameEndReason === 'checkmate') {
            return notation + '#';
        } else if (this.isInCheck(this.currentPlayer)) {
            return notation + '+';
        }
        return notation;
    }

    /**
     * Get opponent color
     */
    getOpponent(color) {
        return color === ChessGame.WHITE ? ChessGame.BLACK : ChessGame.WHITE;
    }

    /**
     * Resign the game
     */
    resign(color) {
        this.gameOver = true;
        this.gameResult = this.getOpponent(color);
        this.gameEndReason = 'resign';
    }

    /**
     * Agree to a draw
     */
    agreeDraw() {
        this.gameOver = true;
        this.gameResult = 'draw';
        this.gameEndReason = 'agreement';
    }

    /**
     * Get all legal moves for current player
     */
    getAllLegalMoves() {
        const moves = [];
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.color === this.currentPlayer) {
                    const pieceMoves = this.getLegalMoves(x, y);
                    for (const move of pieceMoves) {
                        moves.push({
                            from: { x, y },
                            to: move,
                            piece
                        });
                    }
                }
            }
        }
        return moves;
    }

    /**
     * Serialize game state
     */
    serialize() {
        return {
            board: this.board.map(col => col.map(cell => cell ? { ...cell } : null)),
            currentPlayer: this.currentPlayer,
            moveHistory: this.moveHistory.map(m => ({ ...m })),
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            gameOver: this.gameOver,
            gameResult: this.gameResult,
            gameEndReason: this.gameEndReason,
            castlingRights: { ...this.castlingRights },
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            kingPositions: {
                white: { ...this.kingPositions.white },
                black: { ...this.kingPositions.black }
            }
        };
    }

    /**
     * Deserialize game state
     */
    deserialize(state) {
        this.board = state.board.map(col => col.map(cell => cell ? { ...cell } : null));
        this.currentPlayer = state.currentPlayer;
        this.moveHistory = state.moveHistory.map(m => ({ ...m }));
        this.redoStack = [];
        this.capturedPieces = {
            white: [...state.capturedPieces.white],
            black: [...state.capturedPieces.black]
        };
        this.gameOver = state.gameOver;
        this.gameResult = state.gameResult;
        this.gameEndReason = state.gameEndReason;
        this.castlingRights = { ...state.castlingRights };
        this.enPassantTarget = state.enPassantTarget ? { ...state.enPassantTarget } : null;
        this.halfMoveClock = state.halfMoveClock;
        this.fullMoveNumber = state.fullMoveNumber;
        this.kingPositions = {
            white: { ...state.kingPositions.white },
            black: { ...state.kingPositions.black }
        };

        // Rebuild position history
        this.positionHistory = [this.getPositionKey()];
    }

    /**
     * Get current position in FEN format
     */
    getFEN() {
        let fen = '';

        // Piece placement (from rank 8 to rank 1)
        for (let y = 7; y >= 0; y--) {
            let emptyCount = 0;
            for (let x = 0; x < 8; x++) {
                const piece = this.getPiece(x, y);
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    let letter = piece.type;
                    if (piece.color === ChessGame.BLACK) {
                        letter = letter.toLowerCase();
                    }
                    fen += letter;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (y > 0) fen += '/';
        }

        // Active color
        fen += ' ' + (this.currentPlayer === ChessGame.WHITE ? 'w' : 'b');

        // Castling availability
        let castling = '';
        if (this.castlingRights.whiteKingside) castling += 'K';
        if (this.castlingRights.whiteQueenside) castling += 'Q';
        if (this.castlingRights.blackKingside) castling += 'k';
        if (this.castlingRights.blackQueenside) castling += 'q';
        fen += ' ' + (castling || '-');

        // En passant target
        if (this.enPassantTarget) {
            fen += ' ' + String.fromCharCode(97 + this.enPassantTarget.x) + (this.enPassantTarget.y + 1);
        } else {
            fen += ' -';
        }

        // Halfmove clock
        fen += ' ' + this.halfMoveClock;

        // Fullmove number
        fen += ' ' + this.fullMoveNumber;

        return fen;
    }

    /**
     * Set position from FEN string
     */
    setFEN(fen) {
        const parts = fen.split(' ');
        if (parts.length < 4) return false;

        // Clear board
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));

        // Parse piece placement
        const ranks = parts[0].split('/');
        for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
            const y = 7 - rankIndex;
            let x = 0;
            for (const char of ranks[rankIndex]) {
                if (char >= '1' && char <= '8') {
                    x += parseInt(char);
                } else {
                    const color = char === char.toUpperCase() ? ChessGame.WHITE : ChessGame.BLACK;
                    const type = char.toUpperCase();
                    this.setPiece(x, y, { type, color });
                    if (type === ChessGame.KING) {
                        this.kingPositions[color] = { x, y };
                    }
                    x++;
                }
            }
        }

        // Active color
        this.currentPlayer = parts[1] === 'w' ? ChessGame.WHITE : ChessGame.BLACK;

        // Castling rights
        this.castlingRights = {
            whiteKingside: parts[2].includes('K'),
            whiteQueenside: parts[2].includes('Q'),
            blackKingside: parts[2].includes('k'),
            blackQueenside: parts[2].includes('q')
        };

        // En passant target
        if (parts[3] !== '-') {
            const file = parts[3].charCodeAt(0) - 97;
            const rank = parseInt(parts[3].charAt(1)) - 1;
            this.enPassantTarget = { x: file, y: rank };
        } else {
            this.enPassantTarget = null;
        }

        // Halfmove clock
        this.halfMoveClock = parts.length > 4 ? parseInt(parts[4]) : 0;

        // Fullmove number
        this.fullMoveNumber = parts.length > 5 ? parseInt(parts[5]) : 1;

        // Reset other state
        this.moveHistory = [];
        this.redoStack = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.gameResult = null;
        this.gameEndReason = null;
        this.positionHistory = [this.getPositionKey()];

        return true;
    }

    /**
     * Clone the game state (for AI simulation)
     */
    clone() {
        const clone = new ChessGame();
        clone.deserialize(this.serialize());
        clone.positionHistory = [...this.positionHistory];
        return clone;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessGame;
}
