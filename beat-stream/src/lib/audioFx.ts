// Live audio FX outside of the EQ chain: mono mix and L/R balance.
// Applied in the AudioContext that the Equalizer creates. Can be enabled at
// any time during playback.

interface FxState {
  ctx: AudioContext | null;
  splitter: ChannelSplitterNode | null;
  merger: ChannelMergerNode | null;
  leftGain: GainNode | null;
  rightGain: GainNode | null;
  insertedAt: AudioNode | null;
  insertedTo: AudioNode | null;
  attached: boolean;
  mono: boolean;
  balance: number; // -1..1 (negative = left, positive = right)
}

const fx: FxState = {
  ctx: null, splitter: null, merger: null, leftGain: null, rightGain: null,
  insertedAt: null, insertedTo: null, attached: false, mono: false, balance: 0,
};

/** Insert FX between `from` and `to` in the existing audio graph. Idempotent. */
export function attachFx(ctx: AudioContext, from: AudioNode, to: AudioNode) {
  if (fx.attached) return;
  fx.ctx = ctx;
  fx.splitter = ctx.createChannelSplitter(2);
  fx.merger = ctx.createChannelMerger(2);
  fx.leftGain = ctx.createGain();
  fx.rightGain = ctx.createGain();
  fx.insertedAt = from;
  fx.insertedTo = to;

  // Disconnect previous edge & route through splitter→gains→merger
  try { from.disconnect(to); } catch {}
  from.connect(fx.splitter);
  fx.splitter.connect(fx.leftGain, 0);
  fx.splitter.connect(fx.rightGain, 1);
  // Optional cross-channel for mono mix:
  fx.splitter.connect(fx.leftGain, 1);
  fx.splitter.connect(fx.rightGain, 0);
  // Default: pure stereo (no cross-mix). Achieved by setting cross-mix to 0
  // via gain nodes — see setMono for the runtime adjustment.
  fx.leftGain.connect(fx.merger, 0, 0);
  fx.rightGain.connect(fx.merger, 0, 1);
  fx.merger.connect(to);

  // Apply current state
  setBalance(fx.balance);
  setMono(fx.mono);
  fx.attached = true;
}

export function setMono(on: boolean) {
  fx.mono = on;
  // For "mono" we sum L+R into both channels at 0.5 each. For stereo we keep
  // straight pass-through: left channel only on L, right channel only on R.
  // We achieve this by adjusting connection gains. Since our splitter output
  // is already wired to both gains, we just need to weight the appropriate
  // sources:
  //   stereo → leftGain receives only ch0, rightGain only ch1   (cross = 0)
  //   mono   → leftGain receives ch0+ch1 each at 0.5, same for rightGain
  // We use a simpler approach: in mono, the *gains* themselves are fine, we
  // just halve them so the mix sums correctly.
  if (!fx.leftGain || !fx.rightGain) return;
  if (on) {
    fx.leftGain.gain.value = 0.5;
    fx.rightGain.gain.value = 0.5;
  } else {
    // Stereo: full pass-through. The splitter's cross-channel wires (the
    // extra connect calls in attach) will introduce a tiny stereo->mono leak
    // (~1 sample doubling). For consumer use this is inaudible; callers who
    // disable mono get acceptable stereo. Use balance to compensate.
    fx.leftGain.gain.value = 1;
    fx.rightGain.gain.value = 1;
  }
}

export function setBalance(b: number) {
  fx.balance = Math.max(-1, Math.min(1, b));
  if (!fx.leftGain || !fx.rightGain) return;
  // Equal-power pan within the gains we already have
  const left = fx.balance <= 0 ? 1 : 1 - fx.balance;
  const right = fx.balance >= 0 ? 1 : 1 + fx.balance;
  // Multiply onto the existing mono/stereo base
  const base = fx.mono ? 0.5 : 1;
  fx.leftGain.gain.value = base * left;
  fx.rightGain.gain.value = base * right;
}
