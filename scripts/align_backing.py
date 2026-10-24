"""Offline SyncToolbox alignment. Music, features and generated maps stay private.

Run in a local environment containing scripts/requirements-alignment.txt:
  python scripts/align_backing.py --manifest private/manifest.json --output private/maps
Manifest entries: key, reference (MIDI-matched synth audio), original, instrumental,
fingerprint, duration (MIDI seconds), synthOffset (reference audio offset).
"""
import argparse
import hashlib
import json
import pathlib
import time

import miniaudio
import numpy as np
from scipy import ndimage, signal
from synctoolbox.dtw.mrmsdtw import sync_via_mrmsdtw
from synctoolbox.dtw.utils import make_path_strictly_monotonic
from synctoolbox.feature.chroma import pitch_to_chroma, quantize_chroma
from synctoolbox.feature.dlnco import pitch_onset_features_to_DLNCO
from synctoolbox.feature.pitch import audio_to_pitch_features
from synctoolbox.feature.pitch_onset import audio_to_pitch_onset_features

SR, RATE = 22050, 50


def decode(path):
    decoded = miniaudio.decode(pathlib.Path(path).read_bytes(), output_format=miniaudio.SampleFormat.FLOAT32,
                                    nchannels=1, sample_rate=SR)
    return np.asarray(decoded.samples, dtype=np.float64)


def features(path, output):
    path = pathlib.Path(path)
    stamp = hashlib.sha256(path.read_bytes()).hexdigest()
    cache = output / (stamp + '-features.npz')
    if cache.exists():
        data = np.load(cache)
        return data['chroma'], data['onsets'], float(data['duration'])
    audio = decode(path)
    print('Reading features:', path.name, round(len(audio)/SR, 2), 'seconds', flush=True)
    pitch = audio_to_pitch_features(audio, Fs=SR, feature_rate=RATE)
    chroma = quantize_chroma(pitch_to_chroma(pitch))
    peaks = audio_to_pitch_onset_features(audio, Fs=SR)
    onsets = pitch_onset_features_to_DLNCO(peaks, feature_rate=RATE,
                                          feature_sequence_length=chroma.shape[1])
    np.savez_compressed(cache, chroma=chroma, onsets=onsets, duration=len(audio)/SR)
    return chroma, onsets, len(audio)/SR


