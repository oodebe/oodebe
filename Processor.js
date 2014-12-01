var util=require('util');
var uuid=require('node-uuid');
//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* Super class for a generic task processor
 * All custom task processors can inherit from this class.
 * The constructor accepts a single variable, which is an instance of the queue that this task processor operates on.
 * The following instance variables will be created
 * queue: pointer to the queue
 * handlers: anonymous functions that are created for registering as listeners to the various queue events
 * enabled: status of whether a particular event is enabled for this processor
 */ 
function Processor(config,queue,parent) {
	var self=this;
	// assign class name
	self.className='Processor';
	// assign a uuid
	self.uuid=uuid.v4();
	// save attributes
	if (config) self.config = JSON.parse(JSON.stringify(config));
	if (queue) self.queue=queue;
	if (parent) {
		self.parent=parent;
	} else {
		self.parent=queue;
	}
	// initialize handlers
	self.handlers={};
	self.enabled={};
	self.lastTimeStamp=0;
}

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/*
 * setHandler(event,handler)
 * event: name of event
 * handler: function that will be called by the queue when the event is emitted
 * Note that the handler function can use 'this' to refer to the processor
 * This creates a handler for the processor to use as a listener of queue's specified event
 * the handler is added to the 'handlers' instance variable for later use by the 'enable' method
 */
Processor.prototype.setHandler = function(event,handler,controller) {
	var self=this;
	if (!controller) {
		controller=self.parent;
	}
	// if no controller, nothing to do
	if (!controller || !controller.uuid) return;
	// if this is the first event for this controller, initialize the handlers hash for it
	if (!self.handlers[controller.uuid]) {
		self.handlers[controller.uuid]={};
	}
	if (event) {
		// if handler is specified, add it to handlers
		if (handler) {
			// create an anonymous function so that we retain 
			self.handlers[controller.uuid][event]=function() {
				handler.apply(self,arguments);
			};
		}
	}
}

/*
 * setConfig
 * to add parameters to the configuration
 * typically used to re-use the same instance to process different data
 */
Processor.prototype.setConfig = function(parms) {
	var self=this;
	if (parms) {
		// Note: should use deep copy... for now only copying first level
		for (var p in parms) {
			self.config[p]=parms[p];
		}
	}
}

/*
 * enable(event,handler)
 * event: name of event
 * handler: function that will be called by the queue when the event is emitted
 * controller: controller of the event (EventEmitter)
 * Note that the handler function can use 'this' to refer to the processor
 * This method registers the processor as a listener of queue's specified event
 * and also sets the enabled flag for the event
 * assumes that the constructor has already created a callback in the instance variable 'callbacks'
 */
Processor.prototype.enable = function(event,handler,controller) {
	var self=this;
	if (!controller) {
		controller=self.parent;
	}
	// if no controller, nothing to do
	if (!controller || !controller.uuid) return;
	// if this is the first event for this controller, initialize the enabled hash for it
	if (!self.enabled[controller.uuid]) {
		self.enabled[controller.uuid]={};
	}
	// if event specified, then enable it's handler
	if (event) {
		// check if there is an existing handler already enabled, and if so disable it
		if (self.enabled[controller.uuid][event]) {
			self.disable(event,controller);
		}
		// if handler is specified, add it to handlers
		if (handler) {
			self.setHandler(event,handler,controller);
		}
		// register the handler as a listener to the event
		if (self.handlers[controller.uuid][event]) {
			controller.addListener(event,self.handlers[controller.uuid][event]);
			self.enabled[controller.uuid][event]=true;
		}
	}
}

/*
 * disable(event)
 * event: name of event
 * removes the processor from the listeners of queue's specified event
 * and resets the enabled flag for the event
 */
Processor.prototype.disable = function(event,controller) {
	var self = this;
	if (!controller) {
		controller = self.parent;
	}
	// if no controller, nothing to do
	if (!controller || !controller.uuid) return;
	// if this is the first event for this controller, initialize the enabled hash for it
	if (!self.enabled[controller.uuid]) {
		self.enabled[controller.uuid]={};
	}
	// if event specified and it is enabled, then disable it
	if (event && self.enabled[controller.uuid][event]) {
		controller.removeListener(event,self.handlers[controller.uuid][event]);
		self.enabled[controller.uuid][event]=false;
	}
}

/* sendStatus(data)
 * sends a status message containing
 * event: event that occurred
 * other data that needs to be written specific to the event
 */
Processor.prototype.sendStatus = function(data) {
	var self = this;
	if (typeof data != "object") {
		data = {};
		data.message = data;
	}
	self.queue.sendStatus(data);
}
//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------
 
module.exports = Processor;
