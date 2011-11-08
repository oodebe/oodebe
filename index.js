var sys = require("sys"),
	http = require("http"),
	fs = require("fs"),
	util = require('util'),
	qs = require('querystring'),
	path = require('path'),
	async = require('async'),
	rest = require('restler'),
	tmpl = require('./tmpl'),
	mongo = require('mongoskin'),
	connect = require('connect'),
	exec  = require('child_process').exec,
	Log = require('log'),
	uuid = require('node-uuid'),
	url = require("url");
var users={
	'rahul':{
		username:'rahul',
		password:'123',
		auth:false
	}
};
// files with saved as scripttype/filename , this is to save file operation
var filescache={}; //hash for saving the scirpts in file cache 
//process.cwd() not work with upstart so changed to __dirname
var basedir=__dirname;
var log = new Log('debug', fs.createWriteStream(basedir+'/my.log'));

var config=fs.readFileSync(basedir+'/conf.js', encoding="ascii");
config=eval(config);

console.log("Creating client connections...");
var mongodb = mongo.db(config.mongodbhost);
console.log("... mongo client connected to "+config.mongodbhost);
// var client = solr.createClient(config.solrhost,config.solrport);
// console.log("... solr client connected to "+config.solrhost+":"+config.solrport);

var query;

var oodebe=function(request, responsehttp, next) {
	if (request.method == 'POST') {
		var body = '';
		request.on('data', function (data) {
			body += data;
		}); 
		request.on('end', function () {
			query = qs.parse(body);
			processquery(query, request, responsehttp);
		});
	} else {
		var url_parts = url.parse(request.url, true);
		query = url_parts.query;
		processquery(query, request, responsehttp);
	}
};
var server=connect(
	connect.cookieParser(),
	connect.session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}),
	connect.favicon(),
	oodebe
);
server.listen(80);
sys.puts('server started at '+config.serverport);
/*
  execScript({"filename": "nodejs/getbatches.scr",}, function (res) {
    if (!res) {
	    console.log('No response found while executing getbatches.scr');
    } else {
	    console.log('Executed getbatches.scr '+JSON.stringify(res));
    } 
	});
*/
var results=[];
getStatusFiles(__dirname+'/batches', function() {
	var len = results.length;
	if(len < 1) {
		console.log("no incomplete batch found");
		return;
	}
	console.log("found "+len+" incomplete batches. Starting to execute each file.");
	console.log(results);
	for(var i=0;i<len;i++){
		execScript({"filename": "nodejs/restartbatch.scr",paraminput:{batchfile:results[i]}}, function (res) {
			if(!res){
				console.log('No response found while executing batchfile ');
			} else {
				console.log('Executing batchfile.Result recd: '+JSON.stringify(res));
			}
		});
	}
	return;
});

function getStatusFiles(file, callback) {
	fs.stat(file, function(err, stat) {
		if (!stat) {
			return;
		}
		if (stat.isDirectory()) {
	    fs.readdir(file, function(err, files) {
			var tasks=[];
			for(var i=0;i<files.length;i++) {
				(function(index) {
					tasks.push(function(mycallback) {
						getStatusFiles(path.join(file, files[index]), function() {
							mycallback();
						});
					});
				})(i);
			}
			async.series(tasks, function() {
				if (callback) {
					callback();
				}
			});
		});
	} else { 
		try {
			var ext = file.substr(file.lastIndexOf('.') + 1);
			if (ext=='status') {
				console.log(file);
				results.push(file); 
			}
			callback();
		} catch(e) {
			console.log(e);
		}
	}
	});
}


function processquery(query, request, responsehttp){
	var returnResult = function (data){
		responsehttp.end(JSON.stringify(data));
	};
	
	if (!query.command) {
		fileprocess(request, responsehttp);
	}
	// responsehttp.writeHead(200, {"Content-Type": "application/json"});
	switch(query.command) {
	case 'test':
		testscript(query, returnResult);
		break;
	case 'execute':
		execScript(query, returnResult);
		break;
	case 'save':
		saveScript(query, returnResult);
		break;	
	case 'load':
		loadScript(query, returnResult);
		break;	 
	case 'delete':
		deleteScript(query,returnResult);
		break;
	case 'loadconfig':
		eval(fs.readFileSync(basedir+'/conf.js', encoding="ascii"));
		break;	
	case 'list':
		var results=[];
		getScripts(basedir+'/scripts/'+query.scripttype, results, function() {
			results.sort(function(a,b) { 
				if (b.description > a.description)
					return -1;
				else if (a.description > b.description)
					return 1;
				else 
					return 0;
			});			
			var data={'result':'success', 'files':results};
			returnResult(data);
		});
		break;
	case 'sort':
		sortScripts(query, returnResult);	
		break;
	case 'login':
			authuser(request, query, returnResult);
			break;
	case 'logout':
		logout(request, query, responsehttp);	
		break;
	case 'newuser':
		newuser(query, returnResult);	
		break;	
	}
}

