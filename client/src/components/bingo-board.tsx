import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayIcon, PauseIcon } from "lucide-react";
import { Game } from "@/types/game";

interface BingoBoardProps {
  game?: Game;
  isConnected: boolean;
  onCallNumber: () => void;
}

export function BingoBoard({ game, isConnected, onCallNumber }: BingoBoardProps) {
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);

  const calledNumbers = game?.calledNumbers || [];
  const lastCalledNumber = calledNumbers[calledNumbers.length - 1];

  // Generate standard bingo board
  const generateBoard = () => {
    const board = [];
    const ranges = {
      B: [1, 15],
      I: [16, 30],
      N: [31, 45],
      G: [46, 60],
      O: [61, 75]
    };

    const letters = ['B', 'I', 'N', 'G', 'O'];
    
    for (let row = 0; row < 6; row++) {
      const boardRow = [];
      for (let col = 0; col < 5; col++) {
        if (row === 0) {
          // Header row
          boardRow.push({ type: 'header', value: letters[col] });
        } else if (row === 3 && col === 2) {
          // Free space
          boardRow.push({ type: 'free', value: 'FREE' });
        } else {
          // Regular number
          const letter = letters[col];
          const [min, max] = ranges[letter as keyof typeof ranges];
          const number = min + (row - 1) * 3 + col;
          const adjustedNumber = Math.min(number, max);
          boardRow.push({ 
            type: 'number', 
            value: adjustedNumber,
            called: calledNumbers.includes(`${letter}-${adjustedNumber}`)
          });
        }
      }
      board.push(boardRow);
    }
    
    return board;
  };

  const board = generateBoard();

  const toggleAutoCall = () => {
    if (isAutoCall) {
      if (autoCallInterval) {
        clearInterval(autoCallInterval);
        setAutoCallInterval(null);
      }
      setIsAutoCall(false);
    } else {
      const interval = setInterval(() => {
        onCallNumber();
      }, 3000); // Call number every 3 seconds
      setAutoCallInterval(interval);
      setIsAutoCall(true);
    }
  };

  useEffect(() => {
    return () => {
      if (autoCallInterval) {
        clearInterval(autoCallInterval);
      }
    };
  }, [autoCallInterval]);

  const getCellClassName = (cell: any) => {
    if (cell.type === 'header') return 'bingo-header';
    if (cell.type === 'free') return 'bingo-cell free';
    if (cell.called) return 'bingo-cell called';
    return 'bingo-cell normal';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bingo Board</CardTitle>
          <div className="flex items-center space-x-4">
            {lastCalledNumber && (
              <div className="text-sm text-gray-600">
                Last Called: <span className="font-semibold text-primary">{lastCalledNumber}</span>
              </div>
            )}
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bingo Board Grid */}
        <div className="grid grid-cols-5 gap-1 mb-6">
          {board.map((row, rowIdx) => 
            row.map((cell, colIdx) => (
              <div key={`${rowIdx}-${colIdx}`} className={getCellClassName(cell)}>
                {cell.value}
              </div>
            ))
          )}
        </div>

        {/* Game Controls */}
        {game?.status === 'active' && (
          <div className="flex space-x-3 mb-6">
            <Button
              onClick={onCallNumber}
              disabled={!isConnected || isAutoCall}
              className="flex-1"
            >
              Call Next Number
            </Button>
            <Button
              onClick={toggleAutoCall}
              variant={isAutoCall ? "destructive" : "secondary"}
              disabled={!isConnected}
            >
              {isAutoCall ? (
                <>
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Stop Auto
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Auto Call
                </>
              )}
            </Button>
          </div>
        )}

        {/* Called Numbers History */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Called Numbers ({calledNumbers.length})
          </h3>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {calledNumbers.length === 0 ? (
              <p className="text-sm text-gray-500">No numbers called yet</p>
            ) : (
              calledNumbers.map((number, idx) => (
                <Badge 
                  key={idx} 
                  variant={idx === calledNumbers.length - 1 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {number}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
