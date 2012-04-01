
var vows = require("vows"),
    assert = require("assert");

var client = require("../lib/smtp/client"),
    commands = client.commands,
    replies = client.replies;

vows.describe("smtp client").addBatch({
    'exports': {
        topic: client,

        'the Client constructor': function (topic) {
            assert.ok(topic.Client);
        },

        'the commands module': function (topic) {
            assert.equal(topic.commands, require("../lib/smtp/commands"));
        },

        'the replies module': function (topic) {
            assert.equal(topic.replies, require("../lib/smtp/replies"));
        },

    },

}).export(module);

// vim:et:sw=4:ts=4:sts=4:
