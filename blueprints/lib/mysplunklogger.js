
var url = require('url');

var Logger = function(config) {
    this.url = config.url;
    this.token = config.token;
    this.payloads = [];
};

// Simple logging API for Lambda functions
Logger.prototype.log = function(message, context) {
    this.logWithTime(Date.now(), message, context);
};

Logger.prototype.logWithTime = function(time, message, context) {
    var payload = {};

    if (Object.prototype.toString.call(message) === '[object Array]') {
        throw new Error("message argument must be a string or a JSON object.");
    }

    payload.event = message;

    // Add Lambda metadata if available
    // TODO: only add if message is JSON object
    if (typeof context !== 'undefined') {
        var reqId = context.awsRequestId;
        if (typeof reqId !== 'undefined') {
            payload.event.awsRequestId = context.awsRequestId;
        }
        payload.source = context.functionName;
    }

    payload.time = new Date(time).getTime() / 1000;

    this.logEvent(payload);
};

Logger.prototype.logEvent = function(payload) {
    this.payloads.push(JSON.stringify(payload));
};

Logger.prototype.flushAsync = function(callback) {
    callback = callback || function(){};

    var parsed = url.parse(this.url);
    var options = {
        hostname: parsed.hostname,
        path: parsed.path,
        port: parsed.port,
        method: 'POST',
        headers: {
            'Authorization': "Splunk " + this.token
        },
        rejectUnauthorized: false,
    };
    var requester = require(parsed.protocol.substring(0, parsed.protocol.length - 1));

    console.log('Sending event');
    var req = requester.request(options, function(res) {
        res.setEncoding('utf8');

        console.log('Response received');
        res.on('data', function(data) {
            var error = null;
            if (res.statusCode != 200) {
                error = new Error("error: statusCode=" + res.statusCode + "\n\n" + data);
                console.error(error);
            } else {
                console.log('Sent');
            }
            this.payloads.length = 0;
            callback(error, data);
        }.bind(this));
    }.bind(this));

    req.on('error', function(error) {
        callback(error);
    }.bind(this));

    req.end(this.payloads.join(''), 'utf8');
};

module.exports = Logger;
