
var vows = require("vows"),
    assert = require("assert");

var client = require("../lib/smtp/client");

vows.describe("smtp client").addBatch({
    'exports': {
        topic: client,

        'the Client constructor': function (topic) {
            assert.ok(topic.Client);
        },

        'the connect function': function (topic) {
            assert.ok(topic.connect);
        },
    },

    'the Client constructor': {
        'with default options': {
            topic: new client.Client(),
        },
    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
