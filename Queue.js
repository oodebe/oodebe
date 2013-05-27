var plugins = process.env.npm_package_config_plugins || './config';

var util = require('util');
var config = require(plugins);
var Controller=require('./Controller');
var Logger=require('./Logger');
require('date-utils');

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* Queue class
 * Creates and execute an operation in the form of a sequence of task processors
 * The config folder contains definitions of operations and processors
 * The constructor takes two parameters:
 * - data: the input data to be processed
 *         this needs to be a hash containing mandatory keys:
 *         ._op - contains the operation to be performed. The format of this is model.operation,
 *                where model = the name of the model and operation = name of operation on the model
 * - context: containing context information that can be used by processsors
 * context contains the following keys:
 *	.request - contains the http request object (may not be required)
 *	.sendResponse - callback for sending a response to the caller, typically in the form of JSON data
 *	.endRequest - callback to end the operation
 *	.sendStatus	- callback to send a status message that can be used to monitor the progress of the operation
 * The contructor creates the following instance variables in the queue object:
 * - data: the input data to be processed 
 * - context: the context received from the caller
 * - config: the configuration containing models and processors
 * - modelName: the name of the model on which the operation is to be performed, specified in data._op
 * - operationName: the name of the operation that is to be performed, specified in data._op
 * - model: the model configuration (extracted from config)
 * - operation: the operation configuration (extracted from config)
 * - controller: the instance of the controller class for the operation
 * - processors: array of instances of the processors for the operation
 */ 

function Queue(data,context) {
	var self=this;
	// call contructor of Controller
    Queue.super_.call(this);
	this.className='Queue';
	// set instance variables
	self.data=data;
	self.context=context;
	self.config=config;
	
	// set a flag indicating that the API request is stil pending... 
	// we can then automatically end the request if no child processor has already done so
	self.requestPending=true;
	// check data for operation requested, and look up the operation in registry, to find the processors mapped to the operation
	if (!data['_op']) { // no operation requested
		return self.sendError('No operation specified...ignoring request');
	}
	var op=data['_op'].split('.');
	if (op.length<2) { // incorrect format for operation... should be model.operation
		return self.sendError('Incorrect format of operation specified...needs to contain model.operation');
	}
	// based on specified operation, get model and operation
	self.modelName = op[0];

	if (Queue.pending) {
		if (Queue.pending[self.modelName]) {
			return self.showStatus('Model: ' + self.modelName + '\r\nProcess: ' + Queue.pending[self.modelName] + '\r\nStatus: ' + Queue.statusMessage);
		}
	} else {
		Queue.pending = {};
	}
	
	self.operationName=op[1];
	// check if valid model
	if (!config.models[self.modelName]) { // not a valid model
		return self.sendError('Invalid model '+self.modelName+' ... not found');
	}
	self.model=config.models[self.modelName];
	// check if valid model definition
	if (!self.model['operations']) {
		return self.sendError('Invalid model definition '+self.modelName+'... no operations found in model');
	}
	// check if valid operation
	if (!self.model['operations'][self.operationName]) {
		return self.sendError('Invalid operation '+self.operationName+'... not found in model '+self.modelName);
	}
	self.operation=self.model['operations'][self.operationName];
	// check if valid operation definition
	if (!self.operation['type']) {
		return self.sendError('Invalid operation definition '+self.modelName+'.'+self.operationName+'... no processor type specified');
	}
	// check if valid controller
	if (!config.processors[self.operation['type']]) {
		return self.sendError('Invalid processor '+self.operation['type']+' in '+self.modelName+'.'+self.operationName+'... not found in config');
	}
	// check if the operation has a log file and create a logger
	if (self.operation['log']) {
		self.logger = new Logger(self.operation['log']);
	}
	// create an instance for the controller
	self.controller=new config.processors[self.operation['type']](self.operation,self);
	// enable and emit start event to start the controller
	self.controller.enable('start');
	
	Queue.pending[self.modelName] = self.operationName;
	
	self.emit('start',context);
}
util.inherits(Queue, Controller);

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * done
 * event handler for 'done' event, emitted by the primary controller for the queue
 */
Queue.prototype.done = function(data) {
	var self=this;
	self.endRequest();
	if (Queue.pending[data.processor.queue.modelName]) {
		delete Queue.pending[data.processor.queue.modelName];
	}
}

