GLOBAL.__basedir = __dirname + '/';
GLOBAL.__pluginsdir = process.env.npm_package_config_plugin || process.env.__pluginsdir || './plugin';
process.env.global_path = __basedir;
var	url = require('url');
var http = require('http');
var connect = require('connect');
var child_process = require('child_process');
var	qs = require('querystring');
var	url = require('url');
var path = require('path');
var uuid = require('node-uuid');

var redis = require("redis");
var client = redis.createClient();

client.on("error", function (err) {
	console.log("Error in Redis: " + err);
});

var cluster = require('./cluster_config');
var packageJson = require('./package.json');
var config = require(__pluginsdir);

var cores = require("os").cpus().length;
var io;

const WORKER_FILE = './worker.js';
const SERVER_PORT = cluster.port;

const ERROR_TIMEOUT = 1000;

cluster.count = 0;
cluster.jobs = [];
cluster.requests = {};

cluster.fork = function (priority) {
	var worker = child_process.fork(WORKER_FILE);
	
	cluster.count += 1;
	
	worker.timestamp = new Date().getTime();
	worker.workerID = '' + cluster.count;
	worker.operations = 0;
	
	worker.on('message', messageHandler);
	worker.on('exit', ipcHandlers._exit);
	
	worker.send({cmd: 'init', data: {
		'__basedir': __basedir,
		'__pluginsdir': __pluginsdir,
		'nodeID': discover.broadcast.instanceUuid
	}});
	
	worker.priority = priority;
	cluster.priorities[priority].workers.push(worker);
	
	return worker;
}

function messageHandler(msg) {
	var cmd = msg.cmd;
	if (!cmd) return;
	var worker = this;
	
	if (ipcHandlers[cmd]) {
		var data = msg.data;
		ipcHandlers[msg.cmd](data, worker);
	}
}

var requestHandlers = {

	_reload: function (req, res) {
		// Iterating through all the forked workers
		for (var key in cluster.priorities) {
			var workers = cluster.priorities[key].workers;
			var i = workers.length;
			while (i--) {
				// and sending reload signal
				workers[i].send({'cmd': '_reload'});
			}
		}
		console.log('Plugins reloaded');
		res.end('{"_reload": "OK"}');
	},
	
	_shutdown: function (req, res) {
		res.end('{"_shutdown": "OK"}');
		console.log('OODEBE server stopped...');
		process.nextTick(function () {
			// Workers will automatically get killed once master is exited.
			process.exit();
		})
	},
	
	status: function (req, res) {
		var obj = {};

		obj.pid = process.pid;
		obj.uptime = Math.round(process.uptime());
		obj.name = packageJson.name;
		obj.version = packageJson.version;
		
		var workers = {}, workerID, job, worker;
		for (var key in cluster.jobs) {
			job = cluster.jobs[key];
			workerID = job.worker.workerID;
			if (!workers[workerID]) {
				workers[workerID] = {};
			}
			worker = workers[workerID];
			worker[key] = {
				'modelName': job.modelName,
				'operationName': job.operationName,
				'priority': job.priority
			};
		}
		obj.workers = workers;
		res.end(JSON.stringify(obj));
	},
	
	_ping: function (req, res) {
		var query = qs.parse(req._parsedUrl.query);
		req.id = uuid.v4();
		cluster.requests[req.id] = {
			'req': req,
			'res': res,
		}
		
		if (discover.me.isMaster && query.serverID) {
			if (discover.nodes[query.serverID]) {
				var node = discover.nodes[query.serverID];
				proxyRequest(req, res, node.address);
				return;
			}
		}
		
		if (query.jobID) {
			var jobID = query.jobID;
			if (jobID in cluster.jobs) {
				var job = cluster.jobs[jobID];
				var worker = job.worker;				
				if (worker.died) {
					res.write('status: \ncode: \nerror:' + worker.status);
					res.end();
					delete cluster.jobs[jobID];
				} else {
					worker.send({'cmd': '_ping', data: {
						'jobID': jobID,
						'reqID': req.id,
					}});
				}
			} else {
				client.hget('ping', jobID, function (err, reply) {
					if (err){
						console.log(err);
						res.end('status: \ncode: \nerror:Error getting job status');
					} else if (reply) {
						res.end(reply)
					} else {
						res.end('status: \ncode: \nerror:No such job running');
					}
				});
			}
		} else {
			res.end('status: \ncode: \nerror:missing jobID in the request');
		}
	},
	
}

