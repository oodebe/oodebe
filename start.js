var fs = require('fs')
	, http = require('http')
	, child_process = require('child_process')
	,	config = require('./cluster_config.js')
	,	packageJson = require('./package.json')
	,	stdout = fs.openSync('./out.log', 'a')
	,	stderr = fs.openSync('./out.log', 'a');

GLOBAL.__pluginsdir = process.env.npm_package_config_plugin || './plugin';
const PING_TIMEOUT = 3000;

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
			console.log('Error starting OODEBE server, port ' + config.port + ' already in use');
		}
	});
});

req.setTimeout(PING_TIMEOUT, function () {
	timeout = true;
	req.abort();
});

req.on('error', function(err) {
	if (timeout === true) {
		console.log('Error starting OODEBE server, port ' + config.port + ' already in use');
		return;
	}
  error = true;
	init(err, null);
});

req.end();

function init(err, data) {
	if (err) {
		process.stdout.write('Starting OODEBE server...');
		process.env.__pluginsdir = __pluginsdir;
		
		var child = child_process.spawn('node', ['./oodebe.js'], {
		 detached: true,
		 stdio: [ 'ignore', stdout, stderr ],
		 env: process.env
		});
		
		setTimeout(function () {
			child.unref();
			process.stdout.write('\tDone!\r\n');
		}, 500);
	} else if (data && data.name == packageJson.name) {
		console.log ('OODEBE already started (' + data.pid + ')');
		return;
	}
}