/*
 * sendError - sends an error response and ends the operation
 */
Queue.prototype.sendError = function(message) {
	var msg="Error in data:"+JSON.stringify(this.data)+" Error:"+message;
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
	// send http response
	if (this.context.sendResponse) {
		this.context.sendResponse(data);
	}
}

/*
 * sendStatus - send status messages to the caller
 * typically used to monitor the operation execution
 */
Queue.prototype.sendStatus = function(data) {
	// send status message
	if (this.context.sendStatus) {
		if (data.msg) {
			Queue.statusMessage = data.msg;
			this.context.sendStatus(data);
		}
	}
}

/*
 * endRequest - call the callback to end the request
 * Note that this can be called at any time, and not necessarily after the requested operation is completed
 * In some cases, e.g. in batch operations, the request is ended before the batch operation is completed
 */
Queue.prototype.endRequest = function(data) {
	// all processors done
	if (this.context.endRequest && this.requestPending) {
		this.requestPending=false;
		this.context.endRequest(data);
	}
}

/*
 * addLogEntry - add a string to the log file
 */
Queue.prototype.addLogEntry = function(logentry) {
	if (this.logger) {
		this.logger.writeLog(logentry);
	}
}


// Static variable locks
Queue.locks = {};

/*
 * setLock - sets a lock on the given object
 */
 
Queue.prototype.setLock = function(locker) {
	var self = this;
	var key;
	
	if (self.isLocked(locker)) return; // No need to do if any key required by locker is already locked, the isLocked has already added the callback
	
	for (lockType in locker.lockData) {
		if (!Queue.locks[lockType]) Queue.locks[lockType] = {};
		for (key in locker.lockData[lockType]) {
			key = locker.lockData[lockType][key];
			Queue.locks[lockType][key] = {
				locked: true,
				callbacks: []
			};
		}
	}
	locker.callback.call(locker); // Call the callback to let the locker proceed
}

/*
 * unsetLock - removes a lock on the given object
 */
 
Queue.prototype.unsetLock = function(unlocker) {
	var self = this;
	var i, key, callbacks, lockType, processor, processors = [];
	
	for (lockType in unlocker.lockData) {
		if (Queue.locks[lockType]) {
			for (key in unlocker.lockData[lockType]) {
				key = unlocker.lockData[lockType][key];
				if (Queue.locks[lockType][key]) {
					Queue.locks[lockType][key].locked = false;;
					callbacks = Queue.locks[lockType][key].callbacks;
					processor = callbacks.shift();
					if (processor) processors.push(processor);
					if (callbacks.length == 0) delete Queue.locks[lockType][key];
				}
			}
		}
	}
	
	i = 0;
	while (i < processors.length) {
		if (!self.isLocked(processors[i])) processors[i].callback.call(processors[i]);
		i += 1;
	}
}


/*
 * isLocked - checks if a lock exists
 */

Queue.prototype.isLocked = function(processor) {
	var self = this;
	var key, callbacks, lockType, locked = false;

	for (lockType in processor.lockData) { // eg lockType = 'pfLock'
		if (Queue.locks[lockType]) {
			for (key in processor.lockData[lockType]) {
				key = processor.lockData[lockType][key]; // eg key = 'PF1'
				if (Queue.locks[lockType][key] && Queue.locks[lockType][key].locked) {
					Queue.locks[lockType][key].callbacks.push(processor);	// if lock exists, Set callback
					return true;
				}
			}
		}
	}
	return locked;
}

Queue.prototype.sendMail = function (message) {
	var self = this;
	if (!message) {
		console.log('No data was given to sendMail');
		return;
	}
	
	var server, email, config;
	
	email = require('emailjs');
	config = self.model.config.email;
	
	if (config.name) {
		message.from = config.name + ' <' + config.user + '>';
	} else {
		message.from = config.user;
	}
	if (!message.to) message.to = config.to;
	if (!message.text) message.text = " ";
	if (config.subjectPfx) {
		message.subject = config.subjectPfx + ' - ' + message.subject;
	}
	
	var server  = email.server.connect(config);
	server.send(message, function (err, message) {
		if (err) console.log (err);
		// console.log (err || message);
	});
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
 
module.exports = Queue;