var ipcHandlers = {

	'_httpcode': function (data) {
		var reqID = data.reqID
		console.log(reqID)
		var res = cluster.requests[reqID].res;
		res.statusCode = data.code;
	},
	
	'_end': function (data) {
		var reqID = data.reqID
		var res = cluster.requests[reqID].res;
		res.end(data.message);
		delete cluster.requests[reqID];
	},
	
	'_write': function (data) {
		var reqID = data.reqID
		var res = cluster.requests[reqID].res;
		res.write(data.message);;
	},
	
	_exit: function() {
		var worker = this;
		var timestamp = new Date().getTime();
		if (!worker.suicide && (timestamp - worker.timestamp > ERROR_TIMEOUT)) {
			console.log('OODEBE worker ' + worker.workerID + ' died :(');
			ipcHandlers._status({'from': '[SERVER]', event: 'INFO', 'message': 'Worker ' + worker.workerID + ' died'}, worker);
			var workers = cluster.priorities[worker.priority].workers;
			var i = workers.length;
			while (i--) {
				if (workers[i].workerID == worker.workerID) {
					workers.splice(i, 1);
				}
			}
			worker = cluster.fork(worker.priority);
		}
	},
	
	_addJob: function (data, worker) {
		cluster.jobs[data.jobID] = {
			'worker': worker,
			'modelName': data.modelName,
			'operationName': data.operationName,
			'priority': data.priority
		};
	},
	
	_delJob: function (data, worker) {
		worker.operations -= 1;
		delete cluster.jobs[data.jobID];
		
		// store in redis
		client.hset(['ping', data.jobID, data.pingMessage], function(err, reply){
			if (err) {
				console.log(err);
			}
		});
		
	},
	
	_error: function (data, worker) {
		worker.died = true;
		var obj = {};
		var i = data.jobs.length;
		if (i === 0) return;
		while (i--) {
			obj[data.jobs[i]] = data.pingMessage;
			delete cluster.jobs[data.jobs[i]];
		}
		client.hmset('ping', obj, function(err, reply){
			if (err) {
				console.log(err);
			}
		});
	},
	
	_status: function (data, worker) {
		if (data) {
			data.from = '[Worker ' + worker.workerID + ']';
			io.sockets.emit('status', data);
		}
	},
	
}

console.log('Plugins Dir: ' + path.resolve(__pluginsdir));

// Fork new workers
console.log('Workers Allocated:');

for (var key in cluster.priorities) {
	var priority = cluster.priorities[key];
	priority.workers_allocated = Math.round(cluster.total_workers * priority.percent / 100);
	priority.workers = [];
	if (!priority.per_worker) priority.per_worker = 0;
	console.log(key + ' priority: ' + priority.workers_allocated);
	for (var j = 0; j < priority.workers_allocated; j += 1) {
		var worker = cluster.fork(key);
	}
}

// Start HTTP server

var server = connect()
	.use(connect.logger('dev'))
	.use('/stat', connect.static(__dirname + '/stat'))
	.use('/favicon.ico', function (req, res) { })
	.use('/status', requestHandlers.status)
	.use('/_ping', requestHandlers._ping)
	.use('/_shutdown', requestHandlers._shutdown)
	.use('/_reload', requestHandlers._reload)
	.use('/', router)
	.listen(SERVER_PORT);

server.on('listening', function () {
	
});

// start listening on socket for status server
io = require('socket.io').listen(server, { 'log': false });

io.configure(function(){
	io.enable('browser client etag');
	io.set('log level', 1);
	io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
});

io.sockets.on('connection', function (socket) {
	socket.emit('status', { from: '[SERVER]', message: 'Welcome' });
});

function router (req, res, next) {	
	var accept = req.headers.accept || '';
	
	res.on('header', function (data) {
		// Can intercept headers and modify if required, added this to implement RESTful APIs
	})
	
	if (req.method == 'GET') { // GET		
		_initRequest(req, res, null);
	} else { // POST
		var body = '';
		
		req.setEncoding('utf-8');
		
		req.on('data', function (chunk){
			body += chunk;
		}); 
		
		req.on('end', function () {
			// Can check request header and decide if the POSTed data is in JSON or querystring
			// var data = JSON.stringify(body);
			var data = qs.parse(body);
			_initRequest(req, res, data);
		});
	}
}
	