function login(request, query, responsehttp) {
	if (users[query.username] && query.username==users[query.username].username && query.password==users[query.username].password) {
		request.session.auth = true;
		var data = {result:'success','message':'login successful'};
		responsehttp.end(JSON.stringify(data));
	} else {
		var data = {result:'error','message':'login incorrect'};
		responsehttp.end(JSON.stringify(data));
	}
}

function logout(request, query, responsehttp) {
	request.session.destroy();
	var data = {result:'success','message':'logout successful'};
	responsehttp.end(JSON.stringify(data));
}

function writeLog(file, string,flag,mode,skipDate) {
    try{
	if(!file || file=='') {
	    log.info("No filename specified while calling writeLog function");
	    return;
	}
	if(!string || string=="") {
	    log.info("No text specified while calling writeLog function");
	    return;
	}
	if(!flag || flag==''){
	    flag='a';
	}
	if(!mode || mode==''){
	    mode=755;
	}
	fs.open (file,flag,mode, function( e, id ) {
	    if(e) {
		log.info("Error while opening file "+file+":"+e.toString());
		fs.close(id);
		return;
	    }
	    if(!skipDate){
		string ="\\n" + new Date() +":" +new Date().getMilliseconds() + " "+string;
	    }
	    fs.write( id, string, null, 'utf8', function(){
		fs.close(id);
		return;
	    });
	});    
    }catch(e){
	log.info("Error while writing to log file "+file+":"+e.toString());
	return;
    }
}

function delFromSolr(id, query, callback){
    if(!query || query =='') {
			return;
    }
    client.del(id, query, function(err, response) {
	if (err) {
	    if (callback) {
				callback(err);
	    } else {
				console.log("error deleting document");
	    }
	} else {
	  if(callback) {
			callback(err);
		} else {
			console.log('Deleted all docs matching query "' + query + '"');
		}
	 }
	 client.commit();
	});
}

function addToSolr(doc,commit,callback){
    var commit = (!commit || commit=='false' || commit=='0')?false:true;

    execScript({'filename':'nodejs/converlilytosolr.scr',paraminput:doc}, function(res){
	if (res.success!='error') {
         //   if(commit) {
                client.commit();
                log.info(doc.id + 'committed to solr');
           // }
	} else {
	    log.info('Error in adding '+doc.id +' to solr');
	}
	if(callback) {
	    callback(res);
	}
    });
}

function testscript(){

}

// load a file and return it's contents as an object
function loadScript(request, callback){
	if (request.script) { // script passed... not required to load
		request.result='success';
		return callback(request);
	}	
	if (!request.filename) {
		var msg='no script filename specified';
		log.error(msg);
		return callback({result:'error','message':msg});
	}
	if (!request.scripttype) {
		var f=request.filename.split("\/");
		request.scripttype=f[0];
		request.filename=f[1];
	}
	var fname=request.scripttype+'/'+request.filename;
	//if file is present in cache and not asked to ignore it then return from there else do the file operation.
	if(!request.ignoreCache && filescache[fname]) {
		filescache[fname].result='success';
		return callback(filescache[fname]);
	}	
	fs.readFile(path.join(basedir, 'scripts', request.scripttype, request.filename), function(err, data) {
		if (err) {
			var msg="Error in loadScript:File not found";
			log.error(msg);
			return callback({result:'error','message': msg});
		}
		try {
			// parse the file contents
			data=JSON.parse(data);
			//saving to file cache every time load 
			filescache[data.scripttype+'/'+data.filename]=data;
		} catch(e) {
			data={result:'error',message:'Error in loading script:'+e.toString()};
			log.error(data);
		}
		data.result='success';
		callback(data);
	});
}

