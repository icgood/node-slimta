
var vows = require("vows"),
    assert = require("assert");

var server = require("../lib/smtp/server"),
    commands = server.commands,
    replies = server.replies;

var mocksmtp = require("./helpers/mock-smtp");

vows.describe("smtp server").addBatch({
    'exports': {
        topic: server,

        'the Server constructor': function (topic) {
            assert.ok(topic.Server);
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
