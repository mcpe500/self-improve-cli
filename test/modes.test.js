'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MODES,
  getModePermissions,
  checkToolPermission,
  isValidMode,
  getDefaultMode,
  switchMode,
  getModeDisplay,
} = require('../src/modes');

test('MODES constants are defined', () => {
  assert.equal(typeof MODES.PLAN, 'string');
  assert.equal(typeof MODES.BUILD, 'string');
  assert.equal(MODES.PLAN, 'plan');
  assert.equal(MODES.BUILD, 'build');
});

test('isValidMode accepts valid modes', () => {
  assert.equal(isValidMode('plan'), true);
  assert.equal(isValidMode('build'), true);
  assert.equal(isValidMode('invalid'), false);
  assert.equal(isValidMode(''), false);
});

test('Plan mode restricts write/edit operations', () => {
  const planPerms = getModePermissions(MODES.PLAN, {});
  assert.equal(planPerms.read, 'allow');
  assert.equal(planPerms.search, 'allow');
  assert.equal(planPerms.write, 'deny');
  assert.equal(planPerms.edit, 'deny');
  assert.equal(planPerms.run_command, 'ask');
});

test('Build mode uses base permissions', () => {
  const basePerms = {
    read: 'allow',
    write: 'ask',
    edit: 'ask',
    run_command: 'ask',
  };
  const buildPerms = getModePermissions(MODES.BUILD, basePerms);
  assert.deepEqual(buildPerms, basePerms);
});

test('checkToolPermission returns correct permission', () => {
  const basePerms = { write: 'ask', edit: 'ask' };
  
  // Plan mode denies write
  assert.equal(checkToolPermission('write', MODES.PLAN, basePerms), 'deny');
  
  // Build mode uses base permission
  assert.equal(checkToolPermission('write', MODES.BUILD, basePerms), 'ask');
  
  // Plan mode allows read
  assert.equal(checkToolPermission('read', MODES.PLAN, basePerms), 'allow');
});

test('getDefaultMode returns build for backward compatibility', () => {
  assert.equal(getDefaultMode({}), 'build');
  assert.equal(getDefaultMode(), 'build');
});

test('getDefaultMode respects config.default_mode', () => {
  assert.equal(getDefaultMode({ default_mode: 'plan' }), 'plan');
  assert.equal(getDefaultMode({ default_mode: 'build' }), 'build');
});

test('getDefaultMode respects config.mode', () => {
  assert.equal(getDefaultMode({ mode: 'plan' }), 'plan');
});

test('getDefaultMode falls back to build for invalid mode', () => {
  assert.equal(getDefaultMode({ mode: 'invalid' }), 'build');
});

test('switchMode toggles between plan and build', () => {
  const fromBuild = switchMode(MODES.BUILD);
  assert.equal(fromBuild.mode, 'plan');
  assert.equal(typeof fromBuild.description, 'string');
  
  const fromPlan = switchMode(MODES.PLAN);
  assert.equal(fromPlan.mode, 'build');
  assert.equal(typeof fromPlan.description, 'string');
});

test('getModeDisplay returns display info', () => {
  const planDisplay = getModeDisplay(MODES.PLAN);
  assert.equal(planDisplay.label, 'PLAN');
  assert.equal(typeof planDisplay.description, 'string');
  assert.equal(planDisplay.color, 'cyan');
  
  const buildDisplay = getModeDisplay(MODES.BUILD);
  assert.equal(buildDisplay.label, 'BUILD');
  assert.equal(typeof buildDisplay.description, 'string');
  assert.equal(buildDisplay.color, 'green');
});

test('Plan mode allows read-only operations', () => {
  const planPerms = getModePermissions(MODES.PLAN, {});
  
  // Should allow
  assert.equal(planPerms.read, 'allow');
  assert.equal(planPerms.search, 'allow');
  assert.equal(planPerms.grep, 'allow');
  assert.equal(planPerms.glob, 'allow');
  assert.equal(planPerms.skill, 'allow');
  assert.equal(planPerms.question, 'allow');
  
  // Should deny
  assert.equal(planPerms.write, 'deny');
  assert.equal(planPerms.edit, 'deny');
  
  // Should ask
  assert.equal(planPerms.run_command, 'ask');
  assert.equal(planPerms.bash, 'ask');
});