function execTheScript(request, callback) {
	process.nextTick(function(){
		execTheScript(request, callback);
	});
}
// execute a script
function execScript(request, callback) {
	// create a dummy callback if none is provided
	if (!callback) {callback=function(result) {return result;};}
	// check if any input paramters are passed, and add them in request.inputParams
	if (request.paraminput) {
		try {
			request.inputParams=parseInputParamters(request.paraminput);
		} catch(e) {
			return callback({result:'error',message:'Error in inputs:'+e.toString()});
		}
	} else {
		request.inputParams={};
	}

	// load the script from file or cache
	loadScript(request, function(data) {
		// if error during loading, return
		if (data.result=='error') {
			return callback(data);
		}
		// put loaded script into our request
		request.script=data.script;
		// merge request parameters and file paramters
		if(data.paraminput) {
			// parse the input paramters stored in the file and convert it into json format
			data.paraminput=merge_options({},parseInputParamters(data.paraminput));
		}
		request.inputParams=merge_options(data.paraminput,request.inputParams);
		// now insert the merged paramters into the script
		try {
			//replace the script by template 
			var myTemplate = tmpl.compile(request.script);
			var params = {};
			for(var k in request.inputParams) {
				if(typeof(request.inputParams[k])!='string') {
					params[k]=JSON.stringify(request.inputParams[k]);
				}else{
					params[k]=request.inputParams[k];
				}
			}
			request.script=myTemplate(params,GLOBAL);
		} catch(e) {
			// oops error
			return callback({result:'error',message:'Error inserting input parameters into script:'+e.toString()});
		}
		// now let's execute the script
		var url='';
		var data={};
		switch(request.scripttype) {
		case 'neo4j':
			url=config.neo4jurl;
			data={script:request.script,params:request.inputParams};
			break;
		case 'lily':
			url=config.lilyurl;
			// make sure the script is a valid JSON
			try {
				data = eval('('+request.script+')');
			} catch(e) {
				log.error('ms : ' +new Date().getMilliseconds() +'Lily Script JSON Error:'+e.toString());
				return callback({result:'error','message':e.toString()});
			}
			if (data.action != 'create') {
				url+=data.id;
			}
			break;
		case 'solr' :		
			url=config.solrurl+encodeURI(request.script);
			break;
		case 'nodejs' :
			function donodescript(request, _callback) {
				try {
					eval(request.script);
				} catch(e){
					_callback({result:'error','message':e.toString()});
				}
			}
			return donodescript(request, function(result) {callback(result);});
		case 'default':
			return callback({result:'error','message':'no script type specified'});
		}
		// execute curl request
		jsoncurl(url, data, function(response){
			if(typeof(response)!='object') {
				try {
					response = eval('('+response+')');
				} catch(e) {
					response={result:'success','response':response};
				}
			}
			callback(response);
		});
    });	
}


//parse the input parameter (string) by \n and first occurence of =
// return json
function parseInputParamters(dataparaminput) {
	var paraminput={};
	
	if (typeof(dataparaminput)=='object') {
		return dataparaminput;
	}	
	// first try to eval it as json
	try {
		paraminput = eval('('+dataparaminput+')');
		if (typeof(paraminput)=='object') {
			return paraminput;
		}	
	} catch(e) {
		// console.log('error in param input parsing'+e.toString());
	}
	//reinitialize as an empty object.. just incase eval over-wrote object  
	paraminput={};
	if (dataparaminput.indexOf('\n')==-1) {
		paraminput=qs.parse(dataparaminput);
		return paraminput;
	} 
	var inputlines=dataparaminput.split('\n');
	for (var i=0; i<inputlines.length; i++) {
		var line = inputlines[i];
		if(line.indexOf('=')<0) {continue;}
		var index=line.indexOf('=');
		var key = line.slice(0,index);
		var value = line.slice(index+1);	
		if (key!='') {
			paraminput[key]=value;
		}
	}
	return paraminput;
}

//if file overwrite!=checked create else update 
function saveScript(request, callback){
	try {
		var stats = fs.lstatSync(basedir+"/scripts/"+request.scripttype+"/"+request.filename);
		if (stats.isFile()==true) {
			if (!request.overwrite) {
				var msg='ms : ' +new Date().getMilliseconds() +'File Already Exist if you want to update then check over write';
				log.error(msg);
				data = {result:'error','message':msg};
				callback(data);
				return ;
			} else {
				savefile(request, callback);
			}
		} 
	} catch (e) {
		savefile(request, callback);
	}
}

