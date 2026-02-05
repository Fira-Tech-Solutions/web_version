import { useState, useEffect, useRef } from 'react';

interface VoiceSettings {
  volume: number;
  rate: number;
  pitch: number;
}

interface UseBingoVoiceReturn {
  announceNumber: (number: number) => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
  voiceSettings: VoiceSettings;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  isSupported: boolean;
}

export const useBingoVoice = (): UseBingoVoiceReturn => {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    volume: 1,
    rate: 1,
    pitch: 1
  });
  const [isSupported, setIsSupported] = useState(false);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  // Get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    if (num >= 61 && num <= 75) return 'O';
    return '';
  };

  // Initialize voices and select default
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        // Select a professional English voice by default
        const preferredVoices = [
          'Google UK English Male',
          'Google UK English Female',
          'Microsoft David',
          'Microsoft Zira',
          'Alex',
          'Samantha'
        ];
        
        let selected = voices.find(voice => 
          preferredVoices.some(preferred => voice.name.includes(preferred))
        );
        
        // Fallback to any English voice
        if (!selected) {
          selected = voices.find(voice => voice.lang.includes('en'));
        }
        
        // Final fallback to first available voice
        if (!selected && voices.length > 0) {
          selected = voices[0];
        }
        
        setSelectedVoice(selected || null);
      };

      loadVoices();
      
      // Voices load asynchronously, so listen for the event
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
      
      return () => {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    } else {
      setIsSupported(false);
    }
  }, []);

  const announceNumber = (number: number) => {
    if (!isSupported || !selectedVoice) return;

    // Cancel any ongoing speech to prevent lag
    if (currentUtterance.current) {
      speechSynthesis.cancel();
    }

    const letter = getLetterForNumber(number);
    const text = `${letter}. ${number}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.volume = voiceSettings.volume;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    
    // Add slight pause between letter and number for clarity
    utterance.text = `${letter}... ${number}`;

    currentUtterance.current = utterance;
    speechSynthesis.speak(utterance);

    // Clear reference when done
    utterance.onend = () => {
      currentUtterance.current = null;
    };
  };

  const updateVoiceSettings = (newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...newSettings }));
  };

  return {
    announceNumber,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    voiceSettings,
    updateVoiceSettings,
    isSupported
  };
};
