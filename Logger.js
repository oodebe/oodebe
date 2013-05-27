var	fs = require("fs");

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* Logger
 * each instance represents a unique log file
 * filename: filename to write the log file
 * context: object containng method 'sendError'
 */
function Logger(filename,context) {
	// set context
	if (context) {
		self.context=context;
	}
	// set filename and open file
	this.openStream(filename);
}

/* Class static variable for maintaining all stream handles
 *
 */
Logger.streams={};

//-----------------------------------------------------------
// Methods
//-----------------------------------------------------------

/* openStream
 * opens/creates the specified log file stream and saves the handle in the instance variable
 */
Logger.prototype.openStream = function(filename) {
	var self = this;
	if (!filename) {
		filename=this.filename;
	}
	if (!filename) {
		return self.sendError("Unable to open log file. No filename specified");
	}
	self.filename=filename;
	// check if an instance already exists for this filename
	if (Logger.streams[filename]) {
		self.stream=Logger.streams[filename];
	} else {
		self.stream=fs.createWriteStream(__dirname+'/logs/'+self.filename,{flags:'a+',mode:'777',encoding:'utf8'});
		Logger.streams[self.filename]=self.stream;
		self.stream.on('error',function(err) {
			if (self.context && self.context.sendError) {
				self.context.sendError("Log Error:"+err);
			}
		});
	}
}

/* writeLog
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
			return self.context.sendError("Unable to write to log file "+self.filename+" error opening file");
		}
	}
	// handle ok.. try and write to it
	self.stream.write(logentry);
}

/* closeStream
 * closes the log file stream
 */
function closeStream() {
	if (self.stream) {
		self.stream.end();
	}
	self.stream=null;
}

//-----------------------------------------------------------
// Exports - Class Constructor
//-----------------------------------------------------------

module.exports = Logger;