class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        // Init context on first user interaction usually, but here we prep.
        // We'll init lazily on first play.
    }

    private init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.3; // Default volume
        } catch (e) {
            console.error('AudioContext not supported', e);
            this.enabled = false;
        }
    }

    public playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    public playCardFlip() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        // "Thwip" sound: filtered noise or swept oscillator
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    public playDeal() {
        // Similar to flip but faster/higher
        this.playCardFlip();
    }

    public playRoundWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.ctx.currentTime;
        this.playTone(523.25, now, 0.1); // C5
        this.playTone(659.25, now + 0.1, 0.1); // E5
        this.playTone(783.99, now + 0.2, 0.3); // G5
    }

    public playLifeLost() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const now = this.ctx.currentTime;
        this.playTone(400, now, 0.2, 'sawtooth');
        this.playTone(300, now + 0.2, 0.4, 'sawtooth');
    }

    private playTone(freq: number, time: number, duration: number, type: OscillatorType = 'sine') {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    }
}

export const audioManager = new AudioManager();