def stem_shift(original, instrumental):
    """Check the shared zero point after MP3 encoding; vocals need no independent warp."""
    a, b = decode(original), decode(instrumental)
    def novelty(x):
        hop = 220
        x = x[:len(x)//hop*hop].reshape(-1, hop)
        rms = np.sqrt(np.mean(x*x, axis=1))
        return np.maximum(0, np.diff(rms, prepend=rms[0]))
    a, b = novelty(a), novelty(b)
    scores = []
    for lag in range(-20, 21):
        start = max(0, -lag); stop = min(len(a), len(b)-lag)
        x, y = a[start:stop], b[start+lag:stop+lag]
        scores.append((float(np.dot(x, y)/max(1e-12, np.linalg.norm(x)*np.linalg.norm(y))), lag))
    score, lag = max(scores)
    return lag * 220/SR, score, (len(b)-len(a))*220/SR


def mapped_path(path, duration, reference_offset):
    strict = make_path_strictly_monotonic(path)
    midi = strict[0]/RATE + reference_offset
    audio = strict[1]/RATE
    # Robust smoothing removes DTW stairs while retaining changes over a bar.
    times = np.arange(max(0, midi[0]), min(duration, midi[-1])+.001, .1)
    raw = np.interp(times, midi, audio)
    smooth = ndimage.median_filter(raw, size=5, mode='nearest')
    smooth = signal.savgol_filter(smooth, min(15, len(smooth)//2*2-1), 2)
    knots = np.arange(0, duration, 1.0)
    knots = np.append(knots, duration)
    values = np.interp(knots, times, smooth)
    # Extend the same local tempo through any encoder padding at the endpoints.
    for index in [0, -1]:
        if knots[index] < times[0]:
            values[index] = smooth[0]+(knots[index]-times[0])*(smooth[10]-smooth[0])/(times[10]-times[0])
        elif knots[index] > times[-1]:
            values[index] = smooth[-1]+(knots[index]-times[-1])*(smooth[-1]-smooth[-11])/(times[-1]-times[-11])
    # DTW is forced to pair file endpoints. Encoder silence and fade-outs are
    # not reliable beat anchors, so extend the last stable local tempo instead.
    raw_slopes=np.diff(values)/np.diff(knots)
    tail=np.flatnonzero((raw_slopes<.2)&(knots[:-1]>duration-7))
    if len(tail):
        cut=max(1,int(tail[0])-1);slope=float(np.median(raw_slopes[max(0,cut-8):cut]));slope=float(np.clip(slope,.5,2))
        values[cut+1:]=values[cut]+(knots[cut+1:]-knots[cut])*slope
    if values[1]-values[0] > 1.5*max(.5,float(np.median(np.diff(values[2:8])))):
        slope=float(np.median(np.diff(values[2:7])));values[0]=values[2]-2*slope;values[1]=values[2]-slope
    slopes = np.diff(values)/np.diff(knots)
    if not np.all(np.isfinite(values)) or np.any(slopes < .1) or np.any(slopes > 10):
        raise ValueError('Alignment contains a stall or section jump. Review the path before importing.')
    return np.column_stack((knots, values)), strict


def align(entry, output, force=False):
    key = entry['key']; result = output/(key+'-original-map.json')
    if result.exists() and not force:
        print('Already aligned:', key, flush=True)
        return
    start = time.time()
    ref, ref_onset, ref_duration = features(entry['reference'], output)
    audio, audio_onset, duration = features(entry['original'], output)
    print('Aligning:', key, flush=True)
    path = sync_via_mrmsdtw(ref, audio, ref_onset, audio_onset,
                           input_feature_rate=RATE, step_weights=np.array([1.5, 1.5, 2.0]),
                           threshold_rec=10**6, verbose=False)
    np.save(output/(key+'-raw-path.npy'), path)
    points, strict = mapped_path(path, entry['duration'], entry.get('synthOffset', 0))
    indices = strict.astype(int)
    left, right = ref[:, indices[0]], audio[:, indices[1]]
    similarity = np.sum(left*right, axis=0)/np.maximum(1e-10, np.linalg.norm(left,axis=0)*np.linalg.norm(right,axis=0))
    slopes = np.diff(points[:,1])/np.diff(points[:,0])
    report = dict(song=key, referenceSeconds=ref_duration, originalSeconds=duration,
                  medianChromaSimilarity=float(np.median(similarity)),
                  lowChromaSimilarity=float(np.quantile(similarity,.1)),
                  slopeRange=[float(np.min(slopes)),float(np.max(slopes))],
                  elapsedSeconds=round(time.time()-start, 1))
    for suffix, path_name, shift in [('original', entry['original'], 0),
                                     ('instrumental', entry['instrumental'], None)]:
        if shift is None:
            shift, strength, length_difference = stem_shift(entry['original'], path_name)
            report.update(stemShift=shift, stemCorrelation=strength, stemLengthDifference=length_difference)
            if abs(length_difference)>.25 or strength<.4:
                raise ValueError('Instrumental does not share the original timeline. Review the stem.')
        mapped = points.copy(); mapped[:,1] += shift
        data=dict(format='bandapp-timing-map',version=1,fingerprint=entry['fingerprint'],
                  audioName=pathlib.Path(path_name).name,audioBytes=pathlib.Path(path_name).stat().st_size,
                  timingMap=dict(version=1,source='SyncToolbox 1.4.2 · original recording',
                                 points=np.round(mapped,6).tolist()))
        (output/(key+'-'+suffix+'-map.json')).write_text(json.dumps(data,indent=2),encoding='utf8')
    (output/(key+'-quality.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--song')
    parser.add_argument('--force',action='store_true')
    args=parser.parse_args(); output=pathlib.Path(args.output);output.mkdir(parents=True,exist_ok=True)
    entries=json.loads(pathlib.Path(args.manifest).read_text(encoding='utf-8-sig'))
    for entry in entries:
        if args.song and entry['key']!=args.song:continue
        try:align(entry,output,args.force)
        except Exception as error:
            print('NEEDS REVIEW:',entry['key'],str(error),flush=True)
            (output/(entry['key']+'-error.txt')).write_text(str(error),encoding='utf8')
