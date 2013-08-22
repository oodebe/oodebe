// Test Processor
var util=require('util');
var Processor = require(__basedir + '/Processor');

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* 
 * TestProcessor - implements test interface
 *
 */ 
function TestProcessor(config,queue,parent) {
	var self=this;
	TestProcessor.super_.call(this,config,queue,parent);
	self.className='TestProcessor';
	// register queue event handler for 'start' event
	self.setHandler('start',self.start);
	
}
util.inherits(TestProcessor,Processor);

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * start(data)
 * data: any
 * executes the actual task 
 */
TestProcessor.prototype.start = function(data) {
	var self=this;
	// set config flag 'started'
	self.config.started=true;
	// disable start so we do not start again
	self.disable('start');
	// start processing
	console.log('Start');	
	
	self.sendStatus({event:'start'});
	setTimeout(function() {
		self.sendStatus({event:'done'});
		self.config.started=false;
		self.parent.emit('done',{'processor':self});
	}, 1000);
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
module.exports = TestProcessor;
