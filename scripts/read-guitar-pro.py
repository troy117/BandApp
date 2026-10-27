"""Export original frets/strings from an uncompressed Guitar Pro .gp archive.

No music is bundled. Output uses quarter-note positions; prepare-fretted-guide.mjs
maps those positions onto the matching, unchanged MIDI tempo map.
"""
import argparse
import json
import zipfile
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path


def read_score(path):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read('Content/score.gpif'))
    tables = {tag: {e.get('id'): e for e in root.find(tag)}
              for tag in ['Bars', 'Voices', 'Beats', 'Notes', 'Rhythms']}

    def refs(node, name):
        return (node.findtext(name) or '').split()

    def duration(beat):
        rhythm = tables['Rhythms'][beat.find('Rhythm').get('ref')]
        values = {'Long': 16, 'DoubleWhole': 8, 'Whole': 4, 'Half': 2,
                  'Quarter': 1, 'Eighth': .5, '16th': .25, '32nd': .125,
                  '64th': .0625, '128th': .03125, '256th': .015625}
        length = Fraction(values[rhythm.findtext('NoteValue')])
        dot = rhythm.find('AugmentationDot')
        if dot is not None:
            length *= 2 - Fraction(1, 2 ** int(dot.get('count')))
        tuplet = rhythm.find('PrimaryTuplet')
        if tuplet is not None:
            length *= Fraction(int(tuplet.get('den')), int(tuplet.get('num')))
        return length

    tracks = list(root.find('Tracks'))
    parts, staff_index = [], 0
    for index, track in enumerate(tracks):
        tuning = track.findtext("Staves/Staff/Properties/Property[@name='Tuning']/Pitches")
        kind = (track.findtext('InstrumentSet/Type') or '').lower()
        if tuning and ('guitar' in kind or 'bass' in kind):
            low = [int(p) for p in tuning.split()]
            if len(low) in [4, 6]:
                capo = int(track.findtext("Staves/Staff/Properties/Property[@name='CapoFret']/Fret", '0'))
                if capo:
                    raise ValueError('Capo scores need explicit sounding-pitch handling.')
                parts.append({'track': index, 'staff': staff_index,
                              'name': (track.findtext('Name') or '').strip(),
                              'instrument': 'bass' if len(low) == 4 else 'guitar',
                              'tuning': list(reversed(low)), 'notes': []})
        staff_index += len(track.findall('Staves/Staff')) or 1

    position = Fraction(0)
    lengths = []
    for bar_index, master in enumerate(root.find('MasterBars')):
        if master.find('Repeat') is not None or master.find('AlternateEndings') is not None:
            raise ValueError('Unfold repeats before importing source tablature.')
        bars = [tables['Bars'][bid] for bid in refs(master, 'Bars')]
        maximum = Fraction(0)
        for staff, bar in enumerate(bars):
            target = next((p for p in parts if p['staff'] == staff), None)
            for voice_id in refs(bar, 'Voices'):
                if voice_id == '-1':
                    continue
                quarter = Fraction(0)
                for beat_id in refs(tables['Voices'][voice_id], 'Beats'):
                    beat = tables['Beats'][beat_id]
                    length = duration(beat)
                    if target:
                        for note_id in refs(beat, 'Notes'):
                            note = tables['Notes'][note_id]
                            props = note.find('Properties')
                            string = props.findtext("Property[@name='String']/String")
                            fret = props.findtext("Property[@name='Fret']/Fret")
                            if string is None or fret is None:
                                raise ValueError('A fretted note has no original string/fret.')
                            string = len(target['tuning']) - 1 - int(string)
                            item = {'quarter': float(position + quarter), 'durationQ': float(length),
                                    'string': string, 'fret': int(fret), 'bar': bar_index + 1}
                            item['pitch'] = target['tuning'][string] + item['fret']
                            for prop, field in [('PalmMuted', 'palmMute'), ('Muted', 'muted'), ('Ghost', 'ghost')]:
                                if props.find("Property[@name='" + prop + "']/Enable") is not None:
                                    item[field] = True
                            slide = props.findtext("Property[@name='Slide']/Flags")
                            if slide and int(slide):
                                item['slide'] = int(slide)
                            tie = note.find('Tie')
                            if tie is not None and tie.get('destination') == 'true':
                                item['tieDestination'] = True
                            target['notes'].append(item)
                    quarter += length
                maximum = max(maximum, quarter)
        numerator, denominator = map(int, master.findtext('Time').split('/'))
        length = maximum if bar_index == 0 and root.find('MasterTrack/Anacrusis') is not None else Fraction(numerator * 4, denominator)
        lengths.append(float(length))
        position += length

    for part in parts:
        merged, previous = [], {}
        for note in sorted(part['notes'], key=lambda n: (n['quarter'], n['string'])):
            before = previous.get(note['string'])
            if note.pop('tieDestination', False):
                if before is None or before['pitch'] != note['pitch'] or abs(before['quarter'] + before['durationQ'] - note['quarter']) > 1e-6:
                    raise ValueError('A tied note has no matching preceding attack.')
                before['durationQ'] += note['durationQ']
                continue
            if before and before['quarter'] + before['durationQ'] > note['quarter']:
                before['durationQ'] = note['quarter'] - before['quarter']
            merged.append(note)
            previous[note['string']] = note
        part['notes'] = merged
        del part['staff']
    return {'format': 'bandapp-gp-quarters', 'version': 1,
            'pickupQuarters': lengths[0] if root.find('MasterTrack/Anacrusis') is not None else 0,
            'quarters': float(position), 'parts': parts}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('score')
    parser.add_argument('output')
    args = parser.parse_args()
    Path(args.output).write_text(json.dumps(read_score(args.score)), encoding='utf-8')
