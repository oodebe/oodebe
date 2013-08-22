var util = require('util');
var Processor = require(__basedir + '/Processor');
var fs = require('fs');

function ObjectProcessor(config, queue, parent) {
	var self = this;
	ObjectProcessor.super_.call(this, config, queue, parent);
	self.className = 'ObjectProcessor';
	
	self.setHandler('start', self.start);	
}
util.inherits(ObjectProcessor, Processor);

ObjectProcessor.prototype.start = function(data) {
	var self = this;
	
	self.config.started = true;
	
	self.disable('start');
	// self.sendStatus({message:'Start'});
	
	console.log(self.className + ': ' + self.config.object);

	setTimeout(function () {
		// self.sendStatus({message: 'Done'});
		self.config.started = false;
		self.parent.emit('done', {'processor':self});
	}, 1000);
}

module.exports = ObjectProcessor;