function savefile(request, callback){
	delete request.command;
	delete request.callback;
	delete request.overwrite;
	fs.writeFile(path.join(basedir, "scripts", request.scripttype, request.filename), JSON.stringify(request), function(err) {
		var data = {};
		if (err) {
			log.error('ms : ' +new Date().getMilliseconds() +'error in save script '+err);
			data = {result:'error','message':err};
		} else {
			data = {result:'success','message':"The file was saved!"};
		}
		//saving to filecache also 
		var fname=request.scripttype+'/'+request.filename;
		filescache[fname]=request;
		if(callback) {
			callback(data);
			
		}
	});
}

function jsoncurl(burl, bdata, callback){
	log.debug('ms : ' +new Date().getMilliseconds() +'data going to curl '+JSON.stringify(bdata));
	if (bdata.action && bdata.action=='delete') {
			rest.del(burl, {headers: { 'Content-Type': 'application/json' }}).on('complete', function(data, response ,error ) {
				if(error){
					log.error('ms : ' +new Date().getMilliseconds() +'error while deleting '+JSON.stringify(error));
				}
				callback(data);
				log.info('ms : ' +new Date().getMilliseconds() +'returning data to callback after delete'+JSON.stringify(data));

			})
			.on('error', function(err) {
				log.error('ms : ' +new Date().getMilliseconds() +'error in json curl delete '+JSON.stringify(err));
				callback(err);
			});
			
	} else if (bdata.action && bdata.action=='get') {
		rest.get(burl, {headers: { 'Content-Type': 'application/json' }}).on('complete', function(data, response ,error ) {
			if(error){
				log.error('ms : ' +new Date().getMilliseconds() +'error while retrieving '+JSON.stringify(error));
			}
			callback(data);
			log.info('ms : ' +new Date().getMilliseconds() +'returning data to callback after get'+JSON.stringify(data));

		})
		.on('error', function(err) {
			log.error('ms : ' +new Date().getMilliseconds() +'error in json curl get '+JSON.stringify(err));
			callback(err);
		});
	}	else {
		rest.post(burl, {data: JSON.stringify(bdata),headers: { 'Content-Type': 'application/json' }}).on('complete', function(data, response ,error ) {
			if(error){
				log.error('ms : ' +new Date().getMilliseconds() +'error while creating/updating'+JSON.stringify(error));
			}
			log.info('ms : ' +new Date().getMilliseconds() +'returning data to callback after creating/updating'+JSON.stringify(data));
			callback(data);
		})
		.on('error', function(err) {
		    log.error('ms : ' +new Date().getMilliseconds() +'error in json curl while posting '+ JSON.stringify(bdata)+" error = "+JSON.stringify(err));
			callback(err);
		});
	}
}

function removeByElement(arrayName,arrayElement) {
  for(var i=0; i<arrayName.length;i++ ){ 
		if(arrayName[i]==arrayElement)
		arrayName.splice(i,1); 
  } 
}


/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function merge_options(obj1,obj2){
	var obj3 = {};
	for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
	for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
	return obj3;
}

function deleteScript(query, callback){
	if (query.filename==undefined) {
		var msg='ms : ' +new Date().getMilliseconds() +"File name is blank";
		log.error(msg);
		var data={'result':'error', 'message': msg };
		callback(data);
		return;
	}
	var fname = basedir+'/scripts/'+query.scripttype+'/'+query.filename;
	var is = fs.createReadStream(fname);
	var os = fs.createWriteStream(basedir+'/scripts/trash/'+query.filename);
	util.pump(is, os, function() {
		fs.readFile(fname, function(err, data){
			if (err) {
				var msg='ms : ' +new Date().getMilliseconds() +"error loading file";
				log.error(msg);
				var result={'result':'error', 'message':msg};
				callback(result);
			} else {
				var fname=basedir+'/scripts/'+query.scripttype+"/"+query.filename;
				fs.unlinkSync(fname);
				var result={'result':'success', 'message':"File deleted" };
				log.info('ms : ' +new Date().getMilliseconds() +'script deleted '+fname);
				callback(result);
			}
		});
	});
}

