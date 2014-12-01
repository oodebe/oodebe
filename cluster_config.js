// OODEBE master configurations
module.exports = {
	/* Set the cluster name, all the nodes (within the same network) having same name will form the cluster */
	cluster_name: 'node1',
	
	redis: {
		host: '127.0.0.1',
		port: 6379
	},
	
	/*
	* The path for the plugins directory
	*/
	plugin_path: '',
	/* To start server with HTTPS set the below key to true and specify the authorized server certificate and key location. */
	ssl: {
		enabled: false,
		cert: '',
		key: ''
	},
	
	/*
	* oodebe server port for master to listen to incoming requests
	*/
	port: 3000
	
	/*
	* Total number of workers allocated for the server.
	* master will fork workers equal to total_workers
	*/
,	total_workers: 10
	
	/*
	* priority levels can be configured here,
	* each level should specify percentage of total workers allocated for it (percent)
	* and jobs each worker should handle (per_worker)
	*/
,	priorities: {
	
		'low': {
			percent: 50 // implies total no of workers allocated for this proirity entity in percent.
		,	per_worker: 1
		}
		
	,	'high': {
			percent: 50
		,	per_worker: 0 // Infinity
		}
	},
	
	logging: {
		'INFO': 1,
		'WARNING': 1,
		'ERROR': 1,
		'DEBUG': 1,
	},
	
	max_job_queue: 20,
	heapSize : "default"
};
