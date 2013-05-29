#! /usr/bin/env node

var plugins = process.env.npm_package_config_plugins || './config';
var port = process.env.npm_package_config_port || 3000;

var splitter = (process.argv[1].indexOf('\\') != -1 ? '\\' : '/');
arr = process.argv[1].split(splitter);
arr.pop();
var global_path = arr.join('/') + '/'
process.env.global_path = global_path;

var http = require("http");
var io=require('socket.io');
var	connect = require('connect');
var	qs = require('querystring');
var	url = require("url");
var	fs = require("fs");
var Queue = require('./Queue');
var statusUpdater;
var config = require(plugins);
console.log("Config:"+config);

oodebe();	

function oodebe(){
	var httpserver = connect()
		.use(connect.cookieParser("secret"))
		.use(connect.session({secret: 'keyboard cat',cookie: { maxAge: 60000 }}))
		.use(connect.logger('dev'))
		.use('/stat',connect.static(__dirname + '/html'))
		.use(router)
		.listen(port);

//	var statusserver = connect.createServer(connect.static(__dirname + '/html'));
//		.use();
	statusUpdater=io.listen(httpserver);
//	statusserver.listen(8200);

	statusUpdater.sockets.on('connection', function (socket) {
		socket.emit('status', { message: 'Hi there!\n' });
		socket.on('check', function (data) {
			socket.emit('status',{message:'I am alive\n'});
		});
	});
  
	statusUpdater.configure(function(){
		statusUpdater.enable('browser client etag');
		statusUpdater.set('log level', 1);
		statusUpdater.set('transports', ['websocket','flashsocket','htmlfile','xhr-polling','jsonp-polling']);
	});
}

function router(request, responsehttp, next){
	var context = {
		request:request,
		sendStatus:	function(message) {
			statusUpdater.sockets.emit('status',message);
		},
		sendResponse: function(message) {
			responsehttp.write(message);
		},
		endRequest:function(message) {
			if (message) responsehttp.write(message);
			responsehttp.end();
		}
	}
	var query,queue;
	if (request.method == 'POST') {
		var body = '';
		request.on('data', function (data){
			body += data;
		}); 
		request.on('end', function (){
			query = qs.parse(body);
			if(query['_op'] == undefined) {
				var pathName = request.url.split('/');
				var op = "";
				for(var i = 0; i < pathName.length; i++) {
					if(pathName[i] != "") {
						op += pathName[i] + ".";
					}
				}
				if(op != "") {
					op = op.replace(/[.]$/,'');
					query['_op'] = op;
				}
			}
			queue=new Queue(query, context);
		});
	} else {
		var url_parts = url.parse(request.url, true);
		if(url_parts.query['_op'] == undefined) {
			var pathName = url_parts.pathname.split('/');
			var op = "";
			for(var i = 0; i < pathName.length; i++) {
				if(pathName[i] != "") {
					op += pathName[i] + ".";
				}
			}
			if(op != "") {
				op = op.replace(/[.]$/,'');
				url_parts.query['_op'] = op;
			}
		}
		query = url_parts.query;
		queue=new Queue(query, context);
	}
}
