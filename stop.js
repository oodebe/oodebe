var child_process = require('child_process')
var cluster       = require('./cluster_config.js')
var packageJson   = require('./package.json')
var timeout       = false
var error         = false;
var client        = cluster.ssl.enabled ? require('https') : require('http');

const PING_TIMEOUT = 3000;
GLOBAL.__port = process.env.npm_package_config_port || 3000;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var options = {
	hostname : '127.0.0.1',
	port     : cluster.port,
	path     : '/status',
	method   : 'GET'
}

var req = client.request(options, function(res) {
	var body = '';
  
	res.setEncoding('utf8');
	
  res.on('data', function (chunk) {
    body += chunk;
  });
	
	res.on('end', function () {
		var data = {};
		try {
			data = JSON.parse(body);
			init(null, data);
		} catch (err) {
			console.log('OODEBE server not started...');
		}
	});
});

req.setTimeout(PING_TIMEOUT, function () {
	timeout = true;
	req.abort();
});

req.on('error', function(err) {
  error = true;
	if (timeout === true) {
		console.log('No response from OODEBE, is it even running?');
		return;
	} else {
		console.log('OODEBE server is not running...');
	}
});

req.end();

function init(err, data) {
	if (data && data.name == packageJson.name) {
		process.stdout.write('Stopping OODEBE server (' + data.pid + ')');
		// Need to implement c graceful shutdown. stop listening, but die after current operation.
		options.path = '/_shutdown';
		var req = client.request(options, function(res) {
			res.on('data', function (chunk) { });
			res.on('end', function () { });

			process.stdout.write('\tDone!\r\n');
		});

		req.on('error', function(err) {
			console.log(err)
			console.log('Error shutting down OODEBE server...');
		});
		
		req.end();
	}
}
