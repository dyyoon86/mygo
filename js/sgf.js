/**
 * SGF (Smart Game Format) 파일 처리
 * 바둑 기보 저장 및 불러오기
 */
class SGFHandler {
    constructor() {
        this.alphabet = 'abcdefghijklmnopqrs';
    }

    // 좌표를 SGF 포맷으로 변환 (0,0 -> aa)
    coordToSGF(x, y) {
        return this.alphabet[x] + this.alphabet[y];
    }

    // SGF 포맷을 좌표로 변환 (aa -> 0,0)
    sgfToCoord(sgf) {
        if (sgf.length !== 2) return null;
        const x = this.alphabet.indexOf(sgf[0].toLowerCase());
        const y = this.alphabet.indexOf(sgf[1].toLowerCase());
        if (x === -1 || y === -1) return null;
        return { x, y };
    }

    // 게임을 SGF 문자열로 변환
    exportSGF(game, metadata = {}) {
        const size = game.size;
        const moves = game.moveHistory;

        // SGF 헤더
        let sgf = '(;FF[4]GM[1]';
        sgf += `SZ[${size}]`;
        sgf += `CA[UTF-8]`;
        sgf += `AP[BadukWeb:1.0]`;

        // 메타데이터
        if (metadata.gameName) sgf += `GN[${this.escape(metadata.gameName)}]`;
        if (metadata.blackPlayer) sgf += `PB[${this.escape(metadata.blackPlayer)}]`;
        if (metadata.whitePlayer) sgf += `PW[${this.escape(metadata.whitePlayer)}]`;
        if (metadata.date) sgf += `DT[${metadata.date}]`;
        if (metadata.result) sgf += `RE[${metadata.result}]`;

        sgf += `KM[6.5]`; // 덤
        sgf += `RU[Korean]`; // 한국 룰

        // 기보
        for (const move of moves) {
            if (move.pass) {
                // 패스
                const color = move.player === 'black' ? 'B' : 'W';
                sgf += `;${color}[]`;
            } else {
                // 착수
                const color = move.player === 'black' ? 'B' : 'W';
                const coord = this.coordToSGF(move.x, move.y);
                sgf += `;${color}[${coord}]`;
            }
        }

        sgf += ')';
        return sgf;
    }

    // SGF 문자열을 파싱
    parseSGF(sgfString) {
        try {
            const result = {
                size: 19,
                moves: [],
                metadata: {}
            };

            // 기본 정리
            sgfString = sgfString.trim();

            // 프로퍼티 추출
            const sizeMatch = sgfString.match(/SZ\[(\d+)\]/);
            if (sizeMatch) {
                result.size = parseInt(sizeMatch[1]);
            }

            // 메타데이터 추출
            const gnMatch = sgfString.match(/GN\[([^\]]*)\]/);
            if (gnMatch) result.metadata.gameName = this.unescape(gnMatch[1]);

            const pbMatch = sgfString.match(/PB\[([^\]]*)\]/);
            if (pbMatch) result.metadata.blackPlayer = this.unescape(pbMatch[1]);

            const pwMatch = sgfString.match(/PW\[([^\]]*)\]/);
            if (pwMatch) result.metadata.whitePlayer = this.unescape(pwMatch[1]);

            const dtMatch = sgfString.match(/DT\[([^\]]*)\]/);
            if (dtMatch) result.metadata.date = dtMatch[1];

            const reMatch = sgfString.match(/RE\[([^\]]*)\]/);
            if (reMatch) result.metadata.result = reMatch[1];

            const kmMatch = sgfString.match(/KM\[([^\]]*)\]/);
            if (kmMatch) result.metadata.komi = parseFloat(kmMatch[1]);

            // 수순 추출
            const movePattern = /;([BW])\[([a-s]{0,2})\]/g;
            let match;

            while ((match = movePattern.exec(sgfString)) !== null) {
                const color = match[1] === 'B' ? 'black' : 'white';
                const coord = match[2];

                if (coord === '' || coord.length === 0) {
                    // 패스
                    result.moves.push({ pass: true, player: color });
                } else {
                    // 착수
                    const pos = this.sgfToCoord(coord);
                    if (pos) {
                        result.moves.push({
                            x: pos.x,
                            y: pos.y,
                            player: color
                        });
                    }
                }
            }

            return result;

        } catch (e) {
            console.error('SGF parsing error:', e);
            return null;
        }
    }

    // SGF 특수문자 이스케이프
    escape(str) {
        return str.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
    }

    // 이스케이프 해제
    unescape(str) {
        return str.replace(/\\\]/g, ']').replace(/\\\\/g, '\\');
    }

    // 파일로 저장
    downloadSGF(game, filename = 'game.sgf') {
        const date = new Date().toISOString().split('T')[0];
        const metadata = {
            gameName: 'Baduk Web Game',
            blackPlayer: '흑',
            whitePlayer: '백',
            date: date,
            result: game.gameOver ? this.getResult(game) : ''
        };

        const sgfContent = this.exportSGF(game, metadata);
        const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 결과 문자열 생성
    getResult(game) {
        const score = game.calculateScore();
        const diff = Math.abs(score.black - score.white);

        if (score.black > score.white) {
            return `B+${diff.toFixed(1)}`;
        } else {
            return `W+${diff.toFixed(1)}`;
        }
    }

    // 파일 읽기
    async loadSGFFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target.result;
                const parsed = this.parseSGF(content);

                if (parsed) {
                    resolve(parsed);
                } else {
                    reject(new Error('Invalid SGF file'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    // 게임에 SGF 적용
    applyToGame(game, sgfData) {
        game.reset(sgfData.size);

        for (const move of sgfData.moves) {
            if (move.pass) {
                game.pass();
            } else {
                const result = game.placeStone(move.x, move.y);
                if (!result.success) {
                    console.warn(`Invalid move at ${move.x}, ${move.y}`);
                }
            }
        }

        return true;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SGFHandler;
}
