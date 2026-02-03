import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BingoGameProps {
  onGameComplete?: (winner: string) => void;
}

export default function BingoGame({ onGameComplete }: BingoGameProps) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [bingoBoard, setBingoBoard] = useState<number[][]>([]);

  // Generate random Bingo board
  const generateBingoBoard = () => {
    const board: number[][] = [];
    const ranges = [
      [1, 15],   // B column
      [16, 30],  // I column  
      [31, 45],  // N column
      [46, 60],  // G column
      [61, 75]   // O column
    ];

    for (let col = 0; col < 5; col++) {
      const column: number[] = [];
      const [min, max] = ranges[col];
      const availableNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      
      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          column.push(0); // FREE space
        } else {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          column.push(availableNumbers.splice(randomIndex, 1)[0]);
        }
      }
      board.push(column);
    }
    
    return board;
  };

  // Call next number
  const callNumber = () => {
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
    
    if (availableNumbers.length === 0) {
      setGameActive(false);
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];
    
    setCurrentNumber(newNumber);
    setCalledNumbers(prev => [...prev, newNumber]);
  };

  // Start new game
  const startNewGame = () => {
    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameActive(true);
    setBingoBoard(generateBingoBoard());
  };

  // Get letter for number
  const getLetterForNumber = (num: number) => {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    if (num >= 61 && num <= 75) return 'O';
    return '';
  };

  // Check if number is called
  const isNumberCalled = (num: number) => {
    return calledNumbers.includes(num);
  };

  // Generate called numbers display by letter
  const getNumbersByLetter = () => {
    const byLetter = {
      B: calledNumbers.filter(n => n >= 1 && n <= 15).sort((a, b) => a - b),
      I: calledNumbers.filter(n => n >= 16 && n <= 30).sort((a, b) => a - b),
      N: calledNumbers.filter(n => n >= 31 && n <= 45).sort((a, b) => a - b),
      G: calledNumbers.filter(n => n >= 46 && n <= 60).sort((a, b) => a - b),
      O: calledNumbers.filter(n => n >= 61 && n <= 75).sort((a, b) => a - b)
    };
    return byLetter;
  };

  const numbersByLetter = getNumbersByLetter();

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Bingo Game Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Number Display */}
            <div className="text-center">
              {currentNumber && (
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-blue-500 text-white text-4xl font-bold mb-4">
                  {getLetterForNumber(currentNumber)}-{currentNumber}
                </div>
              )}
              {!gameActive && calledNumbers.length === 0 && (
                <div className="text-gray-500 text-lg">Press "Start New Game" to begin</div>
              )}
            </div>

            {/* Game Controls */}
            <div className="flex gap-4 justify-center">
              {!gameActive ? (
                <Button onClick={startNewGame} className="px-8 py-3 text-lg">
                  Start New Game
                </Button>
              ) : (
                <Button onClick={callNumber} className="px-8 py-3 text-lg">
                  Call Next Number
                </Button>
              )}
              {gameActive && (
                <Button 
                  onClick={() => setGameActive(false)} 
                  variant="outline"
                  className="px-8 py-3 text-lg"
                >
                  End Game
                </Button>
              )}
            </div>

            {/* Game Stats */}
            <div className="text-center text-sm text-gray-600">
              Numbers Called: {calledNumbers.length} / 75
            </div>
          </CardContent>
        </Card>

        {/* Called Numbers Board */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Called Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['B', 'I', 'N', 'G', 'O'] as const).map(letter => (
                <div key={letter}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center font-bold">
                      {letter}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {numbersByLetter[letter].map(num => (
                        <Badge 
                          key={num} 
                          variant={num === currentNumber ? "default" : "secondary"}
                          className={num === currentNumber ? "bg-yellow-500 text-black" : ""}
                        >
                          {num}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sample Bingo Card */}
        {bingoBoard.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-center">Sample Bingo Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map(letter => (
                    <div key={letter} className="h-12 bg-red-500 text-white rounded flex items-center justify-center font-bold text-xl">
                      {letter}
                    </div>
                  ))}
                </div>
                
                {/* Numbers */}
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }, (_, row) =>
                    Array.from({ length: 5 }, (_, col) => {
                      const number = bingoBoard[col][row];
                      const isFree = col === 2 && row === 2;
                      const isCalled = !isFree && isNumberCalled(number);
                      
                      return (
                        <div
                          key={`${row}-${col}`}
                          className={`h-12 border-2 rounded flex items-center justify-center font-bold text-lg ${
                            isFree 
                              ? 'bg-yellow-300 text-black border-yellow-400' 
                              : isCalled 
                                ? 'bg-green-400 text-white border-green-500' 
                                : 'bg-white text-black border-gray-300'
                          }`}
                        >
                          {isFree ? 'FREE' : number}
                        </div>
                      );
                    })
                  ).flat()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}