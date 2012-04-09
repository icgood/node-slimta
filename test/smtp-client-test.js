
var vows = require('vows'),
    assert = require('assert');

var smtp = require('../lib/smtp'),
    commands = require('../lib/smtp/commands'),
    replies = require('../lib/smtp/replies');

var mocksmtp = require('./helpers/mock-smtp');

vows.describe('smtp client').addBatch({
  'the request function': {
    'calling write with no writeHead': {
      topic: function () {
        return smtp.request({stream: {}}, function () { });
      },

      'throws an error': function (topic) {
        assert.throws(function () {
          topic.write('stuff');
        });
      },
    },

    'given no messages': {
      topic: function () {
        this.callback.zomgUniqueId = 1;
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 stuff\r\n', '221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, function () {
          throw new Error('Did not expect a message response');
        });
        mock.start();
        req.on('end', this.callback);
        req.end();
      },

      'does not send a message response': function () {
        assert.ok(true);
      },
    },

    'given one message without pipelining': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\n', 'RCPT TO:<rcpt>\r\n', 'DATA\r\n', 'message contents\r\n.\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 Hello\r\n', '250 Ok\r\n', '250 Ok\r\n', '354 Go ahead\r\n', '250 Accepted\r\n', '221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, this.callback);
        mock.start();
        req.writeHead("sender", ["rcpt"]);
        req.write("message contents");
        req.end();
      },

      'sends a message response': function (reply, command) {
        assert.equal(reply.code, "250");
        assert.equal(reply.message, "Accepted");
      },
    },

    'given one message with pipelining': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\nRCPT TO:<rcpt>\r\nDATA\r\n', 'message contents\r\n.\r\nQUIT\r\n'],
            ['220 Welcome\r\n', '250-Hello\r\n250 PIPELINING\r\n', '250 Ok\r\n250 Ok\r\n354 Go ahead\r\n', '250 Accepted\r\n221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, this.callback);
        mock.start();
        req.writeHead("sender", ["rcpt"]);
        req.write("message contents");
        req.end();
      },

      'sends a message response': function (reply, command) {
        assert.equal(reply.code, "250");
        assert.equal(reply.message, "Accepted");
      },
    },

    'given two messages without pipelining': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\n', 'RCPT TO:<rcpt>\r\n', 'DATA\r\n', 'message contents\r\n.\r\n', 'MAIL FROM:<sender2>\r\n', 'RCPT TO:<rcpt2>\r\n', 'DATA\r\n', 'message contents 2\r\n.\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 Hello\r\n', '250 Ok\r\n', '250 Ok\r\n', '354 Go ahead\r\n', '250 Accepted\r\n', '250 Ok\r\n', '250 Ok\r\n', '354 Go ahead\r\n', '250 Accepted\r\n', '221 Goodbye\r\n']
          );
        var self = this, i = 0;
        var req = smtp.request({stream: mock, ehlo: 'test'}, function (reply, command) {
          assert.equal(reply.code, "250");
          assert.equal(reply.message, "Accepted");
          i++;
        });
        req.on('end', function () {
          self.callback(null, i); 
        });
        mock.start();
        req.writeHead("sender", ["rcpt"]);
        req.write("message contents");
        req.writeHead("sender2", ["rcpt2"]);
        req.write("message contents 2");
        req.end();
      },

      'sends a message response': function (i) {
        assert.equal(i, 2);
      },
    },

    'given two messages with pipelining': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\nRCPT TO:<rcpt>\r\nDATA\r\n', 'message contents\r\n.\r\nMAIL FROM:<sender2>\r\nRCPT TO:<rcpt2>\r\nDATA\r\n', 'message contents 2\r\n.\r\nQUIT\r\n'],
            ['220 Welcome\r\n', '250-Hello\r\n250 PIPELINING\r\n', '250 Ok\r\n250 Ok\r\n354 Go ahead\r\n', '250 Accepted\r\n250 Ok\r\n250 Ok\r\n354 Go ahead\r\n', '250 Accepted\r\n221 Goodbye\r\n']
          );
        var self = this, i = 0;
        var req = smtp.request({stream: mock, ehlo: 'test'}, function (reply, command) {
          assert.equal(reply.code, "250");
          assert.equal(reply.message, "Accepted");
          i++;
        });
        req.on('end', function () {
          self.callback(null, i); 
        });
        mock.start();
        req.writeHead("sender", ["rcpt"]);
        req.write("message contents");
        req.writeHead("sender2", ["rcpt2"]);
        req.write("message contents 2");
        req.end();
      },

      'sends a message response': function (i) {
        assert.equal(i, 2);
      },
    },

    'given a single message in two parts': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\nRCPT TO:<rcpt>\r\nDATA\r\n', 'line one\r\nline two\r\n.\r\nQUIT\r\n'],
            ['220 Welcome\r\n', '250-Hello\r\n250 PIPELINING\r\n', '250 Ok\r\n250 Ok\r\n354 Go ahead\r\n', '250 Accepted\r\n221 Goodbye\r\n']
          );
        var self = this, i = 0;
        var req = smtp.request({stream: mock, ehlo: 'test'}, function (reply, command) {
          assert.equal(reply.code, "250");
          assert.equal(reply.message, "Accepted");
          i++;
        });
        req.on('end', function () {
          self.callback(null, i); 
        });
        mock.start();
        req.writeHead("sender", ["rcpt"]);
        req.write("line one\r\n");
        req.end("line two");
      },

      'sends a message response': function (i) {
        assert.equal(i, 2);
      },
    },

    'when the banner is a rejection': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(['QUIT\r\n'], ['554 Nope\r\n', '221 Goodbye\r\n']);
        var req = smtp.request({stream: mock}, function () {
          throw new Error('should not be called');
        });
        req.on('error', this.callback);
        mock.start();
        req.end();
      },

      'send an error event': function (reply, command) {
        assert.ok(command instanceof commands.Banner);
        assert.ok(reply instanceof replies.Reply);
        assert.equal(reply.code, "554");
        assert.equal(reply.message, "Nope");
      },
    },

    'when the EHLO and HELO are rejected': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(['EHLO test\r\n', 'HELO test\r\n', 'QUIT\r\n'], ['220 Welcome\r\n', '550 No EHLO\r\n', '550 No HELO\r\n', '221 Goodbye\r\n']);
        var req = smtp.request({stream: mock, ehlo: 'test'}, function () {
          throw new Error('should not be called');
        });
        req.on('error', this.callback);
        mock.start();
        req.end();
      },

      'send an error event': function (reply, command) {
        assert.ok(command instanceof commands.Helo);
        assert.ok(reply instanceof replies.Reply);
        assert.equal(reply.code, "550");
        assert.equal(reply.message, "No HELO");
      },
    },

    'when the MAIL command is rejected': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 Hello\r\n', '550 Nope\r\n', '221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, this.callback);
        mock.start();
        req.writeHead('sender', ['rcpt']);
        req.end('stuff');
      },

      'no message is received': function (reply, command) {
        assert.ok(command instanceof commands.Mail);
        assert.equal(reply.code, "550");
        assert.equal(reply.message, "Nope");
      },
    },

    'when the DATA command is rejected': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\n', 'RCPT TO:<rcpt>\r\n', 'DATA\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 Hello\r\n', '250 Ok\r\n', '250 Ok\r\n', '550 Nope\r\n', '221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, this.callback);
        mock.start();
        req.writeHead('sender', ['rcpt']);
        req.end('stuff');
      },

      'no message is received': function (reply, command) {
        assert.ok(command instanceof commands.Data);
        assert.equal(reply.code, "550");
        assert.equal(reply.message, "Nope");
      },
    },

    'when all RCPT commands are rejected but DATA is accepted': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(
            ['EHLO test\r\n', 'MAIL FROM:<sender>\r\n', 'RCPT TO:<rcpt>\r\n', 'DATA\r\n', '.\r\n', 'QUIT\r\n'],
            ['220 Welcome\r\n', '250 Hello\r\n', '250 Ok\r\n', '550 Bad Rcpt\r\n', '354 Go Ahead\r\n', '250 Accepted\r\n', '221 Goodbye\r\n']
          );
        var req = smtp.request({stream: mock, ehlo: 'test'}, this.callback);
        mock.start();
        req.writeHead('sender', ['rcpt']);
        req.end('message contents');
      },

      'no message is received': function (reply, command) {
        assert.ok(command instanceof commands.SendData);
        assert.equal(reply.code, "250");
        assert.equal(reply.message, "Accepted");
      },
    },
  },
}).export(module);

// vim:et:sw=2:ts=2:sts=2:
