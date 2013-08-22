var util=require('util');
var Processor=require('../../Processor');

function SourceProcessor(config,queue,parent) {
	var self=this;
	SourceProcessor.super_.call(this, config, queue, parent);
	self.className='SourceProcessor';
	
	if (!config.pageLength) {
		config.pageLength = 10;
	}

	self.config.arr = [];	
	for (i=1; i <= 50; i++) self.config.arr.push(i);
	self.setHandler('start', self.start);
}
util.inherits(SourceProcessor,Processor);

SourceProcessor.prototype.start = function(data) {
	var self=this;
	self.config.started = true;
	self.disable('start');
	
	if (data && data.count) self.config.pageLength = data.count;
	
	console.log(self.className + ': Start');
	self.sendStatus({message:'Fetching new objects'});
	// console.log(self.config.pageLength)
	var arr = self.config.arr.splice(0, self.config.pageLength);
	
	setTimeout(function () {
		self.sendStatus({message: 'Done'});
		self.config.started = false;
		self.parent.emit('done', {'processor': self, objects: arr });
	}, 1000);
}

module.exports = SourceProcessor;