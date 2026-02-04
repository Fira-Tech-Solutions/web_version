import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, XCircle, X } from "lucide-react";
import { customBingoVoice } from "@/lib/custom-voice-synthesis";

interface WinnerCheckPopupProps {
  isOpen: boolean;
  onClose: () => void;
  calledNumbers: number[];
  onCheckWinner: (cartelaNumber: number) => Promise<{ isWinner: boolean; pattern?: string }>;
  initialCartelaNumber?: string;
}

export default function WinnerCheckPopup({ 
  isOpen, 
  onClose, 
  calledNumbers, 
  onCheckWinner,
  initialCartelaNumber
}: WinnerCheckPopupProps) {
  const [cartelaNumber, setCartelaNumber] = useState(initialCartelaNumber || "");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ isWinner: boolean; pattern?: string } | null>(null);

  // Reset form when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      setCartelaNumber(initialCartelaNumber || "");
      setResult(null);
    }
  }, [isOpen, initialCartelaNumber]);

  const handleCheck = async () => {
    const num = parseInt(cartelaNumber);
    if (!num || num <= 0) {
      return;
    }

    setIsChecking(true);
    try {
      const checkResult = await onCheckWinner(num);
      setResult(checkResult);
      
      // Announce result with voice
      await customBingoVoice.announceWinner(num, checkResult.isWinner);
    } catch (error) {
      console.error('Error checking winner:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCartelaNumber("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Winner Check
          </h2>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Input Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cartela Number
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={cartelaNumber}
                onChange={(e) => setCartelaNumber(e.target.value)}
                placeholder="Enter cartela number"
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
              />
              <Button
                onClick={handleCheck}
                disabled={!cartelaNumber || isChecking}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isChecking ? "Checking..." : "Check"}
              </Button>
            </div>
          </div>

          {/* Called Numbers Display */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Called Numbers ({calledNumbers.length}/75)
            </h3>
            <div className="bg-gray-100 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {calledNumbers.slice(-20).map((num) => {
                  const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
                  const color = num <= 15 ? 'bg-blue-500' : num <= 30 ? 'bg-red-500' : num <= 45 ? 'bg-white' : num <= 60 ? 'bg-green-500' : 'bg-yellow-500';
                  return (
                    <Badge
                      key={num}
                      variant="secondary"
                      className={`${color} text-white text-xs`}
                    >
                      {letter}{num}
                    </Badge>
                  );
                })}
                {calledNumbers.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{calledNumbers.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`border-2 rounded-lg p-4 text-center ${
              result.isWinner 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex justify-center mb-2">
                {result.isWinner ? (
                  <Trophy className="w-12 h-12 text-yellow-500" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-500" />
                )}
              </div>
              <h3 className={`text-lg font-bold mb-1 ${
                result.isWinner ? 'text-green-700' : 'text-red-700'
              }`}>
                {result.isWinner ? '🎉 WINNER! 🎉' : 'NOT A WINNER'}
              </h3>
              <p className="text-gray-600">
                Cartela #{cartelaNumber} {result.isWinner ? 'has won!' : 'did not win.'}
              </p>
              {result.pattern && (
                <p className="text-sm text-gray-500 mt-1">
                  Pattern: {result.pattern}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end">
          <Button
            onClick={handleClose}
            variant="outline"
            className="mr-2"
          >
            Close
          </Button>
          {result && (
            <Button
              onClick={() => {
                setResult(null);
                setCartelaNumber("");
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Check Another
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
