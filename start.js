var fs            = require('fs');
var child_process = require('child_process');
var cluster       = require('./cluster_config.js');
var packageJson   = require('./package.json');
var client        = cluster.ssl.enabled ? require('https') : require('http');
var timeout       = false;
var error         = false;

const PING_TIMEOUT  = 3000;
GLOBAL.__pluginsdir = cluster.plugin_path || process.env.npm_package_config_plugin;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
            console.log('Error starting OODEBE server, port ' + cluster.port + ' already in use');
        }
    });
});

req.setTimeout(PING_TIMEOUT, function () {
    timeout = true;
    req.abort();
});

req.on('error', function(err) {
    if (timeout === true) {
        console.log('Error starting OODEBE server, port ' + cluster.port + ' already in use');
        return;
    }
  error = true;
    init(err, null);
});

req.end();

function init(err, data) {
    if (err) {
        console.log('Starting OODEBE server...');
        console.log('Check "' + __dirname + '/logs/out.log" for more information.');
        process.env.__pluginsdir = __pluginsdir;
        var checkNum = /^[1-9]\d+$/;
        var argArray = ['--expose-gc', './oodebe.js'];
        if(cluster.heapSize !== undefined && checkNum.test(cluster.heapSize.trim())) {
            var temp = argArray.pop();
            argArray.push('--max-old-space-size=' + cluster.heapSize);
            argArray.push(temp);
            temp = "";
        }
        var child = child_process.spawn('node', argArray, {
            detached: true,
            stdio: 'ignore',
            env: process.env
        });

        setTimeout(function () {
            child.unref();
        }, 500);
    } else if (data && data.name == packageJson.name) {
        console.log ('OODEBE already started (' + data.pid + ')');
        return;
    }
}
