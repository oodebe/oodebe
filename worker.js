/*
* worker.js
* Forked by master as a child process.
* Listens on IPC events from master to perform tasks
*/

var Queue = require('./Queue');
	
var nodeID;
var worker = {
	queues: {},
}

/* Declaring variable in global scope to make it available in all the required plugins */
GLOBAL.__pluginsdir = '';
GLOBAL.__basedir = '';
GLOBAL.cluster = {};

/*
*	Listener on global exception to catch and log the exceptions that were not handled in the application
*/
process.on('uncaughtException', function (err) {
	console.log('Uncaught exception, worker must exit...');
	
	// Sends IPC message to master reporting the error along with the jobs this worker was handling
	process.send({'cmd': '_error', 'data': {pingMessage: 'status: \ncode: \nerror:' + err.message, jobs: Object.keys(worker.queues)}});
	
	// Also send to status updater and log
	cluster.log({type: 'DEBUG', message: 'MSG=' + err.message + ',StackTrace=' + err.stack, opr: 'SYSTEM'});
	// and exits the process to clean up the invalid state of the program
	process.nextTick(function () {
		process.exit(1);
	});
});

cluster.log = function (data) {
	process.send({'cmd': '_status', 'data': data});
}

var cluster_config = require(process.env.cluster_config);

for (var key in cluster_config) {
	cluster[key] = cluster_config[key];
}

/* Handler function that calls event handlers if they exists */
function messageHandler(msg, handle) {
	var cmd = msg.cmd;
	if (!cmd) return;
	
	if (handlers[cmd]) {
		var data = msg.data;
		handlers[msg.cmd](data, handle);
	}
}

process.on('message', messageHandler);

/* Handler functions that are triggered on IPC events */
var handlers = {

	/**
	* invoked while forking the new instance of worker to initialize the nodeID and gobal variables
	* 
	* @method init
	* @param {object} data Contains values to initialize local and global variables
	**/
	init: function (data) {
		__basedir = data.__basedir;
		__pluginsdir = data.__pluginsdir;
		nodeID = data.nodeID;
		
		process.env.global_path = __basedir;
	},
	
	/**
	*	invoked on hitting the API
	* initializes a new instance of Queue with the data received from the request URL/body
	* sends an IPC message to the master, indicating a successfull initialization of the task
	* 
	* @method start
	* @param {object} data The data passed in the URL while requesting
	**/
	start: function (data) {
		data.nodeID = nodeID;
		
		var queue = new Queue(data);
		worker.queues[queue.uuid] = queue;
		process.send({'cmd': '_addJob', data: {'jobID': queue.uuid, 'modelName': data.modelName, 'operationName': data.operationName, 'priority': data.priority}});
	},
	
	/**
	* clears the `require` cache to force reload the modified code of the plugin
	* 
	* @method _reload
	**/
	_reload: function () {
		for (var c in require.cache) {
			delete require.cache[c];
		}
	},
	
	/**
	* TODO: To gracefully abort a background running job
	* 
	* @method abort
	**/
	abort: function (data) {
		console.log(data)
	},
	
	/**
	* used to check status of long running background jobs.
  * @param {string} data.jobID ID of the background job to get its status
	* 
	* @method _ping
	**/
	_ping: function (data) {
		var jobID = data.jobID;
		var queue = worker.queues[jobID];
		var str = '\n';
		if (queue.logConfigs) {
			for (var key in queue.logConfigs) {
				str += key + '_log: ' + queue.logConfigs[key] + '\n'
			}
		}
		
		process.send({'cmd': '_end', 'data': {'reqID': data.reqID, 'message': 'status:' + queue.status + ' \ncode:' + queue.exitCode + str }});
	},
	
	_killjob: function (data) {
		var jobID = data.jobID;
		var queue = worker.queues[jobID];
		queue.abort = true;
		queue.status = 'Aborting';
		process.send({'cmd': '_end', 'data' : {'reqID': data.reqID, 'message': 'Abort request sent for the job process - ' + jobID}});
	}
}
