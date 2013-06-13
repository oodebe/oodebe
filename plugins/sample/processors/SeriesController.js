var util=require('util');
var Controller=require(process.env.global_path + '/Controller');

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/*
 * Series Task Controller
 * inherits from Generic Controller
 * and executes all processors in Series
 */

function SeriesController(config,queue,parent) {
	var self=this;
	SeriesController.super_.call(this,config,queue,parent);
	self.className='SeriesController';
	// Controller already registered and enabled the 'start' and 'done' events
}
util.inherits(SeriesController,Controller);

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * start(data)
 * data:any
 * this method is the callback registered for the 'init' event of the queue
 * the 'init' event is emitted as soon as the queue is instantiated
 * it enables the first processor
 * and emits the 'start' event to start executing the first processor
 */
SeriesController.prototype.start = function(data) {
	var self=this;
	// set config flag 'started'
	self.config.started=true;
	// disable start so we do not start again
	self.disable('start');
	// send status
	self.sendStatus({event:'start'});
	// create all processors
	self.createProcessors();
	// create shared counter in queue
	self.counter=0;
	// pass the object to the first processor
	self.processors[0].setConfig({object:self.config.object});
	// enable first processor's 'start' event and disable all others
	self.processors[0].enable('start');
	for (var i=1;i<self.processors.length;i++) {
		self.processors[i].setConfig({object:self.config.object});
		self.processors[i].disable('start');
	}
	// emit start event for executing the first child processor
	self.emit('start');
}

/*
 * done(data)
 * data:hash containing key 'processor' 
 *      - processor: this is the instance of the processor that emits the 'done' event
 * this method is the callback registered for the 'done' event of the queue
 * the 'done' event is emitted by each processor as soon as it completes its execution 
 * it ends the processor that is done,
 * and checks the counter to check if all processors are already done 
 * if yes, then the queue is completed, and calls endQueue
 * if no, then it enables the next processor and emits the 'start' event
 */
SeriesController.prototype.done = function(data) {
	var self=this;
	// check which processor is done and disable it's 'start' event
	if (data.processor) {
		data.processor.disable('start');
	}
	// update counter
	self.counter++;
	// if all processors are done, end queue
	if (self.config.error || self.counter>=self.processors.length) {
		self.sendStatus({event:'done',numObjects:1});
		self.config.started=false;
		self.parent.emit('done',{'processor':self});
	} else {
		// if not all processors are completed, enable the next processor's 'start' event
		self.processors[self.counter].enable('start');
		// and start it
		self.emit('start');
	}
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
module.exports = SeriesController;
