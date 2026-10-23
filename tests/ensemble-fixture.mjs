// Original notes and words for tests; no school music is bundled.
export function ensembleMidi({lyrics=true,karaoke=false}={}) {
  const bytes=text=>[...new TextEncoder().encode(text)],u32=n=>[n>>>24,n>>>16&255,n>>>8&255,n&255];
  const vlq=n=>{const out=[n&127];while((n>>>=7))out.unshift((n&127)|128);return out;};
  const chunk=(name,data)=>[...bytes(name),...u32(data.length),...data];
  const track=(name,events)=>{const meta=[0xff,3,...vlq(bytes(name).length),...bytes(name)];let previous=0;const data=[0,...meta];for(const event of events.sort((a,b)=>a.tick-b.tick)){data.push(...vlq(event.tick-previous),...event.data);previous=event.tick;}data.push(...vlq(7680-previous),0xff,0x2f,0);return chunk('MTrk',data);};
  const music=(name,channel,program,pitches)=>track(name,[{tick:0,data:[0xc0+channel,program]},...pitches.flatMap((pitch,i)=>[{tick:i*480,data:[0x90+channel,pitch,100]},{tick:i*480+240,data:[0x80+channel,pitch,0]}])]);
  const tracks=[track('Tempo',[{tick:0,data:[0xff,0x51,3,0x0b,0x71,0xb0]},{tick:1920,data:[0xff,0x51,3,0x09,0x27,0xc0]}]),music('Drums',9,0,[36,38,42,38]),music('Piano',0,0,[60,64,67,72]),music('Guitar',1,24,[40,47,52,55]),music('Bass',2,33,[28,33,38,43])];
  if(lyrics)tracks.push(track(karaoke?'Lyrics':'Words',[...(karaoke?[{tick:0,data:[0xff,1,7,...bytes('@KMIDI ')]}]:[]),...[['/Find ',0],['the ',240],['beat',480],['/Play together',1920]].map(([text,tick])=>({tick,data:[0xff,karaoke?1:5,...vlq(bytes(text).length),...bytes(text)]}))]));
  return Uint8Array.from([...bytes('MThd'),0,0,0,6,0,1,0,tracks.length,1,0xe0,...tracks.flat()]);
}
