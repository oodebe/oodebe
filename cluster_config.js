// OODEBE master configurations
module.exports = {
	/*
	* oodebe server port for master to listen to incoming requests
	*/
	port: 3000
	
	/*
	* Total number of workers allocated for the server.
	* master will fork workers equal to total_workers
	*/
,	total_workers: 4 
	
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
	}
};