function _initRequest(req, res, data) {
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	var pathname = url_parts.pathname;
	
	if (!query._op) {
		var arr = pathname.match(/\w+/g);
		if (arr && arr.length == 2){
			query.modelName = arr[0];
			query.operationName = arr[1];
			query._op = arr[0] + '.' + arr[1];
		} else {
			res.end('Incorrect API: Please specify the operation... e.g. http://' + req.headers.host + '/?_op=<model>.<operation>');
			return;
		}
	}
	
	if (data) {
		for (var key in data) {
			query[key] = data[key];
		}
	}
	
	// Validate the current request
	var modelName = query.modelName;
	var operationName = query.operationName;

	// Check if valid model
	if (!config.models[modelName]) { // not a valid model
		return res.end('Invalid model ' + modelName + ', model not found.');
	}
	
	var model = config.models[modelName];
	// Check if valid model definition
	if (!model['operations']) {
		return res.end('Invalid model definition, ' + modelName + ' has no operations.');
	}
	
	// Check if valid operation
	if (!model['operations'][operationName]) {
		return res.end('Invalid operation ' + operationName + ', operation not found in model ' + modelName);
	}
	
	var operation = model['operations'][operationName];
	// Check if valid operation definition
	if (!operation['type']) {
		return res.end('Invalid operation definition ' + modelName + '.' + operationName + ', type not specified');
	}
	
	// Check if valid controller
	if (!config.processors[operation['type']]) {
		return res.end('Invalid processor ' + operation['type'] + ' in ' + modelName + '.' + operationName + ', not found in config.');
	}

	if (!operation.priority) { // if no priority specified in the config for the current request, use first priority
		operation.priority = cluster.priorities[Object.keys(cluster.priorities)[0]];
	}
	
	// Decide which worker should get the request - currently doing round robin
	var priority = cluster.priorities[operation.priority];
	var workers = priority.workers;
	
	req.id = uuid.v4();
	cluster.requests[req.id] = {
		'req': req,
		'res': res,
		'nodeIndex': -1
	}
	
	var served = false;
	for (var i = 0; i < workers.length; i += 1) {
		var worker = workers[i];
		if ((priority.per_worker == 0) || (worker.operations < priority.per_worker)) {
			workers.splice(i, 1);
			workers.push(worker);
			worker.operations += 1;
			query.reqID = req.id;
			query.priority = operation.priority;
			res.setHeader('requestid', query.reqID);
			worker.send({'cmd': 'start', data: query});
			served = true;
			break;
		}
	}
	
	if (!served) {
		if (!query.reqID) {
			req._parsedUrl.path += '&reqID=' + req.id;
			delegateRequest(req, res);
		} else {
		// Forward request to another node in the cluster
			res.setHeader('requestid', query.reqID);
			res.statusCode = 307;
			res.end();
		}
	}
}

function delegateRequest (req, res) {
	var nodeIndex = cluster.requests[req.id].nodeIndex + 1;
	var nodeLength = Object.keys(discover.nodes).length;
	
	if (nodeLength && nodeIndex < nodeLength) {
		var node = discover.nodes[Object.keys(discover.nodes)[nodeIndex]];
		console.log('No local workers are free, forwarding... ' + node.address);
		cluster.requests[req.id].node = node;
		proxyRequest(req, res, node.address);
		cluster.requests[req.id].nodeIndex = nodeIndex;
	} else {
		console.log('No free workers found');
		res.end('No free workers found');
	}
}

function proxyRequest(req, res, ip) {
	var options = req._parsedUrl;
	
	options.headers = req.headers;
	options.method = req.method;
	options.agent = false;
	options.host = ip;
	options.port = SERVER_PORT;
	
	var proxy = http.request(options, function (res) {
		res.setEncoding('utf8');
		var proxyBody = [];
		
		res.on('data', function (chunk) {
			proxyBody.push(chunk);
		});
		
		res.on('end', function () {
			var reqID = res.headers.requestid;
			console.log(res.headers)
			var obj = cluster.requests[reqID];
			
			if (res.statusCode == 307) {
				console.log("Node can't process, forwarding ahead...");
				process.nextTick(function () {
					delegateRequest(obj.req, obj.res);
				});
			} else {
				for (var i = 0; i < proxyBody.length; i += 1) {
					obj.res.write(proxyBody[i]);
				}
				obj.res.end();
			}
		});
	});
	
	proxy.on('error', function(e) {
		console.log('problem with proxy request: ' + e.message);
	});

	proxy.end();
}
	
