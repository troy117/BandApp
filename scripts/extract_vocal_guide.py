"""Extract a conservative monophonic pitch guide from a local Demucs vocal stem.
No audio is uploaded. Notes are stored in the unchanged MIDI timeline using the
backing's SyncToolbox map. Review the generated note/voicing report before import.
"""
import argparse
import json
import pathlib

import librosa
import miniaudio
import numpy as np
from scipy import ndimage


def extract(entry, output, detector='pyin'):
    path=pathlib.Path(entry['vocal'])
    decoded=miniaudio.decode(path.read_bytes(),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=1,sample_rate=16000)
    audio=np.asarray(decoded.samples,dtype=np.float32)
    print('Analyzing vocal pitch:',entry['key'],round(len(audio)/16000,2),'seconds',flush=True)
    hop=160
    if detector=='crepe':
        import torch
        import torchcrepe
        torch.set_num_threads(4)
        with torch.inference_mode():
            estimate,periodicity=torchcrepe.predict(torch.from_numpy(audio).unsqueeze(0),16000,hop,
                fmin=librosa.note_to_hz('C2'),fmax=librosa.note_to_hz('G5'),
                model='full',batch_size=128,device='cpu',return_periodicity=True)
        pitch=estimate[0].numpy();prob=periodicity[0].numpy();voiced=prob>=.5
    else:
        pitch,voiced,prob=librosa.pyin(audio,sr=16000,frame_length=2048,hop_length=hop,
                                      fmin=librosa.note_to_hz('C2'),fmax=librosa.note_to_hz('G5'),
                                      fill_na=np.nan)
    rms=librosa.feature.rms(y=audio,frame_length=2048,hop_length=hop)[0][:len(pitch)]
    good=voiced & (prob>=(.5 if detector=='crepe' else .6)) & (rms>np.max(rms)*.025)
    midi=librosa.hz_to_midi(np.nan_to_num(pitch,nan=1))
    quantized=np.rint(ndimage.median_filter(midi,size=5)).astype(int)
    times=np.arange(len(pitch))*hop/16000
    raw=[];start=None;current=None
    for i in range(len(times)+1):
        note=int(quantized[i]) if i<len(times) and good[i] else None
        if note!=current:
            if current is not None and (i-start)*hop/16000>=.08:
                frame=slice(start,i)
                # Reject unstable glides and ambiguous harmonies rather than
                # presenting a confident target the singer did not sustain.
                if np.std(midi[frame])<.8:
                    raw.append(dict(time=max(0,times[start]-.005),end=min(len(audio)/16000,i*hop/16000+.005),pitch=current,confidence=float(np.mean(prob[frame]))))
            start=i;current=note
    merged=[]
    for note in raw:
        if merged and note['pitch']==merged[-1]['pitch'] and note['time']-merged[-1]['end']<.065:
            merged[-1]['end']=note['end'];merged[-1]['confidence']=min(merged[-1]['confidence'],note['confidence'])
        else:merged.append(note)
    map_file=output/(entry['key']+'-original-map.json')
    points=np.array(json.loads(map_file.read_text(encoding='utf8'))['timingMap']['points'])
    def to_midi(t):
        return float(np.interp(t,points[:,1],points[:,0]))
    notes=[]
    for note in merged:
        start=max(0,to_midi(note['time']));end=min(entry['duration'],to_midi(note['end']))
        if end-start>=.025:
            notes.append(dict(time=round(start,6),duration=round(end-start,6),pitch=note['pitch'],velocity=.7))
    payload=dict(format='bandapp-vocal-guide',version=1,fingerprint=entry['fingerprint'],
                 source='Demucs vocal stem · '+detector,notes=notes)
    (output/(entry['key']+'-vocal-guide.json')).write_text(json.dumps(payload,indent=2),encoding='utf8')
    np.savez_compressed(output/(entry['key']+'-vocal-analysis.npz'),time=times,pitch=pitch,voiced=good,probability=prob,rms=rms)
    (output/(entry['key']+'-vocal-original-notes.json')).write_text(json.dumps(merged,indent=2),encoding='utf8')
    report=dict(song=entry['key'],notes=len(notes),voicedSeconds=float(good.sum()*hop/16000),
                pitchRange=[min(n['pitch'] for n in notes),max(n['pitch'] for n in notes)],
                medianConfidence=float(np.median([n['confidence'] for n in merged])))
    (output/(entry['key']+'-vocal-quality.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True);parser.add_argument('--output',required=True)
    parser.add_argument('--song',action='append',required=True)
    parser.add_argument('--detector',choices=['pyin','crepe'],default='pyin')
    args=parser.parse_args();output=pathlib.Path(args.output);output.mkdir(parents=True,exist_ok=True)
    for entry in json.loads(pathlib.Path(args.manifest).read_text(encoding='utf-8-sig')):
        if entry['key'] in args.song:extract(entry,output,args.detector)
