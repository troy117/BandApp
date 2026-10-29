import test from 'node:test';
import assert from 'node:assert/strict';
import { RunReportView } from '../dist/report-view.mjs';

function retryView(onRetry) {
  const message={textContent:''};
  const root={open:true,close(){this.open=false;}};
  return Object.assign(Object.create(RunReportView.prototype),{root,onRetry,q:()=>message});
}

test('Retry prepares and enters fullscreen synchronously after closing the report, once per opening',()=>{
  const events=[];
  const view=retryView(()=>{
    events.push('prepare');assert.equal(view.root.open,true);
    // Even a reentrant activation cannot prepare twice.
    view.retry();
    return ()=>{assert.equal(view.root.open,false);events.push('fullscreen');};
  });
  view.retry();view.retry();
  assert.deepEqual(events,['prepare','fullscreen']);
  assert.equal(view.retrying,false);
});

test('a rejected retry leaves the completed report open and explains the reason',()=>{
  const view=retryView(()=>{throw new Error('Leave the jam session before retrying individual practice.');});
  view.retry();
  assert.equal(view.root.open,true);
  assert.match(view.q().textContent,/Leave the jam session/);
  assert.equal(view.retrying,false);
});

test('history and other report flows without a current solo retry cannot trigger one',()=>{
  const view=retryView(null);view.retry();assert.equal(view.root.open,true);
  view.root.open=false;view.onRetry=()=>{throw new Error('Closed reports must be inert');};
  view.retry();assert.equal(view.q().textContent,'');
});


test('older combined hi-hat reports keep their original meaning while new reports label closed hits',()=>{
  const view=retryView(null);view.report=null;assert.equal(view.drumLabel('hihat'),'Hi-hat');
  view.report={notes:[]};assert.equal(view.drumLabel('hihat'),'Hi-hat');
  view.report.hiHatVoices=true;assert.equal(view.drumLabel('hihat'),'Closed hi-hat');assert.equal(view.drumLabel('hihat-open'),'Open hi-hat');assert.equal(view.drumLabel('hihat-pedal'),'Pedal hi-hat');
});
