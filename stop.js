var http = require('http'),
		child_process = require('child_process'),
		config = require('./cluster_config.js');
		packageJson = require('./package.json')
		;

const PING_TIMEOUT = 3000;

GLOBAL.__port = process.env.npm_package_config_port || 3000;

var timeout = false;
var error = false;
var data = '';

var options = {
	hostname: '127.0.0.1',
	port: config.port,
	path: '/status',
	method: 'GET'
}

var req = http.request(options, function(res) {
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
		console.log('Stopping OODEBE server (' + data.pid + ')');
		try {
			process.kill(data.pid);	// Need to implement c graceful shutdown. stop listening, but die after current operation.
			console.log('Done!');
		} catch (err) {
			if (err.code == 'ESRCH') {
				console.log('OODEBE server already stopped, please check logs for more information...');
			} else {
				console.log('Error shutting down OODEBE server...');
			}
		}
	}
}