# Synthesizes 8 original royalty-free tracks (WAV, 22.05kHz mono, ~30s each).
import wave, struct, math, random, os
SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio')
def note(m): return 440.0 * 2 ** ((m - 69) / 12)
def render(name, bpm, root, scale, prog, wave_kind, seed, dur=30):
    random.seed(seed)
    n = SR * dur
    buf = [0.0] * n
    beat = 60.0 / bpm
    def add(t0, length, f, vol, kind):
        s0 = int(t0 * SR); L = int(length * SR)
        for i in range(L):
            j = s0 + i
            if j >= n: break
            t = i / SR
            env = min(1, i / (0.01 * SR)) * math.exp(-3.0 * t / length)
            ph = 2 * math.pi * f * t
            if kind == 'sine': v = math.sin(ph)
            elif kind == 'tri': v = 2 / math.pi * math.asin(math.sin(ph))
            elif kind == 'soft': v = math.sin(ph) + 0.4 * math.sin(2 * ph) + 0.2 * math.sin(3 * ph)
            else: v = math.copysign(1, math.sin(ph)) * 0.4
            buf[j] += v * env * vol
    bars = int(dur / (beat * 4))
    for b in range(bars):
        chord = prog[b % len(prog)]
        t0 = b * beat * 4
        for k in chord:
            add(t0, beat * 4, note(root + k), 0.10, 'soft')
        add(t0, beat * 2, note(root + chord[0] - 12), 0.25, 'sine')
        add(t0 + beat * 2, beat * 2, note(root + chord[0] - 12), 0.2, 'sine')
        for s in range(8):
            d = random.choice(scale)
            add(t0 + s * beat / 2, beat / 2, note(root + 12 + d), 0.12, wave_kind)
        for q in range(4):  # kick
            add(t0 + q * beat, 0.15, 55, 0.5, 'sine')
    peak = max(abs(x) for x in buf) or 1
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        # fade in/out
        fr = []
        for i, x in enumerate(buf):
            g = min(1, i / (SR * .5), (n - i) / (SR * 1.5))
            fr.append(struct.pack('<h', int(max(-1, min(1, x / peak * .85 * g)) * 32767)))
        w.writeframes(b''.join(fr))
MIN = [0, 2, 3, 5, 7, 8, 10]; MAJ = [0, 2, 4, 5, 7, 9, 11]
tracks = [
 ('neon-drive', 112, 57, MIN, [[0,3,7],[8,12,15],[5,8,12],[10,14,17]], 'tri', 1),
 ('midnight-bloom', 84, 52, MIN, [[0,3,7],[5,8,12],[3,7,10],[7,10,14]], 'sine', 2),
 ('golden-hour', 100, 60, MAJ, [[0,4,7],[7,11,14],[9,12,16],[5,9,12]], 'tri', 3),
 ('paper-planes', 124, 55, MAJ, [[0,4,7],[5,9,12],[7,11,14],[0,4,7]], 'square', 4),
 ('slow-tide', 72, 50, MIN, [[0,3,7],[10,14,17],[8,12,15],[7,10,14]], 'sine', 5),
 ('city-lights', 118, 58, MIN, [[0,3,7],[3,7,10],[8,12,15],[7,11,14]], 'square', 6),
 ('lantern-hills', 92, 53, MAJ, [[0,4,7],[9,12,16],[5,9,12],[7,11,14]], 'tri', 7),
 ('static-dreams', 130, 56, MIN, [[0,3,7],[5,8,12],[10,14,17],[8,12,15]], 'tri', 8),
]
for t in tracks: render(*t); print('ok', t[0])
