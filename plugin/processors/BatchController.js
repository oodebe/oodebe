var util = require('util');
var Controller = require(__basedir + '/Controller');
var events = require('events');

function BatchController(config,queue,parent) {
	var self = this;
	BatchController.super_.call(this, config, queue, parent);
	self.className = 'BatchController';
	
	if (!self.config.concurrency) {
		self.config.concurrency = 1;
	}
	
	self.avgRequestTime = 100;	
	self.requestTimestamp = 1;
	self.avgDivide = 1;
}
util.inherits(BatchController, Controller);

BatchController.prototype.start = function(data) {
	var self = this;
	
	self.disable('start');
	self.sendStatus({event: 'start'});
	self.queue.endRequest(self.queue.uuid + '|' + self.queue.nodeID);
	
	var proc = self.createProcessor(self.config.processors[0]);
	proc.isSource = true;
	self.sourceProcessor = proc;

	self.batchProcessor = new BatchProcessor(self.config, self.queue, self);
	
	self.buffer = [];
	self.config.sourceDepleted = false;
	self.sourceProcessor.enable('start');
	self.sourceStarted = false;
	
	self.requestTimestamp = (new Date()).getTime();
	self.emit('start');
}

BatchController.prototype.done = function(data) {
	var self = this;

	if (!data.processor) {
		self.queue.sendError('Invalid done event raised by processor... did not pass processor in event data');
		console.log('Invalid done event raised by processor... did not pass processor in event data')
		self.parent.emit('done', {processor: self});
		return;
	}
	
	if (data.processor.isSource) {
		self.sourceStarted = false;
		self.avgRequestTime = Math.round((self.avgRequestTime + (((new Date()).getTime()) - self.requestTimestamp)) / self.avgDivide);
		self.avgDivide = 2;

		if (data.object) data.objects = [ data.object ];
		if (data.objects && data.objects.length > 0) {
			self.buffer = self.buffer.concat(data.objects);
			if (!self.batchProcessor.started) {
				self.batchProcessor.start.call(self.batchProcessor);
			}
		} else {
			self.config.sourceDepleted = true;
			if (!self.batchProcessor.started) {
				self.batchDone();
				return;
			}
		}
		// console.log('SOURCE DONE ' + self.buffer.length);
	}
}

BatchController.prototype.batchDone = function(data) {
	var self = this;
	
	console.log('BATCH DONE')
	self.sendStatus({event:'done', numObjects: self.config.counter});
	self.started = false;
	self.parent.emit('done',{processor: self});
}

BatchController.prototype.pull = function(count) {
	var self = this;
	var arr = [];
	
	self.queue.status = 'Running - ' + self.batchProcessor.config.counter + ' Objects processed';
	self.queue.exitCode = '12';
	
	if (self.buffer.length > 0) {
		arr = self.buffer.splice(0, count);
	}
	
	self.bufferMin = Math.ceil((self.avgRequestTime / self.batchProcessor.avgRequestTime)) * self.config.concurrency;
	// console.log(self.bufferMin);
	
	if ((self.buffer.length <= self.bufferMin) && !self.sourceStarted && !self.config.sourceDepleted) {
		self.sourceProcessor.enable('start');
		self.sourceStarted = true;
		console.log('Starting Source');
		self.requestTimestamp = (new Date()).getTime();
		self.emit('start', {'count': self.bufferMin * 2});
	}
	
	return arr;
}

function BatchProcessor (config, queue, parent) {
	var self = this;
	BatchProcessor.super_.call(this, config, queue, parent);
	self.className = 'BatchProcessor';
	
	if (!self.config.concurrency) {
		self.config.concurrency = 1;
	}
	
	self.config.counter = 0;
	self.started = false;
	self.objects = [];
	self.objectProcessors = {};
	self.avgRequestTime = 100;
	self.requestTimestamp = 1;
	self.avgDivide = 1;
	
	self.bus = new events.EventEmitter();
}
util.inherits(BatchProcessor, Controller);

BatchProcessor.prototype.emit = function (event, data) {
	var self = this;
	if (self[event]) {
		var handler = self[event];
		handler.call(self, data);
	}
}

BatchProcessor.prototype.start = function () {
	var self = this;
	var emitStart = false;
	var proc;
	
	self.requestTimestamp = (new Date()).getTime();
	
	self.started = true;
	console.log(self.className + ': Start -----------------------------------------');
	
	if (self.objects.length < self.config.concurrency) {
		self.objects = self.parent.pull(self.config.concurrency);
	}
	
	for(var i = 0; i < self.config.concurrency; i += 1) {
		if (self.objects.length == 0) break;
		
		proc = self.createProcessor(self.config.processors[1]);
		proc.index = i + 1;
		self.objectProcessors[proc.uuid] = proc;
		
		var obj = self.objects.shift();
		proc.setConfig({object: obj});
	}
	
	self.beginBatch();
}

BatchProcessor.prototype.beginBatch = function () {
	var self = this;
	var proc;
	
	for (var p in self.objectProcessors) {
		proc = self.objectProcessors[p];
		proc.start.call(proc);
	}
}

BatchProcessor.prototype.done = function (data) {
	var self = this;
	var emitStart = false;
	var proc = data.processor;
	
	var timestamp = ((new Date()).getTime());
	self.avgRequestTime = Math.round((self.avgRequestTime + (timestamp - self.requestTimestamp)) / self.avgDivide);
	self.avgDivide = 2;
	
	self.config.counter += 1;
	
	if (!data.processor) {
		console.log('Invalid processor raised event');
		return;
	}
	
	if (self.objects.length <= self.config.concurrency) {
		self.objects = self.objects.concat(self.parent.pull(self.config.concurrency));
	}
	
	if (self.objects.length == 0) {
		delete self.objectProcessors[proc.uuid];
		if (Object.keys(self.objectProcessors).length == 0) {
			self.started = false;
			if (self.parent.config.sourceDepleted) {
				self.parent.batchDone();
			}
		}
		return;
	}
	
	var obj = self.objects.shift();
	if (obj) {
		proc.setConfig({object: obj});
		self.requestTimestamp = timestamp;
		proc.start.call(proc);
	}
}

module.exports = BatchController;
