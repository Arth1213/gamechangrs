import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const output = buildSync({entryPoints:[fileURLToPath(new URL('./GrizzliesCoachPlan.tsx', import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom'],loader:{'.css':'empty'},alias:{'@':fileURLToPath(new URL('../',import.meta.url))}});
const compiled = {exports:{}};
new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const sample = {schemaVersion:1,version:'test',updatedThrough:'2026-10-04',opponent:'Dallas Xforia Giants',headline:'Use the new ball',boundaryMatch:'Latest full T20',boundarySourceId:'one',phases:[{name:'Powerplay',overs:'1-6',boundaries:8,legalBalls:36,cue:'First spell'},{name:'Middle',overs:'7-15',boundaries:7,legalBalls:54,cue:'Change'},{name:'Death',overs:'16-20',boundaries:2,legalBalls:11,cue:'Finish'}],sections:[{title:'Who bowls to whom',cards:[{title:'Bowler to batter',trigger:'Powerplay',confidence:'Phase-based trial',actions:['Use one over.'],evidence:'12 balls reviewed.',sourceIds:['one']}]}],sources:[{id:'one',label:'Scorecard',detail:'Reviewed data'}],limitations:['Confirm XI.']};
test('renders the actual opponent and observed phase length, not Strikers copy',()=>{
 const html=renderToStaticMarkup(React.createElement(compiled.exports.GrizzliesCoachPlan,{plan:sample}));
 assert.match(html,/Dallas Xforia Giants: boundary frequency by phase/);
 assert.match(html,/2 boundary balls \/ 11 legal balls/);
 assert.doesNotMatch(html,/Strikers:|25 legal balls/);
 assert.match(html,/<li[^>]*>Use one over\./);
});
test('malformed report is not shown as usable coaching advice',()=>{
 const html=renderToStaticMarkup(React.createElement(compiled.exports.GrizzliesCoachPlan,{plan:{...sample,sources:[]}}));
 assert.match(html,/evidence needs review/); assert.doesNotMatch(html,/Bowler to batter/);
 assert.doesNotMatch(html,/Print \/ Save PDF/);
});
test('offers both official brand marks and a print action on a valid coaching report',()=>{
 const html=renderToStaticMarkup(React.createElement(compiled.exports.GrizzliesCoachPlan,{plan:sample}));
 assert.match(html,/<img[^>]+alt="San Ramon Grizzlies"/);
 assert.match(html,/<img[^>]+alt="GameChangrs"/);
 assert.match(html,/<button[^>]*>.*Print \/ Save PDF/s);
});
test('keeps tactical content and evidence without confidence badges or numbered headings',()=>{
 const html=renderToStaticMarkup(React.createElement(compiled.exports.GrizzliesCoachPlan,{plan:sample}));
 assert.doesNotMatch(html,/Phase-based trial|>[123]<\/span>/);
 assert.match(html,/>Powerplay<\/p>/);
 assert.match(html,/>Bowler to batter<\/h3>/);
 assert.match(html,/<li[^>]*>Use one over\.<\/li>/);
 assert.match(html,/>12 balls reviewed\.<\/p>/);
 assert.match(html,/>Who bowls to whom<\/h2>/);
});
