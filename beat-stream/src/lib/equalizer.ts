// Audio processing chain.
//
// Source ─► [5-band EQ] ─► [Bass enhancer] ─► [Stereo widener] ─►
//   [Compressor] ─► [Loudness gain] ─► [Limiter] ─► Destination
//
// Everything is a single Web Audio graph built once and tweaked live as the
// user changes settings. No re-instantiation per song (which would crackle).

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

export interface EnhancementSettings {
  bassEnhancer: number;        // 0-10  (0 = off)
  stereoWidener: number;       // 0-100% (50 = neutral)
  compressor: number;          // 0-10  (0 = off, 10 = heavy)
  loudness: number;            // 0-12 dB (0 = off)
  limiter: boolean;            // safety brick-wall at -1dBFS
}

export const defaultEnhancement: EnhancementSettings = {
  bassEnhancer: 0,
  stereoWidener: 50,
  compressor: 0,
  loudness: 0,
  limiter: true,
};

export class Equalizer {
  ctx: AudioContext | null = null;
  source: MediaElementAudioSourceNode | null = null;

  // Chain nodes
  filters: BiquadFilterNode[] = [];
  bassEnhancerFilter: BiquadFilterNode | null = null;
  splitter: ChannelSplitterNode | null = null;
  merger: ChannelMergerNode | null = null;
  midGain: GainNode | null = null;
  sideGain: GainNode | null = null;
  compressorNode: DynamicsCompressorNode | null = null;
  loudnessGain: GainNode | null = null;
  limiterNode: DynamicsCompressorNode | null = null;
  outputGain: GainNode | null = null;

  attached = false;

  attach(audio: HTMLAudioElement, gains: number[], enabled: boolean, normalize: boolean, enh: EnhancementSettings = defaultEnhancement) {
    if (this.attached) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      this.ctx = ctx;
      const source = ctx.createMediaElementSource(audio);
      this.source = source;

      // 1) 5-band EQ
      this.filters = EQ_BANDS.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = enabled ? (gains[i] || 0) : 0;
        return f;
      });

      // 2) Bass enhancer — narrow boost at 80Hz with high Q to add punch
      const bass = ctx.createBiquadFilter();
      bass.type = "peaking";
      bass.frequency.value = 80;
      bass.Q.value = 1.4;
      bass.gain.value = enh.bassEnhancer;
      this.bassEnhancerFilter = bass;

      // 3) Stereo widener (M/S processing): split L/R into Mid (L+R)/2 and
      //    Side (L-R)/2, scale Side, then re-merge. Side >1 = wider.
      const splitter = ctx.createChannelSplitter(2);
      const mid = ctx.createGain();
      const side = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      mid.gain.value = 1;
      side.gain.value = enh.stereoWidener / 50; // 50% = 1.0 (neutral)
      this.splitter = splitter;
      this.midGain = mid;
      this.sideGain = side;
      this.merger = merger;

      // 4) Compressor — tightens dynamics, makes quiet parts audible
      const comp = ctx.createDynamicsCompressor();
      const c = enh.compressor;
      comp.threshold.value = -24 - c;          // 0 = -24dB, 10 = -34dB
      comp.knee.value = 30;
      comp.ratio.value = c === 0 ? 1 : 1 + c * 0.6; // 0 = off (1:1), 10 = ~7:1
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.compressorNode = comp;

      // 5) Loudness gain — flat dB boost up to +12
      const loud = ctx.createGain();
      loud.gain.value = Math.pow(10, enh.loudness / 20);
      this.loudnessGain = loud;

      // 6) Brick-wall limiter — safety so loudness boost never clips
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -1;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.001;
      lim.release.value = 0.05;
      this.limiterNode = lim;

      // 7) Final output (normalize)
      const out = ctx.createGain();
      out.gain.value = normalize ? 0.85 : 1;
      this.outputGain = out;

      // ─── Wire the graph ───
      // EQ chain
      let node: AudioNode = source;
      for (const f of this.filters) { node.connect(f); node = f; }
      node.connect(bass);
      node = bass;

      // Stereo widener: needs split & merge
      node.connect(splitter);
      // Sum mode: route both channels through mid
      const sumL = ctx.createGain(); sumL.gain.value = 0.5;
      const sumR = ctx.createGain(); sumR.gain.value = 0.5;
      const diffL = ctx.createGain(); diffL.gain.value = 0.5;
      const diffR = ctx.createGain(); diffR.gain.value = -0.5;
      splitter.connect(sumL, 0); splitter.connect(sumR, 1);
      splitter.connect(diffL, 0); splitter.connect(diffR, 1);
      sumL.connect(mid); sumR.connect(mid);
      diffL.connect(side); diffR.connect(side);
      // M+S → L,  M-S → R
      const reLeft = ctx.createGain(); reLeft.gain.value = 1;
      const reRight = ctx.createGain(); reRight.gain.value = 1;
      mid.connect(reLeft); side.connect(reLeft);
      mid.connect(reRight);
      const sideInv = ctx.createGain(); sideInv.gain.value = -1;
      side.connect(sideInv); sideInv.connect(reRight);
      reLeft.connect(merger, 0, 0);
      reRight.connect(merger, 0, 1);

      merger.connect(comp);
      comp.connect(loud);
      loud.connect(lim);
      lim.connect(out);
      out.connect(ctx.destination);

      this.attached = true;
      // Expose globally so the visualizer can attach an AnalyserNode without
      // us creating a second AudioContext.
      try { (window as any).__bsEqualizer = this; } catch {}
    } catch {}
  }

  resume() { this.ctx?.resume().catch(() => {}); }

  setGains(gains: number[], enabled: boolean) {
    this.filters.forEach((f, i) => { f.gain.value = enabled ? (gains[i] || 0) : 0; });
  }

  setNormalize(on: boolean) {
    if (this.outputGain) this.outputGain.gain.value = on ? 0.85 : 1;
  }

  setEnhancement(enh: EnhancementSettings) {
    if (this.bassEnhancerFilter) this.bassEnhancerFilter.gain.value = enh.bassEnhancer;
    if (this.sideGain) this.sideGain.gain.value = enh.stereoWidener / 50;
    if (this.compressorNode) {
      const c = enh.compressor;
      this.compressorNode.threshold.value = -24 - c;
      this.compressorNode.ratio.value = c === 0 ? 1 : 1 + c * 0.6;
    }
    if (this.loudnessGain) this.loudnessGain.gain.value = Math.pow(10, enh.loudness / 20);
    if (this.limiterNode) {
      this.limiterNode.ratio.value = enh.limiter ? 20 : 1;
    }
  }
}
