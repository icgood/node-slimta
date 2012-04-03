
var vows = require("vows"),
    assert = require("assert");

var RawServer = require("../lib/smtp/rawserver").RawServer,
    commands = require("../lib/smtp/commands"),
    replies = require("../lib/smtp/replies");

var mocksmtp = require("./helpers/mock-smtp");

vows.describe("smtp raw server").addBatch({
  'the RawServer constructor': {
  },
}).export(module);

// vim:et:sw=2:ts=2:sts=2:
