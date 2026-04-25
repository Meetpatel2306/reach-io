export const EQ_BANDS = [60, 230, 910, 3600, 14000];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:           [0, 0, 0, 0, 0],
  "Bass Boost":   [6, 4, 0, 0, 0],
  "Bass Reducer": [-6, -3, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 4, 6],
  "Treble Reducer":[0, 0, 0, -3, -6],
  "Vocal Boost":  [-2, -1, 4, 4, 0],
  Rock:           [4, 2, -2, 2, 4],
  Pop:            [-1, 2, 4, 2, -1],
  Classical:      [3, 2, -1, 2, 3],
  Electronic:     [4, 1, 0, 2, 4],
  Jazz:           [3, 2, 0, 2, 3],
  "Hip-Hop":      [5, 3, -1, 1, 3],
  Acoustic:       [3, 2, 1, 2, 3],
  "Spoken Word":  [-3, -2, 4, 4, 0],
  Loudness:       [5, 0, 0, 0, 4],
};

export class Equalizer {
  ctx: AudioContext | null = null;
  source: MediaElementAudioSourceNode | null = null;
  filters: BiquadFilterNode[] = [];
  gain: GainNode | null = null;
  attached = false;
  enabled = false;

  attach(audio: HTMLAudioElement, gains: number[], enabled: boolean, normalize: boolean) {
    if (this.attached) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.source = this.ctx.createMediaElementSource(audio);
      this.filters = EQ_BANDS.map((freq, i) => {
        const f = this.ctx!.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = enabled ? (gains[i] || 0) : 0;
        return f;
      });
      this.gain = this.ctx.createGain();
      this.gain.gain.value = normalize ? 0.85 : 1;
      let node: AudioNode = this.source;
      for (const f of this.filters) { node.connect(f); node = f; }
      node.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.attached = true;
      this.enabled = enabled;
    } catch {}
  }

  resume() { this.ctx?.resume().catch(() => {}); }

  setGains(gains: number[], enabled: boolean) {
    this.enabled = enabled;
    this.filters.forEach((f, i) => { f.gain.value = enabled ? (gains[i] || 0) : 0; });
  }

  setNormalize(on: boolean) {
    if (this.gain) this.gain.gain.value = on ? 0.85 : 1;
  }
}
