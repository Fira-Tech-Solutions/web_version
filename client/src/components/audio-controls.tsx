import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { customBingoVoice, VoiceOption } from "@/lib/custom-voice-synthesis";

interface AudioControlsProps {
  onTestVoice?: () => void;
}

export default function AudioControls({ onTestVoice }: AudioControlsProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [volume, setVolume] = useState(1.0);
  const [isTestPlaying, setIsTestPlaying] = useState(false);

  useEffect(() => {
    // Load available voices
    const availableVoices = customBingoVoice.getAvailableVoices();
    setVoices(availableVoices);
    
    const currentVoice = customBingoVoice.getCurrentVoice();
    if (currentVoice) {
      setSelectedVoice(currentVoice);
      setVolume(customBingoVoice.getVolume());
    }
  }, []);

  const handleVoiceChange = (voiceName: string) => {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      customBingoVoice.setVoice(voice);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    customBingoVoice.setVolume(vol);
  };

  const handleTestVoice = async () => {
    if (isTestPlaying) {
      customBingoVoice.stop();
      setIsTestPlaying(false);
      return;
    }

    setIsTestPlaying(true);
    try {
      await customBingoVoice.testVoice();
      if (onTestVoice) onTestVoice();
    } catch (error) {
      console.error('Error testing voice:', error);
    } finally {
      setIsTestPlaying(false);
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Voice Character
          </label>
          <Select value={selectedVoice?.name || ""} onValueChange={handleVoiceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.name} value={voice.name}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.displayName}</span>
                    <span className="text-xs text-gray-500">{voice.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Volume Control */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Volume: {Math.round(volume * 100)}%
          </label>
          <div className="flex items-center gap-3">
            {getVolumeIcon()}
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={1}
              min={0}
              step={0.1}
              className="flex-1"
            />
          </div>
        </div>

        {/* Test Button */}
        <Button
          onClick={handleTestVoice}
          variant={isTestPlaying ? "destructive" : "default"}
          className="w-full"
        >
          {isTestPlaying ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Stop Test
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Test Voice
            </>
          )}
        </Button>

        {/* Current Status */}
        {selectedVoice && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <div>Current: {selectedVoice.displayName}</div>
            <div>Character: {selectedVoice.name}</div>
            <div>Volume: {Math.round(volume * 100)}%</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
