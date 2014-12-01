var cluster_config = './cluster_config.js';

var fs = require('fs');
var pathModule = require('path');
var assert = require('assert').ok;
var Discover = require('node-discover');

GLOBAL.cluster = require(cluster_config);
GLOBAL.__basedir = __dirname + '/';
GLOBAL.__pluginsdir = cluster.plugin_path || process.env.npm_package_config_plugin || process.env.__pluginsdir;

process.env.cluster_config = cluster_config;
process.env.global_path = __basedir;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

cluster.getTimestamp = function () {
	var d = new Date();
	return (d.getFullYear() + '-' + this.pad(d.getMonth() + 1) + '-' + this.pad(d.getDate()) + '-' + this.pad(d.getHours()) + '-' + this.pad(d.getMinutes()) + '-' + this.pad(d.getSeconds()));
};

cluster.pad = function (num) {
	var prefix = (num < 10) ? "0" : "";
	return prefix + num;
};

if (!fs.existsSync(__dirname + '/logs/')) {
	fs.mkdirSync(__dirname + '/logs/');
}
cluster.ws = fs.createWriteStream(__dirname + '/logs/out.log', {flags: 'a+', mode: '777', encoding: 'utf8'});
	
cluster.ws.on('error', function(err) {
	console.log('Error writing to log');
	console.log(err);
});

cluster.exit = function (code) {
	cluster.exiting = true;
	
	cluster.ws.end(function () {
		process.exit(code);
	});
}

cluster.log = function (data) {
	if (cluster.exiting) return false;
	if (typeof data !== 'object') return false;
	if (!data.type) return false;
	if (!cluster.logging[data.type]) return false;
	if (!data.timestamp) {
		data.timestamp = cluster.getTimestamp();
	}
	if (!data.opr) {
		data.opr = 'SYSTEM';
	}
	var str = [];
	str.push(data.timestamp);
	str.push(data.type);
	str.push(data.opr);
	str.push(data.message);
	str = str.join('|');
	cluster.ws.write(str + '\n');
	console.log(data.message);
}

Error.prepareStackTrace = function(_, stack){ return stack; }
process.on('uncaughtException', function (err) {
	if (err.name == 'Error') {
		var stack = err.stack[0];
	
		var file = stack.getFileName();
		var line = stack.getLineNumber();
		var pos = stack.getColumnNumber();
		
		cluster.log({type: 'ERROR', message: 'MSG=' + err + ' in file ' + file + ', on line ' + line + ', pos ' + pos, opr: 'SYSTEM'});
	} else if (err.name == 'SyntaxError') {
		cluster.log({type: 'ERROR', message: 'MSG=' + err, opr: 'SYSTEM'});
	} else {
		cluster.log({type: 'ERROR', message: 'MSG=' + err, opr: 'SYSTEM'});
	}
	cluster.exit();
});

module.constructor.prototype.require = function (path) {
	var self = this;
	assert(typeof path === 'string', 'path must be a string');
  assert(path, 'missing path');
	
  try {
		return self.constructor._load(path, self);
	} catch (err) {
		if (err.code === 'MODULE_NOT_FOUND') {
			throw err;
		}
		path = pathModule.resolve(__dirname, path)
		cluster.log({type: 'ERROR', message: 'MSG=' + err + ' in file ' + path, opr: 'SYSTEM'});
		cluster.exit();
	}
}

if (!fs.existsSync(__pluginsdir)) {
	cluster.log({type: 'ERROR', message: 'MSG=Invalid plugin path', opr : 'SYSTEM'});
	cluster.exit(1);
	return;
}

if (cluster.ssl.enabled) {
	cluster.protocol = 'https';
	try {
		cluster.ssl.options = {
			cert: fs.readFileSync(cluster.ssl.cert),
			key: fs.readFileSync(cluster.ssl.key),
			requestCert: true
		}
	} catch (e) {
		cluster.log({type : 'ERROR', message : 'MSG=Failed to read ssl certificate and key : ' + e, opr : 'SYSTEM'});
		cluster.exit(1);
		return;
	}
} else {
	cluster.protocol = 'http';
}

var config = require(__pluginsdir);
config.okModels = 0;

console.log('Starting to check the dependency modules');
var redis = require('redis');
GLOBAL.redisClient = redis.createClient(cluster.redis.port, cluster.redis.host);

redisClient.on("connect", function () {
	cluster.log({type: 'INFO', message: 'MSG=OODEBE connected to Redis server ' + cluster.redis.host + ' on port ' + cluster.redis.port});
	dependencyCheck();
});

redisClient.on("error", function (err) {
	cluster.log({type: 'ERROR', message: 'MSG=OODEBE could not connect to Redis server ' + cluster.redis.host + ' on port ' + cluster.redis.port + ' due to ' + err});
	cluster.log({type: 'ERROR', message: 'MSG=Could not start oodebe, dependency validation failed'});
	cluster.exit(1);
});

function dependencyCheck() {
	for (var key in config.models) {
		var model = config.models[key];
		if (model.validator && config.processors[model.validator]) {
			config.okModels += 1;
			model.preprocessor = new config.processors[model.validator](key, proceed);
		}
	}
	// When pre-check is not required
	if (config.okModels == 0) {
		init_oodebe();
	}
}

var error = false;
function proceed(err, modelName) {
	config.okModels -= 1;
	if (err) {
		error = true;
		console.log(modelName + ': ' + err);
	} else {
		console.log(modelName + ': Success');
	}
	if (config.okModels == 0) {
		if (error) {
			cluster.log({type: 'ERROR', message: 'MSG=Could not start oodebe, dependency validation failed'});
			cluster.exit(1);
			return;
		} else {
			init_oodebe();
		}
	}
}

function init_oodebe() {
	GLOBAL.discover = new Discover({
		mastersRequired: 1
	});

	discover.me.port         = cluster.port;
	discover.me.cluster_name = cluster.cluster_name;
	discover.me.protocol     = cluster.protocol;
	
	discover.on("promotion", function () {
		cluster.log({type: 'INFO', message: 'MSG=' + 'Elected as Master'});
	});

	discover.on("added", function (node) {
		cluster.log({type: 'INFO', message: 'MSG=' + node.address + ' is added to the cluster'});
	});

	discover.on("removed", function (node) {
		cluster.log({type: 'INFO', message: 'MSG=' + node.address + ' removed from the cluster'});
	});

	discover.on("master", function (node) {
		cluster.log({type: 'INFO', message: 'MSG=' + node.address + ' is elected to be the Master'});
	});
	
	require('./master.js');
}
