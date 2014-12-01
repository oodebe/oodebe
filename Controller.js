var util=require('util');
var Processor=require('./Processor');
var EventEmitter = require("events").EventEmitter;

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* Super class for a generic task controller
 * Executes the constructor for Processor, and then
 * registers and enables handlers for 'init' and 'done' events of the queue
 */
function Controller(config, queue, parent) {
	var self=this;
	// call constructor of Processor
	Controller.super_.call(this,config,queue,parent);
	// create an EventEmitter
	self.bus=new EventEmitter();
	self.className='Controller';
	// register handler for start event in parent controller

	self.setHandler('start',self.start,self.parent);
	// register handler for 'done' event in this controller for child processors
	self.enable('done',self.done,self);
}
util.inherits(Controller,Processor);

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * emit(event,data)
 * Emit an event on the event bus for this controller
 */
Controller.prototype.emit = function(event,data) {
	var self = this;
	
	process.nextTick(function () {
		self.bus.emit(event,data);
	});
}
 
/*
 * addListener(event,handler)
 * Add a listener to the event bus for this controller
 */
 Controller.prototype.addListener = function(event,handler) {
	this.bus.addListener(event,handler);
}

/*
 * removeListener
 * Remove a listener from the event bus for this controller
 */
 Controller.prototype.removeListener = function(event,handler) {
	this.bus.removeListener(event,handler);
 }
 
/*
 * start(data)
 * data:any
 * this method is the callback registered for the 'start' event for the parent controller
 * the 'start' event is emitted by the parent as soon as the controller is expected to start execution
 * this method should be extended by sub-classes
 * it can be used to instantiate various child processors 
 * and emit the 'start' event to the children to start executing them
 */
Controller.prototype.start = function(data) {
	var self=this;
	// create instances of all processors
	self.queue.sendStatus('** start '+JSON.stringify(self.queue.query));
}

/*
 * createProcessors()
 * create instances for all processors in the configuration
 */
Controller.prototype.createProcessors = function() {
	var self=this;
	// check if processors specified
	if (!self.config['processors'] || !self.config['processors'].length) {
		return self.queue.sendError('Invalid operation... processors not specified');
	}
	// check if all processors are valid
	self.processors=[];
	for (var proc in self.config['processors']) {
		var pconfig=self.config['processors'][proc];
		if (!self.queue.config.processors[pconfig.type]) {
			return self.queue.sendError('Invalid processor '+pconfig.type+' in '+self.queue.modelName+'.'+self.queue.operationName+'... not found');
		}
		// not checking validity of processor classes...assuming that if the processor is defined, it has requisite capabilities
		self.processors.push(new self.queue.config.processors[pconfig.type](pconfig,self.queue,self));
	}
}

/*
 * createProcessor(num)
 * create a new instance of processor number 'num' and passes additional configuration options
 * model:  model hash of the processor containing key 'type' and other parameters
 * config: hash containing additional config data
 * returns the processor instance
 */
Controller.prototype.createProcessor = function(model,config) {
	var self=this;
	// create a new config hash
	var conf={};
	// add processor model
	for (var c in model) {conf[c]=model[c];}
	// add additional config if passed
	if (config) for (var c in config) {conf[c]=config[c];}
	// check if valid processor
	if (!self.queue.config.processors[model.type]) {
		self.queue.sendError('Invalid processor '+model.type+' in '+self.queue.modelName+'.'+self.queue.operationName+'... not found');
		return null;
	}
	// return new instance
	return new self.queue.config.processors[model.type](conf,self.queue,self);
}

/*
 * done(data)
 * data:hash containing key 'processor' 
 *      - processor: this is the instance of the processor that emits the 'done' event
 * this method is the callback registered for the 'done' event of the queue
 * the 'done' event is emitted by each processor as soon as it completes its execution 
 * this method should be extended by sub-classes
 * it should contain code to evaluate the status of the queue 
 * and enable or disable various processors, or if the queue is completed, call endQueue
 * the default impementation is to run all processors in parallel
 */
Controller.prototype.done = function(data) {
	var self=this;
	// check which processor is done and disable it from the start event
	if (data.processor) {
		data.processor.disable('start',self);
	}
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
module.exports = Controller;
