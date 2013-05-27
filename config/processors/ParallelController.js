var util=require('util');
var Controller=require('../../Controller');

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/*
 * Parallel Task Controller
 * inherits from Controller
 * and executes all processors in parallel
 */

function ParallelController(config,queue,parent) {
	var self=this;
	ParallelController.super_.call(this,config,queue,parent);
	self.className='ParallelController';
	// Controller already registers and enables handlers for 'init' and 'done' events
}
util.inherits(ParallelController,Controller);

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * start(data)
 * data:any
 * this method is the callback registered for the 'init' event of the queue
 * the 'init' event is emitted as soon as the queue is instantiated
 * it enables all processors (enabled by default)
 * and emit the 'start' event to start executing the processors
 */
ParallelController.prototype.start = function(data) {
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
	// enable all processors to listen to 'start' event
	for (var p in self.processors) {
		p=self.processors[p];
		// pass the object to the processor
		p.setConfig({object:self.config.object});
		// enable the processor
		p.enable('start');
	}
	// emit start event for all child processors
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
 * if no, then it will get called again on the next processor completing
 */
ParallelController.prototype.done = function(data) {
	var self=this;
	// check which processor is done and disable it's start event
	if (data.processor) {
		data.processor.disable('start');
	}
	// update counter
	self.counter++;
	// if all processors are done, end queue
	if (self.counter>=self.processors.length) {
		self.sendStatus({event:'done',numObjects:1});
		self.config.started=false;
		self.parent.emit('done',{processor:self});
	}
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
module.exports = ParallelController;
