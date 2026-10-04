const assert = require('node:assert/strict');
const test = require('node:test');
const {normalizePlayerProfile}=require('../src/lib/playerProfile');

test('classifies the CricClubs Left Arm Orthodox label as left-arm spin',()=>{
  const result=normalizePlayerProfile({bowlingStyle:'Left Arm Orthodox'});
  assert.equal(result.bowlingStyleBucket,'left_arm_spinner');
  assert.equal(result.bowlingArm,'left');
  assert.equal(result.bowlingStyleDetail,'left_arm_spin');
});

test('a missing style does not become an inferred bowling classification',()=>{
  for(const label of ['', '-', 'N/A', 'Unknown'])assert.equal(normalizePlayerProfile({bowlingStyle:label}).bowlingStyleBucket,'');
});
