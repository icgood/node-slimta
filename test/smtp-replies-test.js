
var vows = require("vows"),
    assert = require("assert");

var replies = require("../lib/smtp/replies");

vows.describe("smtp replies").addBatch({
  'the Reply constructor': {
    'given a simple code and message': {
      'and a "2" code': {
        topic: new replies.Reply("250", "Testing"),

        'has correct toString result': function (topic) {
          assert.equal(topic.toString(), "250 2.0.0 Testing");
        },

        'reports success': function (topic) {
          assert.ok(topic.isSuccess());
        },
      },

      'and a "3" code': {
        topic: new replies.Reply("354", "Testing"),

        'has correct toString result': function (topic) {
          assert.equal(topic.toString(), "354 Testing");
        },

        'does not report success': function (topic) {
          assert.isFalse(topic.isSuccess());
        },
      },

      'and a "4" code': {
        topic: new replies.Reply("451", "Testing"),

        'has correct toString result': function (topic) {
          assert.equal(topic.toString(), "451 4.0.0 Testing");
        },

        'does not report success': function (topic) {
          assert.isFalse(topic.isSuccess());
        },

      },

      'and a "5" code': {
        topic: new replies.Reply("550", "Testing"),

        'has correct toString result': function (topic) {
          assert.equal(topic.toString(), "550 5.0.0 Testing");
        },

        'does not report success': function (topic) {
          assert.isFalse(topic.isSuccess());
        },

      },
    },

    'given a 2xx code, message, and empty-string esc': {
      topic: new replies.Reply("250", "Testing", ""),

      'has correct toString result': function (topic) {
        assert.equal(topic.toString(), "250 Testing");
      },
    },

    'given a multi-line message': {
      topic: new replies.Reply("250", "Test One\r\nTest Two\nTest Three"),

      'has correct toString result': function (topic) {
        assert.equal(topic.toString(), "250-2.0.0 Test One\r\n250-Test Two\r\n250 Test Three");
      },
    }
  },

  'the InvalidSyntax constructor': {
    topic: new replies.InvalidSyntax('bad/reply'),

    'inherits Reply': function (topic) {
      assert.ok(topic instanceof replies.Reply);
    },

    'has correct toString results': function (topic) {
      assert.equal(topic.toString(), 'bad/reply');
    },

    'does not report success': function (topic) {
      assert.isFalse(topic.isSuccess());
    },

    'has line property': function (topic) {
      assert.equal(topic.line, 'bad/reply');
    },
  },

  'the parseIntoReplies function': {
    'given a non-string': {
      topic: function () {
        replies.parseIntoReplies({});
      },

      'throws a TypeError': function (topic) {
        assert.ok(topic instanceof TypeError);
      }
    },

    'given a string with no endlines': {
      topic: replies.parseIntoReplies('testing'),

      'returns an empty array and string remainder': function (topic) {
        assert.ok(topic.replies instanceof Array);
        assert.equal(topic.replies.length, 0);
        assert.equal(topic.remainder, 'testing');
      },
    },

    'given a string with a CR but no LF': {
      topic: replies.parseIntoReplies('testing\r'),

      'returns an empty array and string remainder': function (topic) {
        assert.ok(topic.replies instanceof Array);
        assert.equal(topic.replies.length, 0);
        assert.equal(topic.remainder, 'testing\r');
      },
    },

    'given a string with one complete, single-line reply': {
      topic: replies.parseIntoReplies('250 Testing\n'),

      'returns an array of one Reply object and string remainder': function (topic) {
        assert.equal(topic.replies.length, 1);
        var reply = topic.replies[0];
        assert.ok(reply instanceof replies.Reply);
        assert.equal(reply.code, "250");
        assert.equal(reply.message, "Testing");
        assert.equal(topic.remainder, '');
      },
    },

    'given a empty but complete line': {
      topic: replies.parseIntoReplies("\n"),

      'returns an array of one InvalidSyntax object and a string remainder': function (topic) {
        assert.equal(topic.replies.length, 1);
        assert.ok(topic.replies[0] instanceof replies.InvalidSyntax);
        assert.equal(topic.replies[0].line, '');
        assert.equal(topic.remainder, '');
      },
    },

    'given a line with bad syntax': {
      topic: replies.parseIntoReplies('bad/reply\n'),

      'returns an array of one InvalidSyntax object and a string remainder': function (topic) {
        assert.equal(topic.replies.length, 1);
        assert.ok(topic.replies[0] instanceof replies.InvalidSyntax);
        assert.equal(topic.replies[0].line, 'bad/reply');
        assert.equal(topic.remainder, '');
      },
    },

    'given a string with one complete, multi-line reply': {
      topic: replies.parseIntoReplies("250-2.0.0 Test One\r\n250-Test Two\n250 Test Three\n"),

      'returns an array of one Reply object and a string remainder': function (topic) {
        assert.equal(topic.replies.length, 1);
        var reply = topic.replies[0];
        assert.ok(reply instanceof replies.Reply);
        assert.equal(reply.code, "250");
        assert.equal(reply.message, "2.0.0 Test One\r\nTest Two\r\nTest Three");
        assert.equal(topic.remainder, '');
      },
    },

    'given a string with several complete replies and a partial line': {
      topic: replies.parseIntoReplies("250 One\r\n450-Testing\r\n450 Two\r\n550 Three"),

      'returns an array of two Reply objects and a string remainder': function (topic) {
        assert.equal(topic.replies.length, 2);
        assert.equal(topic.replies[0].code, "250");
        assert.equal(topic.replies[0].message, "One");
        assert.equal(topic.replies[1].code, "450");
        assert.equal(topic.replies[1].message, "Testing\r\nTwo");
        assert.equal(topic.remainder, "550 Three");
      },
    },

  },
}).export(module);

// vim:et:sw=2:ts=2:sts=2:
