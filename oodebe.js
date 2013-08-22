var Discover = require('node-discover');
var cluster = require('./cluster_config');

GLOBAL.discover = new Discover({
	// 'broadcast': '192.168.1.255'
	mastersRequired: 0
});

discover.me.port = cluster.port;

discover.on("promotion", function () {
	console.log("Elected as Master");
});

discover.on("demotion", function () {	
	console.log("Demoted from being a master!");
});

discover.on("added", function (node) {
	console.log(node.address + " is added to the cluster");
});

discover.on("removed", function (node) {
	console.log(node.address + " removed from the cluster");
});

discover.on("master", function (node) {
	console.log(node.address + " is elected to be the Master");
});

// Start master to serve requests
require('./master.js');