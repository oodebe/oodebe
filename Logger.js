var	fs = require("fs");

/**
* Each instance represents a unique log file
* 
* @class Logger
* @constructor
* @param {string} logKey log filename suffix
*/
function Logger(queue, logKey, logFileName) {
	// set filename and open file
	this.success = true;
	if(!this.openStream(queue, logKey, logFileName)) {
		this.success = false;
	}
}

/* Class static variable for maintaining all stream handles */
Logger.streams = {};

/** 
* opens/creates the specified log file stream and saves the handle in the instance variable
* 
* @method openStream
* @param queue
*/
Logger.prototype.openStream = function(queue, logKey, logFileName) {
	var self = this;
	
	// var filename = queue.operation.log[logKey];
	var logPath = queue.logFolder;
	var uuid = queue.uuid;
	
	// if (!filename) {
		// return self.sendError("Unable to open log file. No filename specified");
	// }
	self.filename = logFileName;
	
	// check if an instance already exists for this filename
	if (Logger.streams[self.filename]) {
		var that = Logger.streams[self.filename];
		that.closeStream();
	}
	
	var filePath = queue.logFolder.trim();
	
	if(filePath == "") {
		filePath = __dirname + '/logs/';
		var exists = fs.existsSync(filePath);
		if(!exists) {
			try {
				fs.mkdirSync(filePath, 0777);
			} catch(e) {
				console.log("Error creating default logs folder : " + e);
				return false;
			}
		}
		queue.logFolder = filePath;
	}
	
	var logFile = filePath + logFileName;
	
	console.log(logKey + " log file location : " + logFile);
	self.logFileLocation = logFile;
	
	//~ if (fs.existsSync(logFile)) {
		//~ try {
			//~ fs.unlinkSync(logFile);
		//~ } catch (err) {
			//~ console.log(err.syscall + ' - ' + err.message);
		//~ }
	//~ }
	
	self.stream = fs.createWriteStream(logFile, {flags: 'a+', mode: '777', encoding: 'utf8'});
	
	Logger.streams[logKey] = self.stream;
	self.stream.on('error', function(err) {
		console.log(err)
		if (self.context && self.context.sendError) {
			self.context.sendError("Log Error:"+err);
		}
	});
	
	return true;
}

/** writeLog
* adds a new entry to the log file
*/
Logger.prototype.writeLog = function(logentry) {
	var self=this;
	if (!self.stream) {
		// file not yet opened... open it
		self.openStream();
	}
	if (!self.stream) {
		// still no handle... complain
		if (self.context && self.context.sendError) {
			return self.context.sendError("Unable to write to log file " + self.filename + " error opening file");
		}
	}
	// handle ok.. try and write to it
	self.stream.write(logentry);
}

/**
* closes the log file stream
*
* @method closeStream
*/
Logger.prototype.closeStream = function() {
	var self = this;
	if (self.stream) {
		try {
			self.stream.end();
		} catch (err) {
			console.log('Error closing stream');
		}
	}
	self.stream = null;
}

module.exports = Logger;