function getScripts(file,results,callback) {
	if (file.match(/\btrash\b/i)) {
		if (callback) {callback();}
		return;
	}
	fs.stat(file, function(err, stat) {
		if (!stat) {
			return;
		}
		if (stat.isDirectory()) {
			fs.readdir(file, function(err, files) {
				var tasks=[];
				for(var i=0;i<files.length;i++) {
					(function(index) {
						tasks.push(function(mycallback) {
							getScripts(path.join(file,files[index]),results,function() {
								mycallback();
							});
						});
					})(i);
				}
				async.series(tasks,function() {
					if (callback) {
						callback();
					}
				});
			});
		} else { // not directory...file
			file.match(/([^\/]+)\/([^\/]+)$/);
			var scripttype=RegExp.$1;
			var filename=RegExp.$2;
			loadScript({filename:filename,scripttype:scripttype},function(data) {
				results.push(data);
				if (callback) {
					callback();
				}
			});
		}
	});
}

function fileprocess(request, responsehttp) {
	var uri = url.parse(request.url).pathname;
	var sess = request.session;
	var age=sess.cookie.maxAge / 1000;
	if (age>0 && sess.auth==true) {
		if (uri=='' || uri == '/') {uri='html/index.html';}
	} else {
		if (uri=='' || uri == '/') {uri='html/login.html';}
	}
	var filename = path.join(basedir, uri);
	path.exists(filename, function(exists) {  
		if(!exists) {
			var msg='ms : ' +new Date().getMilliseconds() +"404 Not Found\n";
			log.error(msg);
			responsehttp.writeHead(404, {"Content-Type": "text/plain"});  
			responsehttp.write(msg);  
			responsehttp.end();  
			return;
		}  
		fs.readFile(filename, "binary", function(err, file) {  
			if(err) {  
				responsehttp.writeHead(500, {"Content-Type": "text/plain"});  
				responsehttp.write(err + "\n");  
				responsehttp.end();  
				return;  
			}  
			responsehttp.writeHead(200);  
			responsehttp.write(file, "binary");  
			responsehttp.end();  
		});  
	});  


}

function sortScripts(query, callback){
	if(!query.files) {
		var data={'result':'error', 'message':'no files found' };
		callback(data);
	}
	var files=query.files.split(',');
	var count=0;	
	async.forEach(files, function(item, mycallback){
			(function(index) {
				item.match(/([^\/]+)\/([^\/]+)$/);
				var scripttype=RegExp.$1;
				var filename=RegExp.$2;
				loadScript({filename:filename, scripttype:scripttype}, function(data){
					data.listorder=index;
					saveScript(data);
					mycallback();
				});
			})(count);
			count++;			
		},function(err){ /// result call back 
			var data={};
			if (err) {
				data = {'result':'error','message':'error sorting files'};	
			} else {
				data={'result':'success', 'message':'sorting done.'};
			}
			callback(data);
		}
	);	
}



function newuser(user, callback) {
	delete user.command;
	fs.readFile(path.join(__dirname, 'user.db'), 'utf8', function(err, data) {
		try { 
			if (err) {
				throw err;
			} 
			console.log('file is read ');
			if (data!=='') {
				data=eval('('+data+')');
			}
			
			if (typeof(data) === 'object') {
				if (data[user.username]) {
					return callback({result:'error','message':'user already exist'});
				} else {
					data[user.username]=user;
				}
			} else {
				data={};
				data[user.username]=user;
			} 
			fs.writeFile(path.join(__dirname, 'user.db'), JSON.stringify(data), function(err) {
				try {
					if (err) {
						throw err;
					} 
					return callback({result:'success','message':'new user saved '});
				} catch(e) {
					return callback({result:'error','message':e});
				}
			});
		} catch(e) {
			return callback({result:'error','message':e});
		}
	});
}

function authuser(request, user, callback) {
	fs.readFile(path.join(__dirname, 'user.db'), 'utf8', function(err, data) {
	
			if (err) {
				throw err;
			}
			console.log('file is read ');
			if (data!=='') {
				// parse the file contents
				data=eval('('+data+')');
			}
			
			if (typeof(data) === 'object') {
				if (!data[user.username]) {
					return callback({result:'error','message':'user not exist'});
				} else if (data[user.username].password!=user.password) {
					return callback({result:'error','message':'password not matched'});
				} else {
					request.session.auth = true;
					return callback({result:'success','message':'auth successul'});
				}
			} else {
				return callback({result:'error','message':'no user exist'});
			}
				try { 
		} catch(e) {
			return callback({result:'error','message':e});
		}
	});
}