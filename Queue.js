var util = require('util');
var Controller = require('./Controller');
var Logger = require('./Logger');
var	fs = require("fs");

/**
* Creates and execute an operation in the form of a sequence of task processors
* creates the following instance variables in the queue object
*
* data: the input data to be processed 
* config: the configuration containing models and processors
* modelName: the name of the model on which the operation is to be performed, specified in data._op
* operationName: the name of the operation that is to be performed, specified in data._op
* model: the model configuration (extracted from config)
* operation: the operation configuration (extracted from config)
* controller: the instance of the controller class for the operation
*
* @class Queue
* @constructor
* @param {object} data The input data to be processed
* @param {object} data._op The Mandatory key specifying the operation to be performed
**/ 

function Queue (data, response) {
	var self = this;
	
	// call contructor of base class - Controller
  Queue.super_.call(this);
	 
	self.className = 'Queue';
	
	// Initialize instance variables
	self.data = data;
	self.nodeID = data.nodeID;
	self.reqID = data.reqID;
	
	// require plugins and store in self
	var config = require(__pluginsdir);
	self.config = config;
	
	// set a flag indicating that the API request is stil pending... 
	// we can then automatically end the request if no child processor has already done so
	self.requestPending = true;

	
	// based on specified operation, get model and operation
	self.modelName = data.modelName;
	self.operationName = data.operationName;
	
	self.model = config.models[self.modelName];
	self.operation = self.model['operations'][self.operationName];
	
	if (data['jobID'] && data['jobID'].trim() != "") self.uuid = data['jobID'];
	if (data['jobDate'] && data['jobDate'].trim() != "") {
		self.jobDate = data['jobDate'];
	} else {
		var date = new Date();
		self.jobDate = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
	}
	
	cluster.log({type: 'INFO', message: 'JOB ID=' + self.uuid + ',URL=' + self.data.url + ',MSG=Started processing the request', opr: 'SYSTEM'});
	
	// create an instance for the controller
	self.controller = new config.processors[self.operation['type']](self.operation,self);
	
	// enable and emit start event to start the controller
	self.controller.enable('start');
	
	self.logFolder = '';
	// Create log directory
	if(data['logFolderPath'] && data['logFolderPath'].trim() != "") {
		var param = data['logFolderPath'];
		param = param.replace(/[\/]$/, '').trim();
		
		if (param != "") {
			try {
				var exists = fs.lstatSync(param);
				if(exists.isDirectory()) {
					self.logFolder = param + "/";
				}
			} catch (e) {
				console.log('No such file or directory "' + param + '" exists...');
			}				
		}
	}
	
	// check if the operation has a log file and create a logger
	self.logger = {};
	self.logConfigs = {};		
	var logFileName;
	
	// self.logger[logKey] = new Logger(self, 'out', 'out.log');

	if (!self.operation['log']) {
		self.operation['log'] = {};
	}
	var logs = self.operation['log'];
	var logFiles = {};
	
	for(var logKey in logs) {
		logFileName = null;
		
		if (data[logKey] && data[logKey].trim() != '') {
			logFileName = data[logKey];
		} else {
			logFileName = logs[logKey];
			logFileName = logFileName.replace('{{jobID}}', self.uuid);
			logFileName = logFileName.replace('{{jobDate}}', self.jobDate);
		}
		
		if (logFileName === '') {
			self.done({message: logKey + ' log file name is missing'});
			return;
		}
		
		var regex = /^[a-z0-9]+?([\w\-. ]+?[a-z])?$/i;
		if(!regex.test(logFileName)) {
			self.done({message: logKey + ' log file name "' + logFileName + '" is not a valid filename'});
			return;
		}
		
		logFiles[logKey] = logFileName;
	}

	for(var logKey in logFiles) {
		var logger = new Logger(self, logKey, logFiles[logKey]);
		self.logConfigs[logKey] = logger.logFileLocation;
		
		if (!logger.success) {
			self.done({message: 'Error creating default log folder.'});
			return;
		}
		
		self.logger[logKey] = logger;
	}
	
	self.emit('start');
	self.started = true;
	self.status = 'Started';
	self.exitCode = '0';
}
util.inherits(Queue, Controller);

/**
* event handler for 'done' event, emitted by the primary controller for the queue
* 
* @method done
* @param {string} err.message message to be shown for the job terminated with error
*/
Queue.prototype.done = function(err) {
	var self = this;
	self.started = false;
	
	var str = '\n';
	if (self.logConfigs) {
		for (var key in self.logConfigs) {
			str += key + '_log: ' + self.logConfigs[key] + '\n'
		}
	}
	
	var msgstr = '';
	if (self.abort) {
		self.status = 'Aborted';
		msgstr = 'Aborted processing the request';
	} else {
		self.status = 'Completed';
		msgstr = 'Completed processing the request';
	}
	cluster.log({type: 'INFO', message: 'JOB ID=' + self.uuid + ',URL=' + self.data.url + ',MSG=' + msgstr, opr: 'SYSTEM'});
	process.send({'cmd': '_delJob', data: {'jobID': self.uuid, pingMessage: 'status:' + self.status + ' \ncode:' + self.exitCode + str}});
	
	if (err && err.message) {
		var msg = "Error in data:" + JSON.stringify(self.data) + " Error: " + err.message;
		self.sendStatus(msg);
		self.sendResponse(msg);
	} else {
		self.sendStatus({'event': 'DONE', 'message': 'completed'});
	}
	
	for (var key in self.logger) {
		self.logger[key].closeStream();
	}
	
	self.endRequest();
}

/*
 * sendError - sends an error response and ends the operation
 */
Queue.prototype.sendError = function(message) {
	var msg = "Error in data:" + JSON.stringify(this.data) + " Error: " + message;
	this.sendStatus(msg);
	this.sendResponse(msg);
	this.endRequest();
}

Queue.prototype.showStatus = function(message) {
	var msg = message;
	this.sendResponse(msg);
	this.endRequest();
}

/*
 * sendResponse - sends a response to the caller
 * data - any, typically JSON to be returned to the caller
 * can be called multiple times to return part data
 */
Queue.prototype.sendResponse = function(data) {
	var self = this;
	// send http response
	if (data) {
		process.send({'cmd': '_write', 'data': {'reqID': self.reqID, 'message': data}});
	}
}

/*
 * sendStatus - send status messages to the caller
 * typically used to monitor the operation execution
 */
Queue.prototype.sendStatus = function(data) {
	var self = this;
	// send status message
	data.jobID = self.uuid;
	cluster.log(data);
}

Queue.prototype.sendHTTPCode = function(code) {
	var self = this;
	// set status code
	if (!isNaN(code)) {
		process.send({'cmd': '_httpcode', 'data': {'reqID': self.reqID, 'code': code}});
	}
}

Queue.prototype.sendHTTPHeader = function(data) {
	var self = this;
	// set status code
	if (data) {
		process.send({'cmd': '_httpheader', 'data': {'reqID': self.reqID, 'headers': data}});
	}
}

/*
 * endRequest - call the callback to end the request
 * Note that this can be called at any time, and not necessarily after the requested operation is completed
 * In some cases, e.g. in batch operations, the request is ended before the batch operation is completed
 */
Queue.prototype.endRequest = function(data) {
	var self = this;
	
	if (self.requestPending) {
		self.requestPending = false;
		process.send({'cmd': '_end', 'data': {'reqID': self.reqID, 'message': data}});
	}
}

Queue.prototype.addLogEntry = function(logentry, key) {
	if (key in this.logger) {
		this.logger[key].writeLog(logentry);
	}
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
 
module.exports = Queue;
