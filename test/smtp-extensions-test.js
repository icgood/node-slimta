
var vows = require("vows"),
    assert = require("assert");

var extensions = require("../lib/smtp/extensions");

vows.describe("smtp extensions").addBatch({
    'exports': {
        topic: extensions,

        'the EsmtpExtensions constructor': function (topic) {
            assert.ok(topic.EsmtpExtensions);
        },

        'the parseEhloString function': function (topic) {
            assert.ok(topic.parseEhloString);
        },

        'the buildEhloString function': function (topic) {
            assert.ok(topic.buildEhloString);
        },
    },

    'the EsmtpExtensions constructor': {
        topic: new extensions.EsmtpExtensions(),

        'does not have an arbitrary extension': function (topic) {
            assert.ok(!topic.has("nonexistent"));
        },

        'adds new extensions': {
            topic: function (ext) {
                ext.add("test1");
                ext.add("test2");
                ext.add("test3", "stuff");
                return ext;
            },

            'has the extension with no parameter': function (topic) {
                assert.ok(topic.has("test2"));
            },

            'has the extension with a parameter': function (topic) {
                assert.equal(topic.has("test3"), "stuff");
            },

            'one is dropped': {
                topic: function (ext) {
                    ext.drop("test1");
                    return ext;
                },

                'and no longer exists': function (topic) {
                    assert.ok(!topic.has("test1"));
                },

                'and the rest after reset': {
                    topic: function (ext) {
                        ext.reset();
                        return ext;
                    },

                    'no longer exist': function (topic) {
                        assert.ok(!topic.has("test2"));
                        assert.ok(!topic.has("test3"));
                    },
                },
            },
        },
    },

    'the parseEhloString function': {
        'given no complete lines': {
            topic: extensions.parseEhloString("testing"),

            'the only line is a header': function (topic) {
                assert.equal(topic.header, "testing");
            },

            'it still gives an EsmtpExtensions object': function (topic) {
                assert.ok(topic.extensions instanceof extensions.EsmtpExtensions);
            },
        },

        'given a complete line and an unparseable extensions': {
            topic: extensions.parseEhloString("testing\r\n!@#"),

            'the header is the first line': function (topic) {
                assert.equal(topic.header, "testing");
            },

            'the second line is not an extension': function (topic) {
                assert.ok(!topic.extensions.has("!@#"));
            },
        },

        'given a complete line and some extensions': {
            topic: extensions.parseEhloString("testing header\r\n8bitmime\r\npipelining\r\nauth plain login\r\nsize 1234"),

            'the header is the first line': function (topic) {
                assert.equal(topic.header, "testing header");
            },

            'adds the extensions without parameters': function (topic) {
                assert.ok(topic.extensions.has("8BITMIME"));
                assert.ok(topic.extensions.has("PIPELINING"));
            },

            'adds the extensions with parameters': function (topic) {
                assert.equal(topic.extensions.has("AUTH"), "plain login");
                assert.equal(topic.extensions.has("SIZE"), "1234");
            },
        },
    },

    'the buildEhloString function': {
        'given an EsmtpExtensions object with no extensions': {
            topic: function () {
                var ext = new extensions.EsmtpExtensions();
                return extensions.buildEhloString(ext, "testing");
            },

            'the result is correct': function (topic) {
                assert.equal(topic, "testing");
            },
        },

        'given an EsmtpExtensions object with an extension with no parameter': {
            topic: function () {
                var ext = new extensions.EsmtpExtensions();
                ext.add("STARTTLS");
                return extensions.buildEhloString(ext, "testing header");
            },

            'the result is correct': function (topic) {
                assert.equal(topic, "testing header\r\nSTARTTLS");
            },
        },

        'given an EsmtpExtensions object with an extension with a parameter': {
            topic: function () {
                var ext = new extensions.EsmtpExtensions();
                ext.add("auth", "plain LOGIN");
                return extensions.buildEhloString(ext, "testing header");
            },

            'the result is correct': function (topic) {
                assert.equal(topic, "testing header\r\nAUTH plain LOGIN");
            },
        },
    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
