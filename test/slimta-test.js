
var vows = require("vows"),
    assert = require("assert");

var slimta = require("../lib/slimta");

vows.describe("slimta").addBatch({
  'exports': {
    topic: slimta,

    'the smtp module': function (topic) {
      assert.ok(topic.smtp);
    },
  },
}).export(module);

// vim:et:sw=2:ts=2:sts=2:
