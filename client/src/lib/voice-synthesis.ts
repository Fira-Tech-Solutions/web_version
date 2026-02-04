// Voice synthesis for bingo calling
export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

export class BingoVoiceSynthesis {
  private synth: SpeechSynthesis;
  private voices: VoiceOption[] = [];
  private selectedVoice: VoiceOption | null = null;
  private volume: number = 1.0;
  private rate: number = 0.9;
  private pitch: number = 1.0;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    
    // Reload voices when they change (Chrome loads voices asynchronously)
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    const availableVoices = this.synth.getVoices();
    this.voices = availableVoices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI
    }));

    // Select default English voice
    const englishVoice = this.voices.find(voice => 
      voice.lang.startsWith('en') && voice.name.includes('Google')
    ) || this.voices.find(voice => voice.lang.startsWith('en')) || this.voices[0];

    if (englishVoice) {
      this.selectedVoice = englishVoice;
    }
  }

  getAvailableVoices(): VoiceOption[] {
    return this.voices;
  }

  setVoice(voice: VoiceOption) {
    this.selectedVoice = voice;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setRate(rate: number) {
    this.rate = Math.max(0.1, Math.min(2, rate));
  }

  setPitch(pitch: number) {
    this.pitch = Math.max(0,1, Math.min(2, pitch));
  }

  getCurrentVoice(): VoiceOption | null {
    return this.selectedVoice;
  }

  getVolume(): number {
    return this.volume;
  }

  // Speak a number with bingo letter
  callNumber(number: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedVoice) {
        reject(new Error('No voice selected'));
        return;
      }

      // Stop any ongoing speech
      this.synth.cancel();

      const letter = this.getLetterForNumber(number);
      const utterance = new SpeechSynthesisUtterance(`${letter} ${number}`);
      
      // Configure utterance
      utterance.voice = this.synth.getVoices().find(v => v.voiceURI === this.selectedVoice?.voiceURI) || null;
      utterance.volume = this.volume;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      this.synth.speak(utterance);
    });
  }

  // Announce winner
  announceWinner(cartelaNumber: number, isWinner: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedVoice) {
        reject(new Error('No voice selected'));
        return;
      }

      this.synth.cancel();

      const message = isWinner 
        ? `🎉 BINGO! Cartela number ${cartelaNumber} is a WINNER! Congratulations!`
        : `Cartela number ${cartelaNumber} is NOT a winner. Keep playing!`;

      const utterance = new SpeechSynthesisUtterance(message);
      
      utterance.voice = this.synth.getVoices().find(v => v.voiceURI === this.selectedVoice?.voiceURI) || null;
      utterance.volume = this.volume;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      this.synth.speak(utterance);
    });
  }

  // Announce game start
  announceGameStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedVoice) {
        reject(new Error('No voice selected'));
        return;
      }

      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance('Game starting! Good luck players!');
      
      utterance.voice = this.synth.getVoices().find(v => v.voiceURI === this.selectedVoice?.voiceURI) || null;
      utterance.volume = this.volume;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      this.synth.speak(utterance);
    });
  }

  // Stop all speech
  stop() {
    this.synth.cancel();
  }

  private getLetterForNumber(num: number): string {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "";
  }
}

// Singleton instance
export const bingoVoice = new BingoVoiceSynthesis();
