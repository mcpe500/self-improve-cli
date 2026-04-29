'use strict';

const common = require('./state/common');
const profile = require('./state/profile-state');
const audit = require('./state/audit-log');
const candidate = require('./state/candidate-state');
const daemon = require('./state/daemon-state');

module.exports = {
  ...common,
  ...profile,
  ...audit,
  ...candidate,
  ...daemon
};
