var util = require('util');
var	fs = require("fs");
var Controller=require('./Controller');
var path = process.env.npm_package_config_plugins || './config';

//-----------------------------------------------------------
// Class Definition
//-----------------------------------------------------------

/* Logger
 * each instance represents a unique log file
 * filename: filename to write the log file
 * context: object containng method 'sendError'
 */
function Logger(filename,logPath,uuid,context) {
	// set context
	if (context) {
		self.context=context;
	}
	// set filename and open file
	if(!this.openStream(filename,logPath,uuid)) {
		this.success=false;
	}
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
Logger.prototype.openStream = function(filename,logPath,uuid) {
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
		var filePath = "";
		
		if(logPath.trim() == "") {
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
		} else {
			filePath = logPath;
		}
		
		var filename = (uuid != undefined && uuid.trim() != "") ? uuid + "_" + self.filename : self.filename;
		
		console.log("Log files location : " + filePath + filename);
		
		self.stream=fs.createWriteStream(filePath+filename,{flags:'a+',mode:'777',encoding:'utf8'});
		//~ self.stream=fs.createWriteStream(__dirname+'/logs/'+self.filename,{flags:'a+',mode:'777',encoding:'utf8'});
		Logger.streams[self.filename]=self.stream;
		self.stream.on('error',function(err) {
			if (self.context && self.context.sendError) {
				self.context.sendError("Log Error:"+err);
			}
		});
	}
	return true;
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
