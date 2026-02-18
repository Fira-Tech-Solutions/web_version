// @ts-nocheck
/**
 * Bingo win-checking service.
 * Pure utility — no side effects, no database access.
 */

export interface BingoWinResult {
    isWinner: boolean;
    pattern?: string | null;
    winningCells?: number[];
}

/**
 * Check if a cartela pattern has a BINGO win given called numbers.
 */
export function checkBingoWin(
    cartelaPattern: number[][],
    calledNumbers: number[]
): BingoWinResult {
    const calledSet = new Set(calledNumbers);

    console.log('🔍 DETAILED BINGO CHECK:', {
        pattern: cartelaPattern,
        called: calledNumbers,
        calledSet: Array.from(calledSet)
    });

    // Check rows
    for (let row = 0; row < 5; row++) {
        let rowComplete = true;
        let rowDetails = [];
        for (let col = 0; col < 5; col++) {
            const num = cartelaPattern[row][col];
            const isMarked = (num === 0) || calledSet.has(num);
            rowDetails.push({ num, isMarked, isFree: num === 0 });
            if (num !== 0 && !calledSet.has(num)) {
                rowComplete = false;
            }
        }
        console.log(`Row ${row + 1}:`, { rowDetails, rowComplete });
        if (rowComplete) {
            console.log(`🎯 WINNER FOUND: Horizontal Row ${row + 1}`);
            const winningCells = [];
            for (let col = 0; col < 5; col++) {
                winningCells.push(row * 5 + col);
            }
            return { isWinner: true, pattern: `Horizontal Row ${row + 1}`, winningCells };
        }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
        let colComplete = true;
        let colDetails = [];
        for (let row = 0; row < 5; row++) {
            const num = cartelaPattern[row][col];
            const isMarked = (num === 0) || calledSet.has(num);
            colDetails.push({ num, isMarked, isFree: num === 0 });
            if (num !== 0 && !calledSet.has(num)) {
                colComplete = false;
            }
        }
        console.log(`Column ${col + 1}:`, { colDetails, colComplete });
        if (colComplete) {
            const columnNames = ['B', 'I', 'N', 'G', 'O'];
            console.log(`🎯 WINNER FOUND: Vertical Column ${columnNames[col]}`);
            const winningCells = [];
            for (let row = 0; row < 5; row++) {
                winningCells.push(row * 5 + col);
            }
            return { isWinner: true, pattern: `Vertical Column ${columnNames[col]}`, winningCells };
        }
    }

    // Check diagonal 1 (top-left to bottom-right)
    let diag1Complete = true;
    let diag1Details = [];
    for (let i = 0; i < 5; i++) {
        const num = cartelaPattern[i][i];
        const isMarked = (num === 0) || calledSet.has(num);
        diag1Details.push({ num, isMarked, isFree: num === 0 });
        if (num !== 0 && !calledSet.has(num)) {
            diag1Complete = false;
        }
    }
    console.log('Diagonal 1:', { diag1Details, diag1Complete });
    if (diag1Complete) {
        console.log('🎯 WINNER FOUND: Diagonal (Top-Left to Bottom-Right)');
        const winningCells = [];
        for (let i = 0; i < 5; i++) {
            winningCells.push(i * 5 + i);
        }
        return { isWinner: true, pattern: 'Diagonal (Top-Left to Bottom-Right)', winningCells };
    }

    // Check diagonal 2 (top-right to bottom-left)
    let diag2Complete = true;
    let diag2Details = [];
    for (let i = 0; i < 5; i++) {
        const num = cartelaPattern[i][4 - i];
        const isMarked = (num === 0) || calledSet.has(num);
        diag2Details.push({ num, isMarked, isFree: num === 0 });
        if (num !== 0 && !calledSet.has(num)) {
            diag2Complete = false;
        }
    }
    console.log('Diagonal 2:', { diag2Details, diag2Complete });
    if (diag2Complete) {
        console.log('🎯 WINNER FOUND: Diagonal (Top-Right to Bottom-Left)');
        const winningCells = [];
        for (let i = 0; i < 5; i++) {
            winningCells.push(i * 5 + (4 - i));
        }
        return { isWinner: true, pattern: 'Diagonal (Top-Right to Bottom-Left)', winningCells };
    }

    console.log('❌ NO WINNER FOUND');
    return { isWinner: false, pattern: null };
}
