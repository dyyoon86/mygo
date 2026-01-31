/**
 * PGNHandler - PGN (Portable Game Notation) file handler for chess games
 *
 * Supports:
 * - Export game to PGN format
 * - Import PGN files
 * - File download/upload
 */

class PGNHandler {
    constructor() {
        this.defaultTags = {
            Event: '온라인 체스',
            Site: 'baduk.ionflow.xyz',
            Date: this.formatDate(new Date()),
            Round: '?',
            White: '플레이어',
            Black: 'AI',
            Result: '*'
        };
    }

    /**
     * Format date as YYYY.MM.DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }

    /**
     * Export game to PGN string
     */
    exportPGN(game, metadata = {}) {
        const tags = { ...this.defaultTags, ...metadata };

        // Update result based on game state
        if (game.gameOver) {
            if (game.gameResult === 'white') {
                tags.Result = '1-0';
            } else if (game.gameResult === 'black') {
                tags.Result = '0-1';
            } else {
                tags.Result = '1/2-1/2';
            }
        }

        // Build header
        let pgn = '';
        for (const [key, value] of Object.entries(tags)) {
            pgn += `[${key} "${value}"]\n`;
        }
        pgn += '\n';

        // Build move text
        const moves = [];
        for (let i = 0; i < game.moveHistory.length; i++) {
            const move = game.moveHistory[i];
            const moveNum = Math.floor(i / 2) + 1;

            if (i % 2 === 0) {
                moves.push(`${moveNum}. ${move.notation}`);
            } else {
                moves.push(move.notation);
            }
        }

        // Add result
        moves.push(tags.Result);

        // Wrap lines at 80 characters
        let moveText = '';
        let lineLength = 0;
        for (const move of moves) {
            if (lineLength + move.length + 1 > 80) {
                moveText += '\n';
                lineLength = 0;
            } else if (lineLength > 0) {
                moveText += ' ';
                lineLength++;
            }
            moveText += move;
            lineLength += move.length;
        }

        pgn += moveText;
        return pgn;
    }

    /**
     * Parse PGN string
     */
    parsePGN(pgnString) {
        const result = {
            tags: {},
            moves: [],
            result: '*'
        };

        // Split into lines
        const lines = pgnString.split('\n');
        let moveSection = false;
        let moveText = '';

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) {
                if (Object.keys(result.tags).length > 0) {
                    moveSection = true;
                }
                continue;
            }

            // Parse tags
            if (trimmed.startsWith('[')) {
                const match = trimmed.match(/\[(\w+)\s+"([^"]*)"\]/);
                if (match) {
                    result.tags[match[1]] = match[2];
                }
            } else {
                moveSection = true;
                moveText += ' ' + trimmed;
            }
        }

        // Parse moves
        result.moves = this.parseMoves(moveText.trim());

        // Extract result
        if (result.tags.Result) {
            result.result = result.tags.Result;
        }

        return result;
    }

    /**
     * Parse move text into array of moves
     */
    parseMoves(moveText) {
        const moves = [];

        // Remove comments
        moveText = moveText.replace(/\{[^}]*\}/g, '');

        // Remove variations
        moveText = moveText.replace(/\([^)]*\)/g, '');

        // Remove NAGs (Numeric Annotation Glyphs)
        moveText = moveText.replace(/\$\d+/g, '');

        // Split into tokens
        const tokens = moveText.split(/\s+/);

        for (const token of tokens) {
            // Skip move numbers
            if (/^\d+\.+$/.test(token)) continue;

            // Skip results
            if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) continue;

            // Skip empty tokens
            if (!token) continue;

            // Remove move number prefix if present (e.g., "1.e4" -> "e4")
            const move = token.replace(/^\d+\./, '');
            if (move) {
                moves.push(move);
            }
        }

        return moves;
    }

    /**
     * Apply PGN moves to a game
     */
    applyToGame(game, pgnData) {
        game.reset();

        for (const moveNotation of pgnData.moves) {
            const move = this.parseMove(game, moveNotation);
            if (move) {
                game.makeMove(move.from.x, move.from.y, move.to.x, move.to.y, move.promotion);
            } else {
                console.warn(`Failed to parse move: ${moveNotation}`);
                break;
            }
        }

        return game;
    }

    /**
     * Parse a single move in algebraic notation
     */
    parseMove(game, notation) {
        // Handle castling
        if (notation === 'O-O' || notation === '0-0') {
            const y = game.currentPlayer === ChessGame.WHITE ? 0 : 7;
            return { from: { x: 4, y }, to: { x: 6, y } };
        }
        if (notation === 'O-O-O' || notation === '0-0-0') {
            const y = game.currentPlayer === ChessGame.WHITE ? 0 : 7;
            return { from: { x: 4, y }, to: { x: 2, y } };
        }

        // Remove check/checkmate symbols
        notation = notation.replace(/[+#]$/, '');

        // Parse promotion
        let promotion = null;
        const promMatch = notation.match(/=([QRBN])$/);
        if (promMatch) {
            promotion = promMatch[1];
            notation = notation.replace(/=[QRBN]$/, '');
        }

        // Parse destination square (last 2 characters)
        const destMatch = notation.match(/([a-h])([1-8])$/);
        if (!destMatch) return null;

        const toX = destMatch[1].charCodeAt(0) - 97;
        const toY = parseInt(destMatch[2]) - 1;
        notation = notation.slice(0, -2);

        // Parse capture indicator
        const isCapture = notation.includes('x');
        notation = notation.replace('x', '');

        // Parse piece type
        let pieceType = ChessGame.PAWN;
        if (notation.length > 0 && /[KQRBN]/.test(notation[0])) {
            pieceType = notation[0];
            notation = notation.slice(1);
        }

        // Parse disambiguation
        let disambigFile = null;
        let disambigRank = null;
        if (notation.length > 0) {
            for (const char of notation) {
                if (char >= 'a' && char <= 'h') {
                    disambigFile = char.charCodeAt(0) - 97;
                } else if (char >= '1' && char <= '8') {
                    disambigRank = parseInt(char) - 1;
                }
            }
        }

        // Find the piece that can make this move
        const moves = game.getAllLegalMoves();
        for (const move of moves) {
            if (move.to.x !== toX || move.to.y !== toY) continue;
            if (move.piece.type !== pieceType) continue;
            if (disambigFile !== null && move.from.x !== disambigFile) continue;
            if (disambigRank !== null && move.from.y !== disambigRank) continue;

            return {
                from: move.from,
                to: { x: toX, y: toY },
                promotion
            };
        }

        return null;
    }

    /**
     * Download PGN file
     */
    downloadPGN(game, filename = 'chess_game.pgn', metadata = {}) {
        const pgn = this.exportPGN(game, metadata);
        const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Load PGN from file
     */
    loadPGNFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const pgn = this.parsePGN(e.target.result);
                    resolve(pgn);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Copy PGN to clipboard
     */
    async copyToClipboard(game, metadata = {}) {
        const pgn = this.exportPGN(game, metadata);
        try {
            await navigator.clipboard.writeText(pgn);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PGNHandler;
}
